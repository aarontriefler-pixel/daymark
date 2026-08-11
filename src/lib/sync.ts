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

async function postToAppsScript(url: string, entry: TrackerEntry): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'upsert',
      entry,
      sentAt: new Date().toISOString(),
    }),
  })

  if (!res.ok) {
    throw new Error(`Sync HTTP ${res.status}`)
  }

  // Apps Script often returns text; tolerate empty/non-JSON success bodies.
  const text = await res.text()
  if (text) {
    try {
      const json = JSON.parse(text) as { ok?: boolean; error?: string }
      if (json.ok === false) throw new Error(json.error || 'Apps Script rejected entry')
    } catch (err) {
      if (err instanceof SyntaxError) {
        // Non-JSON success body is fine for GAS web apps.
        return
      }
      throw err
    }
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

  for (const item of queue) {
    try {
      await postToAppsScript(url, item.payload)
      const syncedAt = new Date().toISOString()
      await markEntrySynced(item.entryId, syncedAt)
      await removeSyncItem(item.id)
      sent += 1
    } catch (err) {
      failed += 1
      await updateSyncItem({
        ...item,
        attempts: item.attempts + 1,
        lastError: err instanceof Error ? err.message : 'Sync failed',
      })
    }
  }

  const remaining = (await getSyncQueue()).length
  let message = 'Everything is synced.'
  if (sent && remaining) message = `Synced ${sent}. ${remaining} still pending.`
  else if (sent) message = `Synced ${sent} entr${sent === 1 ? 'y' : 'ies'}.`
  else if (failed) message = `${failed} failed — will retry next sync.`
  else if (remaining) message = `${remaining} waiting in queue.`

  return { sent, failed, remaining, message }
}
