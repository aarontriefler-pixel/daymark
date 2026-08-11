import type { TrackerEntry } from '../types'

function escapeCsv(value: unknown): string {
  const str = value == null ? '' : String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function entriesToJson(entries: TrackerEntry[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: 'daymark',
      version: 1,
      entries,
    },
    null,
    2,
  )
}

export function entriesToCsv(entries: TrackerEntry[]): string {
  const headers = [
    'id',
    'type',
    'createdAt',
    'updatedAt',
    'syncedAt',
    'name',
    'severity',
    'onsetAt',
    'startAt',
    'wakeAt',
    'quality',
    'dose',
    'takenAt',
    'linkedSymptomId',
    'date',
    'stressLevel',
    'dietNotes',
    'dietTags',
    'hydrationOz',
    'activityType',
    'activityIntensity',
    'cyclePhase',
    'location',
    'weather',
    'notes',
  ]

  const rows = entries.map((entry) => {
    const base: Record<string, unknown> = {
      id: entry.id,
      type: entry.type,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      syncedAt: entry.syncedAt ?? '',
    }

    if (entry.type === 'symptom') {
      Object.assign(base, {
        name: entry.name,
        severity: entry.severity,
        onsetAt: entry.onsetAt,
        notes: entry.notes ?? '',
      })
    } else if (entry.type === 'sleep') {
      Object.assign(base, {
        startAt: entry.startAt,
        wakeAt: entry.wakeAt,
        quality: entry.quality,
        notes: entry.notes ?? '',
      })
    } else if (entry.type === 'medication') {
      Object.assign(base, {
        name: entry.name,
        dose: entry.dose,
        takenAt: entry.takenAt,
        linkedSymptomId: entry.linkedSymptomId ?? '',
        notes: entry.notes ?? '',
      })
    } else {
      Object.assign(base, {
        date: entry.date,
        stressLevel: entry.stressLevel ?? '',
        dietNotes: entry.dietNotes ?? '',
        dietTags: (entry.dietTags ?? []).join('|'),
        hydrationOz: entry.hydrationOz ?? '',
        activityType: entry.activityType ?? '',
        activityIntensity: entry.activityIntensity ?? '',
        cyclePhase: entry.cyclePhase ?? '',
        location: (entry.location ?? []).join('|'),
        weather: entry.weather ? JSON.stringify(entry.weather) : '',
        notes: entry.notes ?? '',
      })
    }

    return headers.map((h) => escapeCsv(base[h])).join(',')
  })

  return [headers.join(','), ...rows].join('\n')
}

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function parseImportJson(text: string): TrackerEntry[] {
  const data = JSON.parse(text) as { entries?: TrackerEntry[] } | TrackerEntry[]
  const entries = Array.isArray(data) ? data : data.entries
  if (!Array.isArray(entries)) throw new Error('Invalid Daymark backup file')
  return entries
}
