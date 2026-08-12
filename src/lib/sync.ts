import { createId } from './id'
import {
  enqueueSync,
  getAllEntries,
  getSettings,
  getSyncQueue,
  markEntrySynced,
  removeSyncItem,
  updateSyncItem,
} from './db'
import type { TrackerEntry } from '../types'

export type SyncResult = {
  sent: number
  failed: number
  remaining: number
  message: string
  lastError?: string
}

export async function queueEntryForSync(entry: TrackerEntry): Promise<void> {
  const queue = await getSyncQueue()
  if (queue.some((item) => item.entryId === entry.id)) return

  await enqueueSync({
    id: createId('sync'),
    entryId: entry.id,
    entryType: entry.type,
    payload: entry,
    attempts: 0,
    createdAt: new Date().toISOString(),
  })
}

async function enqueueUnsyncedEntries(): Promise<void> {
  const [entries, queue] = await Promise.all([getAllEntries(), getSyncQueue()])
  const queued = new Set(queue.map((item) => item.entryId))
  for (const entry of entries) {
    if (entry.syncedAt || queued.has(entry.id)) continue
    await queueEntryForSync(entry)
  }
}

function normalizeAppsScriptUrl(url: string): string {
  const trimmed = url.trim()
  // Users sometimes paste /dev (only works while editor is open) — prefer /exec.
  return trimmed.replace(/\/dev(?:\?.*)?$/, '/exec')
}

/**
 * Google Apps Script web apps redirect POST → GET across domains.
 * Reading the response from a GitHub Pages origin often hits CORS even when
 * the sheet write succeeded. Use no-cors so the browser delivers the POST body;
 * an opaque response means we cannot inspect JSON, but a thrown error means
 * a real network/setup failure.
 */
async function postToAppsScript(url: string, entry: TrackerEntry): Promise<void> {
  const endpoint = normalizeAppsScriptUrl(url)
  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(endpoint)) {
    throw new Error(
      'URL should look like https://script.google.com/macros/s/…/exec',
    )
  }

  const body = JSON.stringify({
    action: 'upsert',
    entry,
    sentAt: new Date().toISOString(),
  })

  try {
    // Preferred path: try to read confirmation when CORS allows it.
    const res = await fetch(endpoint, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
    })

    if (res.type === 'opaqueredirect') {
      return
    }

    if (!res.ok) {
      throw new Error(`Sync HTTP ${res.status}`)
    }

    const text = await res.text()
    if (text) {
      try {
        const json = JSON.parse(text) as { ok?: boolean; error?: string }
        if (json.ok === false) {
          throw new Error(json.error || 'Apps Script rejected entry')
        }
      } catch (err) {
        if (!(err instanceof SyntaxError)) throw err
      }
    }
    return
  } catch (err) {
    // Fallback: fire-and-forget POST. Apps Script still receives the body.
    const fallback = await fetch(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
    })
    // Opaque responses have type "opaque" and status 0 — treat as delivered.
    if (fallback.type === 'opaque' || fallback.type === 'opaqueredirect') {
      return
    }
    throw err instanceof Error ? err : new Error('Sync failed')
  }
}

export async function processSyncQueue(): Promise<SyncResult> {
  await enqueueUnsyncedEntries()

  const settings = await getSettings()
  const url = settings.appsScriptUrl.trim()
  if (!url) {
    const queue = await getSyncQueue()
    return {
      sent: 0,
      failed: 0,
      remaining: queue.length,
      message: 'Add an Apps Script URL in Settings to enable sync.',
    }
  }

  if (!navigator.onLine) {
    const queue = await getSyncQueue()
    return {
      sent: 0,
      failed: 0,
      remaining: queue.length,
      message: 'Offline — entries stay queued until you are online.',
    }
  }

  const queue = await getSyncQueue()
  let sent = 0
  let failed = 0
  let lastError: string | undefined

  for (const item of queue) {
    try {
      await postToAppsScript(url, item.payload)
      const syncedAt = new Date().toISOString()
      await markEntrySynced(item.entryId, syncedAt)
      await removeSyncItem(item.id)
      sent += 1
    } catch (err) {
      failed += 1
      lastError = err instanceof Error ? err.message : 'Sync failed'
      await updateSyncItem({
        ...item,
        attempts: item.attempts + 1,
        lastError,
      })
    }
  }

  const remaining = (await getSyncQueue()).length
  let message = 'Everything is synced.'
  if (sent && remaining) message = `Synced ${sent}. ${remaining} still pending.`
  else if (sent) message = `Synced ${sent} entr${sent === 1 ? 'y' : 'ies'}.`
  else if (failed) message = `${failed} failed${lastError ? `: ${lastError}` : ''} — will retry.`
  else if (remaining) message = `${remaining} waiting in queue.`

  return { sent, failed, remaining, message, lastError }
}
