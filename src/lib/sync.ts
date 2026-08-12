import { createId } from './id'
import {
  enqueueSync,
  getAllEntries,
  getSettings,
  getSyncQueue,
  markEntrySynced,
  putEntry,
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
  confirmed: boolean
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

/** Clear sync marks and re-queue everything (use after fixing Apps Script). */
export async function requeueAllEntriesForSync(): Promise<number> {
  const entries = await getAllEntries()
  let count = 0
  for (const entry of entries) {
    if (entry.syncedAt) {
      entry.syncedAt = null
      entry.updatedAt = new Date().toISOString()
      await putEntry(entry)
    }
    await queueEntryForSync(entry)
    count += 1
  }
  return count
}

export function normalizeAppsScriptUrl(url: string): string {
  const trimmed = url.trim()
  return trimmed.replace(/\/dev(?:\?.*)?$/, '/exec')
}

export function appsScriptTestUrl(url: string): string {
  const endpoint = normalizeAppsScriptUrl(url)
  const join = endpoint.includes('?') ? '&' : '?'
  return `${endpoint}${join}action=test`
}

type PostResult = { confirmed: boolean }

/**
 * Google Apps Script web apps redirect POST → GET across domains.
 * Reading the response from GitHub Pages often hits CORS even when the sheet
 * write succeeded. Prefer a readable CORS response; fall back to no-cors.
 */
async function postToAppsScript(url: string, entry: TrackerEntry): Promise<PostResult> {
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
    const res = await fetch(endpoint, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
    })

    if (res.type === 'opaqueredirect') {
      return { confirmed: false }
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
        return { confirmed: true }
      } catch (err) {
        if (!(err instanceof SyntaxError)) throw err
      }
    }
    return { confirmed: true }
  } catch {
    const fallback = await fetch(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
    })
    if (fallback.type === 'opaque' || fallback.type === 'opaqueredirect') {
      return { confirmed: false }
    }
    throw new Error('Sync failed — check Apps Script deploy (Anyone + /exec)')
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
      confirmed: false,
      message: 'Add an Apps Script URL in Settings to enable sync.',
    }
  }

  if (!navigator.onLine) {
    const queue = await getSyncQueue()
    return {
      sent: 0,
      failed: 0,
      remaining: queue.length,
      confirmed: false,
      message: 'Offline — entries stay queued until you are online.',
    }
  }

  const queue = await getSyncQueue()
  let sent = 0
  let failed = 0
  let confirmed = true
  let lastError: string | undefined

  for (const item of queue) {
    try {
      const result = await postToAppsScript(url, item.payload)
      if (!result.confirmed) confirmed = false
      const syncedAt = new Date().toISOString()
      await markEntrySynced(item.entryId, syncedAt)
      await removeSyncItem(item.id)
      sent += 1
    } catch (err) {
      failed += 1
      confirmed = false
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
  if (sent && !confirmed && !failed) {
    message = `Sent ${sent} to Sheets (unconfirmed). Open Test connection if the sheet is still empty.`
  } else if (sent && remaining) message = `Synced ${sent}. ${remaining} still pending.`
  else if (sent) message = `Synced ${sent} entr${sent === 1 ? 'y' : 'ies'}.`
  else if (failed) message = `${failed} failed${lastError ? `: ${lastError}` : ''} — will retry.`
  else if (remaining) message = `${remaining} waiting in queue.`

  return { sent, failed, remaining, message, lastError, confirmed }
}
