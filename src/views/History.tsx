import { useMemo, useState } from 'react'
import { useTracker } from '../hooks/useTracker'
import {
  formatDateTime,
  formatDayHeading,
  formatDuration,
  formatTime,
  sleepDurationHours,
  toDateKey,
} from '../lib/dates'
import type { TrackerEntry } from '../types'

function entryDayKey(entry: TrackerEntry): string {
  if (entry.type === 'context') return entry.date
  if (entry.type === 'symptom') return toDateKey(new Date(entry.onsetAt))
  if (entry.type === 'sleep') return toDateKey(new Date(entry.wakeAt))
  return toDateKey(new Date(entry.takenAt))
}

function entrySortTime(entry: TrackerEntry): string {
  if (entry.type === 'context') return `${entry.date}T12:00:00`
  if (entry.type === 'symptom') return entry.onsetAt
  if (entry.type === 'sleep') return entry.wakeAt
  return entry.takenAt
}

export function History() {
  const { entries, removeEntry } = useTracker()
  const [symptomFilter, setSymptomFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const symptomNames = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) if (e.type === 'symptom') set.add(e.name)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [entries])

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (symptomFilter) {
        if (entry.type === 'symptom' && entry.name !== symptomFilter) return false
        if (entry.type === 'medication') {
          const linked = entries.find((e) => e.id === entry.linkedSymptomId)
          if (!(linked && linked.type === 'symptom' && linked.name === symptomFilter)) {
            return false
          }
        }
        if (entry.type === 'sleep' || entry.type === 'context') return false
      }
      const day = entryDayKey(entry)
      if (from && day < from) return false
      if (to && day > to) return false
      return true
    })
  }, [entries, symptomFilter, from, to])

  const groups = useMemo(() => {
    const map = new Map<string, TrackerEntry[]>()
    for (const entry of filtered) {
      const key = entryDayKey(entry)
      const list = map.get(key) ?? []
      list.push(entry)
      map.set(key, list)
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, list]) => [
        day,
        list.sort((a, b) => entrySortTime(b).localeCompare(entrySortTime(a))),
      ] as const)
  }, [filtered])

  return (
    <div className="page">
      <header className="page-hero compact">
        <p className="brand">Daymark</p>
        <h1>History</h1>
        <p className="lede">Everything in one timeline, day by day.</p>
      </header>

      <div className="filters">
        <label className="field">
          Symptom
          <select
            className="input"
            value={symptomFilter}
            onChange={(e) => setSymptomFilter(e.target.value)}
          >
            <option value="">All types</option>
            {symptomNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          From
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field">
          To
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {groups.length === 0 ? (
        <p className="empty">No entries yet. Log something from the Add tab.</p>
      ) : (
        <div className="timeline">
          {groups.map(([day, list]) => (
            <section key={day} className="day-group">
              <h2>{formatDayHeading(day)}</h2>
              <ul>
                {list.map((entry) => (
                  <li key={entry.id} className={`timeline-item type-${entry.type}`}>
                    <EntryRow entry={entry} all={entries} onDelete={() => void removeEntry(entry.id)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function EntryRow({
  entry,
  all,
  onDelete,
}: {
  entry: TrackerEntry
  all: TrackerEntry[]
  onDelete: () => void
}) {
  if (entry.type === 'symptom') {
    return (
      <article>
        <div className="item-top">
          <span className="badge">Symptom</span>
          <time>{formatDateTime(entry.onsetAt)}</time>
        </div>
        <h3>
          {entry.name} <span className="severity">sev {entry.severity}/10</span>
        </h3>
        {entry.notes ? <p>{entry.notes}</p> : null}
        <button type="button" className="linkish" onClick={onDelete}>
          Delete
        </button>
      </article>
    )
  }

  if (entry.type === 'sleep') {
    const hours = sleepDurationHours(entry.startAt, entry.wakeAt)
    return (
      <article>
        <div className="item-top">
          <span className="badge">Sleep</span>
          <time>
            {formatTime(entry.startAt)} → {formatTime(entry.wakeAt)}
          </time>
        </div>
        <h3>
          {formatDuration(hours)} <span className="severity">quality {entry.quality}/5</span>
        </h3>
        {entry.notes ? <p>{entry.notes}</p> : null}
        <button type="button" className="linkish" onClick={onDelete}>
          Delete
        </button>
      </article>
    )
  }

  if (entry.type === 'medication') {
    const linked = all.find((e) => e.id === entry.linkedSymptomId)
    return (
      <article>
        <div className="item-top">
          <span className="badge">Med</span>
          <time>{formatDateTime(entry.takenAt)}</time>
        </div>
        <h3>
          {entry.name} <span className="severity">{entry.dose}</span>
        </h3>
        {linked && linked.type === 'symptom' ? <p>Linked to {linked.name}</p> : null}
        {entry.notes ? <p>{entry.notes}</p> : null}
        <button type="button" className="linkish" onClick={onDelete}>
          Delete
        </button>
      </article>
    )
  }

  return (
    <article>
      <div className="item-top">
        <span className="badge">Context</span>
        <time>{entry.date}</time>
      </div>
      <h3>Daily context</h3>
      <p className="meta-line">
        {[
          entry.stressLevel != null ? `stress ${entry.stressLevel}/5` : null,
          entry.hydrationOz != null ? `${entry.hydrationOz} oz water` : null,
          entry.activityType
            ? `${entry.activityType}${entry.activityIntensity ? ` (${entry.activityIntensity}/5)` : ''}`
            : null,
          entry.cyclePhase ? `cycle: ${entry.cyclePhase}` : null,
          entry.location?.length ? entry.location.join(', ') : null,
          entry.dietTags?.length ? entry.dietTags.join(', ') : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {entry.dietNotes ? <p>{entry.dietNotes}</p> : null}
      {entry.weather ? (
        <p className="weather-line">
          {entry.weather.weatherLabel}, {entry.weather.temperatureF}°F · {entry.weather.pressureHpa}{' '}
          hPa · {entry.weather.humidity}% humidity
        </p>
      ) : null}
      {entry.notes ? <p>{entry.notes}</p> : null}
      <button type="button" className="linkish" onClick={onDelete}>
        Delete
      </button>
    </article>
  )
}
