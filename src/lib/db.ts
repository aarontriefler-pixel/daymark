import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type Catalogs,
  type SyncQueueItem,
  type TrackerEntry,
} from '../types'

interface DaymarkDB extends DBSchema {
  entries: {
    key: string
    value: TrackerEntry
    indexes: { 'by-type': string; 'by-created': string }
  }
  settings: {
    key: string
    value: AppSettings
  }
  syncQueue: {
    key: string
    value: SyncQueueItem
    indexes: { 'by-created': string }
  }
  catalogs: {
    key: string
    value: Catalogs
  }
}

const DB_NAME = 'daymark'
const DB_VERSION = 1
const SETTINGS_KEY = 'app'
const CATALOGS_KEY = 'names'

let dbPromise: Promise<IDBPDatabase<DaymarkDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<DaymarkDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const entries = db.createObjectStore('entries', { keyPath: 'id' })
        entries.createIndex('by-type', 'type')
        entries.createIndex('by-created', 'createdAt')

        db.createObjectStore('settings')
        const queue = db.createObjectStore('syncQueue', { keyPath: 'id' })
        queue.createIndex('by-created', 'createdAt')
        db.createObjectStore('catalogs')
      },
    })
  }
  return dbPromise
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb()
  return (await db.get('settings', SETTINGS_KEY)) ?? { ...DEFAULT_SETTINGS }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDb()
  await db.put('settings', settings, SETTINGS_KEY)
}

export async function getCatalogs(): Promise<Catalogs> {
  const db = await getDb()
  return (
    (await db.get('catalogs', CATALOGS_KEY)) ?? {
      symptoms: [],
      medications: [],
    }
  )
}

export async function rememberName(
  kind: 'symptoms' | 'medications',
  name: string,
): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  const db = await getDb()
  const catalogs = await getCatalogs()
  const list = catalogs[kind]
  const exists = list.some((n) => n.toLowerCase() === trimmed.toLowerCase())
  if (!exists) {
    catalogs[kind] = [trimmed, ...list].sort((a, b) => a.localeCompare(b))
    await db.put('catalogs', catalogs, CATALOGS_KEY)
  }
}

export async function getAllEntries(): Promise<TrackerEntry[]> {
  const db = await getDb()
  const entries = await db.getAllFromIndex('entries', 'by-created')
  return entries.reverse()
}

export async function getEntry(id: string): Promise<TrackerEntry | undefined> {
  const db = await getDb()
  return db.get('entries', id)
}

export async function putEntry(entry: TrackerEntry): Promise<void> {
  const db = await getDb()
  await db.put('entries', entry)
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('entries', id)
}

export async function replaceAllEntries(entries: TrackerEntry[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('entries', 'readwrite')
  await tx.store.clear()
  await Promise.all(entries.map((e) => tx.store.put(e)))
  await tx.done
}

export async function enqueueSync(item: SyncQueueItem): Promise<void> {
  const db = await getDb()
  await db.put('syncQueue', item)
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDb()
  return db.getAllFromIndex('syncQueue', 'by-created')
}

export async function removeSyncItem(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('syncQueue', id)
}

export async function updateSyncItem(item: SyncQueueItem): Promise<void> {
  const db = await getDb()
  await db.put('syncQueue', item)
}

export async function markEntrySynced(entryId: string, syncedAt: string): Promise<void> {
  const db = await getDb()
  const entry = await db.get('entries', entryId)
  if (!entry) return
  entry.syncedAt = syncedAt
  entry.updatedAt = syncedAt
  await db.put('entries', entry)
}
