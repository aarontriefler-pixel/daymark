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

function assertExecUrl(endpoint: string) {
  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(endpoint)) {
    throw new Error(
      'URL should look like https://script.google.com/macros/s/…/exec',
    )
  }
}

async function readAppsScriptJson(res: Response): Promise<{ ok?: boolean; error?: string }> {
  const text = await res.text()
  if (!text) return { ok: true }
  try {
    return JSON.parse(text) as { ok?: boolean; error?: string }
  } catch {
    // Apps Script sometimes wraps JSON in HTML when auth/redirect fails.
    if (/<html/i.test(text)) {
      throw new Error('Apps Script returned a login/HTML page — redeploy with Anyone access')
    }
    return { ok: true }
  }
}

/**
 * Prefer GET upsert — same path as Test connection, which works from GitHub Pages.
 * Fall back to text/plain POST if the URL would be too long.
 */
async function postToAppsScript(url: string, entry: TrackerEntry): Promise<PostResult> {
  const endpoint = normalizeAppsScriptUrl(url)
  assertExecUrl(endpoint)

  const payload = {
    action: 'upsert',
    entry,
    sentAt: new Date().toISOString(),
  }
  const encoded = encodeURIComponent(JSON.stringify(payload))
  const getUrl = `${endpoint}${endpoint.includes('?') ? '&' : '?'}action=upsert&data=${encoded}`

  // Keep GET under common practical URL limits.
  if (getUrl.length <= 1800) {
    const res = await fetch(getUrl, {
      method: 'GET',
      redirect: 'follow',
      credentials: 'omit',
    })
    if (!res.ok) throw new Error(`Sync HTTP ${res.status}`)
    const json = await readAppsScriptJson(res)
    if (json.ok === false) throw new Error(json.error || 'Apps Script rejected entry')
    return { confirmed: true }
  }

  // Large payloads (e.g. long notes): try POST.
  const res = await fetch(endpoint, {
    method: 'POST',
    redirect: 'follow',
    credentials: 'omit',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Sync HTTP ${res.status}`)
  const json = await readAppsScriptJson(res)
  if (json.ok === false) throw new Error(json.error || 'Apps Script rejected entry')
  return { confirmed: true }
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
  if (sent && remaining) message = `Synced ${sent}. ${remaining} still pending.`
  else if (sent) message = `Synced ${sent} entr${sent === 1 ? 'y' : 'ies'}.`
  else if (failed) message = `${failed} failed${lastError ? `: ${lastError}` : ''} — will retry.`
  else if (remaining) message = `${remaining} waiting in queue.`

  return { sent, failed, remaining, message, lastError, confirmed }
}
