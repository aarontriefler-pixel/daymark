import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  deleteEntry,
  getAllEntries,
  getCatalogs,
  getSettings,
  getSyncQueue,
  putEntry,
  rememberName,
  replaceAllEntries,
  saveSettings,
} from '../lib/db'
import { createId } from '../lib/id'
import { processSyncQueue, queueEntryForSync, type SyncResult } from '../lib/sync'
import { fetchWeatherForZip } from '../lib/weather'
import type {
  AppSettings,
  Catalogs,
  DailyContextEntry,
  MedicationEntry,
  SleepEntry,
  SymptomEntry,
  TrackerEntry,
} from '../types'
import { DEFAULT_SETTINGS } from '../types'

type TrackerContextValue = {
  ready: boolean
  entries: TrackerEntry[]
  settings: AppSettings
  catalogs: Catalogs
  queueCount: number
  lastSyncMessage: string
  refresh: () => Promise<void>
  saveAppSettings: (next: AppSettings) => Promise<void>
  addSymptom: (input: Omit<SymptomEntry, 'id' | 'type' | 'createdAt' | 'updatedAt' | 'syncedAt'>) => Promise<SymptomEntry>
  addSleep: (input: Omit<SleepEntry, 'id' | 'type' | 'createdAt' | 'updatedAt' | 'syncedAt'>) => Promise<SleepEntry>
  addMedication: (input: Omit<MedicationEntry, 'id' | 'type' | 'createdAt' | 'updatedAt' | 'syncedAt'>) => Promise<MedicationEntry>
  addContext: (input: Omit<DailyContextEntry, 'id' | 'type' | 'createdAt' | 'updatedAt' | 'syncedAt' | 'weather'> & { fetchWeather?: boolean }) => Promise<DailyContextEntry>
  removeEntry: (id: string) => Promise<void>
  syncNow: () => Promise<SyncResult>
  importEntries: (entries: TrackerEntry[], mode: 'merge' | 'replace') => Promise<void>
}

const TrackerContext = createContext<TrackerContextValue | null>(null)

async function persistAndQueue(entry: TrackerEntry) {
  await putEntry(entry)
  await queueEntryForSync(entry)
}

export function TrackerProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [entries, setEntries] = useState<TrackerEntry[]>([])
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [catalogs, setCatalogs] = useState<Catalogs>({ symptoms: [], medications: [] })
  const [queueCount, setQueueCount] = useState(0)
  const [lastSyncMessage, setLastSyncMessage] = useState('')

  const refresh = useCallback(async () => {
    const [e, s, c, q] = await Promise.all([
      getAllEntries(),
      getSettings(),
      getCatalogs(),
      getSyncQueue(),
    ])
    setEntries(e)
    setSettings(s)
    setCatalogs(c)
    setQueueCount(q.length)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await refresh()
      if (!cancelled) setReady(true)
      const result = await processSyncQueue()
      if (!cancelled) {
        setLastSyncMessage(result.message)
        await refresh()
      }
    })()

    const onOnline = () => {
      void processSyncQueue().then(async (result) => {
        setLastSyncMessage(result.message)
        await refresh()
      })
    }
    window.addEventListener('online', onOnline)
    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
    }
  }, [refresh])

  const saveAppSettings = useCallback(async (next: AppSettings) => {
    await saveSettings(next)
    setSettings(next)
  }, [])

  const addSymptom = useCallback(
    async (input: Omit<SymptomEntry, 'id' | 'type' | 'createdAt' | 'updatedAt' | 'syncedAt'>) => {
      const now = new Date().toISOString()
      const entry: SymptomEntry = {
        ...input,
        id: createId('sym'),
        type: 'symptom',
        createdAt: now,
        updatedAt: now,
        syncedAt: null,
      }
      await persistAndQueue(entry)
      await rememberName('symptoms', entry.name)
      await refresh()
      return entry
    },
    [refresh],
  )

  const addSleep = useCallback(
    async (input: Omit<SleepEntry, 'id' | 'type' | 'createdAt' | 'updatedAt' | 'syncedAt'>) => {
      const now = new Date().toISOString()
      const entry: SleepEntry = {
        ...input,
        id: createId('slp'),
        type: 'sleep',
        createdAt: now,
        updatedAt: now,
        syncedAt: null,
      }
      await persistAndQueue(entry)
      await refresh()
      return entry
    },
    [refresh],
  )

  const addMedication = useCallback(
    async (input: Omit<MedicationEntry, 'id' | 'type' | 'createdAt' | 'updatedAt' | 'syncedAt'>) => {
      const now = new Date().toISOString()
      const entry: MedicationEntry = {
        ...input,
        id: createId('med'),
        type: 'medication',
        createdAt: now,
        updatedAt: now,
        syncedAt: null,
      }
      await persistAndQueue(entry)
      await rememberName('medications', entry.name)
      await refresh()
      return entry
    },
    [refresh],
  )

  const addContext = useCallback(
    async (
      input: Omit<DailyContextEntry, 'id' | 'type' | 'createdAt' | 'updatedAt' | 'syncedAt' | 'weather'> & {
        fetchWeather?: boolean
      },
    ) => {
      const now = new Date().toISOString()
      let weather = null
      if (input.fetchWeather !== false && settings.zipCode.trim()) {
        try {
          weather = await fetchWeatherForZip(settings.zipCode)
        } catch {
          weather = null
        }
      }
      const { fetchWeather: _fw, ...rest } = input
      const entry: DailyContextEntry = {
        ...rest,
        weather,
        id: createId('ctx'),
        type: 'context',
        createdAt: now,
        updatedAt: now,
        syncedAt: null,
      }
      await persistAndQueue(entry)
      await refresh()
      return entry
    },
    [refresh, settings.zipCode],
  )

  const removeEntry = useCallback(
    async (id: string) => {
      await deleteEntry(id)
      await refresh()
    },
    [refresh],
  )

  const syncNow = useCallback(async () => {
    const result = await processSyncQueue()
    setLastSyncMessage(result.message)
    await refresh()
    return result
  }, [refresh])

  const importEntries = useCallback(
    async (incoming: TrackerEntry[], mode: 'merge' | 'replace') => {
      if (mode === 'replace') {
        await replaceAllEntries(incoming)
      } else {
        const map = new Map(entries.map((e) => [e.id, e]))
        for (const e of incoming) map.set(e.id, e)
        await replaceAllEntries([...map.values()])
      }
      for (const e of incoming) {
        if (e.type === 'symptom') await rememberName('symptoms', e.name)
        if (e.type === 'medication') await rememberName('medications', e.name)
      }
      await refresh()
    },
    [entries, refresh],
  )

  const value = useMemo(
    () => ({
      ready,
      entries,
      settings,
      catalogs,
      queueCount,
      lastSyncMessage,
      refresh,
      saveAppSettings,
      addSymptom,
      addSleep,
      addMedication,
      addContext,
      removeEntry,
      syncNow,
      importEntries,
    }),
    [
      ready,
      entries,
      settings,
      catalogs,
      queueCount,
      lastSyncMessage,
      refresh,
      saveAppSettings,
      addSymptom,
      addSleep,
      addMedication,
      addContext,
      removeEntry,
      syncNow,
      importEntries,
    ],
  )

  return createElement(TrackerContext.Provider, { value }, children)
}

export function useTracker() {
  const ctx = useContext(TrackerContext)
  if (!ctx) throw new Error('useTracker must be used within TrackerProvider')
  return ctx
}
