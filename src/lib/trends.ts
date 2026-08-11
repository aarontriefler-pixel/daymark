import { sleepDurationHours, toDateKey } from './dates'
import type { SleepEntry, SymptomEntry, TrackerEntry } from '../types'

function avg(nums: number[]): number | null {
  if (!nums.length) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
}

export function symptomSeries(entries: TrackerEntry[], symptomName: string) {
  return entries
    .filter((e): e is SymptomEntry => e.type === 'symptom' && e.name === symptomName)
    .map((e) => ({
      at: e.onsetAt,
      severity: e.severity,
      date: toDateKey(new Date(e.onsetAt)),
    }))
    .sort((a, b) => a.at.localeCompare(b.at))
}

export function sleepSeries(entries: TrackerEntry[]) {
  return entries
    .filter((e): e is SleepEntry => e.type === 'sleep')
    .map((e) => ({
      at: e.wakeAt,
      duration: sleepDurationHours(e.startAt, e.wakeAt),
      quality: e.quality,
      date: toDateKey(new Date(e.wakeAt)),
    }))
    .sort((a, b) => a.at.localeCompare(b.at))
}

export function uniqueSymptomNames(entries: TrackerEntry[]): string[] {
  const set = new Set<string>()
  for (const e of entries) {
    if (e.type === 'symptom') set.add(e.name)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export function sleepSeverityCorrelation(entries: TrackerEntry[], symptomName?: string) {
  const sleeps = sleepSeries(entries)
  if (sleeps.length < 2) return null

  const durations = sleeps.map((s) => s.duration)
  const median =
    [...durations].sort((a, b) => a - b)[Math.floor(durations.length / 2)] ?? 7

  const symptoms = entries.filter((e): e is SymptomEntry => {
    if (e.type !== 'symptom') return false
    if (symptomName && e.name !== symptomName) return false
    return true
  })

  const low: number[] = []
  const high: number[] = []

  for (const sleep of sleeps) {
    const dayKey = sleep.date
    const daySymptoms = symptoms.filter((s) => toDateKey(new Date(s.onsetAt)) === dayKey)
    if (!daySymptoms.length) continue
    const dayAvg = avg(daySymptoms.map((s) => s.severity))
    if (dayAvg == null) continue
    if (sleep.duration < median) low.push(dayAvg)
    else high.push(dayAvg)
  }

  if (!low.length || !high.length) return null

  return {
    medianSleepHours: median,
    avgSeverityLowSleep: avg(low),
    avgSeverityHighSleep: avg(high),
    lowSleepDays: low.length,
    highSleepDays: high.length,
    symptomLabel: symptomName || 'all symptoms',
  }
}

export function sparklinePoints(values: number[], width = 220, height = 56): string {
  if (!values.length) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return values
    .map((v, i) => {
      const x = values.length === 1 ? width / 2 : (i / (values.length - 1)) * width
      const y = height - ((v - min) / span) * (height - 8) - 4
      return `${x},${y}`
    })
    .join(' ')
}
