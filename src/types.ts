export type EntryType = 'symptom' | 'sleep' | 'medication' | 'context'

export type DietTag = 'dairy' | 'gluten' | 'alcohol' | 'caffeine' | 'skipped meal'

export type LocationTag = 'home' | 'travel' | 'indoor' | 'outdoor'

export type CyclePhase =
  | 'menstrual'
  | 'follicular'
  | 'ovulation'
  | 'luteal'
  | 'unknown'

export interface WeatherSnapshot {
  fetchedAt: string
  zipCode: string
  latitude: number
  longitude: number
  temperatureF: number
  weatherCode: number
  weatherLabel: string
  pressureHpa: number
  humidity: number
}

export interface BaseEntry {
  id: string
  type: EntryType
  createdAt: string
  updatedAt: string
  syncedAt: string | null
}

export interface SymptomEntry extends BaseEntry {
  type: 'symptom'
  name: string
  severity: number
  onsetAt: string
  notes?: string
}

export interface SleepEntry extends BaseEntry {
  type: 'sleep'
  startAt: string
  wakeAt: string
  quality: number
  notes?: string
}

export interface MedicationEntry extends BaseEntry {
  type: 'medication'
  name: string
  dose: string
  takenAt: string
  linkedSymptomId?: string
  notes?: string
}

export interface DailyContextEntry extends BaseEntry {
  type: 'context'
  date: string
  stressLevel?: number
  dietNotes?: string
  dietTags?: DietTag[]
  hydrationOz?: number
  activityType?: string
  activityIntensity?: number
  cyclePhase?: CyclePhase
  location?: LocationTag[]
  weather?: WeatherSnapshot | null
  notes?: string
}

export type TrackerEntry =
  | SymptomEntry
  | SleepEntry
  | MedicationEntry
  | DailyContextEntry

export interface AppSettings {
  appsScriptUrl: string
  zipCode: string
  cycleTrackingEnabled: boolean
  hydrationUnit: 'oz' | 'glasses'
}

export interface SyncQueueItem {
  id: string
  entryId: string
  entryType: EntryType
  payload: TrackerEntry
  attempts: number
  lastError?: string
  createdAt: string
}

export interface Catalogs {
  symptoms: string[]
  medications: string[]
}

export const DEFAULT_SETTINGS: AppSettings = {
  appsScriptUrl: '',
  zipCode: '',
  cycleTrackingEnabled: false,
  hydrationUnit: 'glasses',
}

export const DIET_TAGS: DietTag[] = [
  'dairy',
  'gluten',
  'alcohol',
  'caffeine',
  'skipped meal',
]

export const LOCATION_TAGS: LocationTag[] = [
  'home',
  'travel',
  'indoor',
  'outdoor',
]

export const CYCLE_PHASES: { value: CyclePhase; label: string }[] = [
  { value: 'menstrual', label: 'Menstrual' },
  { value: 'follicular', label: 'Follicular' },
  { value: 'ovulation', label: 'Ovulation' },
  { value: 'luteal', label: 'Luteal' },
  { value: 'unknown', label: 'Not sure' },
]
