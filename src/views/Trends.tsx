import { useMemo, useState } from 'react'
import { useTracker } from '../hooks/useTracker'
import {
  sleepSeries,
  sleepSeverityCorrelation,
  sparklinePoints,
  symptomSeries,
  uniqueSymptomNames,
} from '../lib/trends'

export function Trends() {
  const { entries } = useTracker()
  const names = useMemo(() => uniqueSymptomNames(entries), [entries])
  const [symptom, setSymptom] = useState('')

  const activeSymptom = symptom || names[0] || ''
  const severityPoints = useMemo(
    () => (activeSymptom ? symptomSeries(entries, activeSymptom) : []),
    [entries, activeSymptom],
  )
  const sleepPoints = useMemo(() => sleepSeries(entries), [entries])
  const correlation = useMemo(
    () => sleepSeverityCorrelation(entries, activeSymptom || undefined),
    [entries, activeSymptom],
  )

  const severityValues = severityPoints.map((p) => p.severity)
  const durationValues = sleepPoints.map((p) => p.duration)
  const qualityValues = sleepPoints.map((p) => p.quality)

  return (
    <div className="page">
      <header className="page-hero compact">
        <p className="brand">Daymark</p>
        <h1>Trends</h1>
        <p className="lede">Severity, sleep, and simple correlations.</p>
      </header>

      <label className="field">
        Symptom
        <select
          className="input"
          value={activeSymptom}
          onChange={(e) => setSymptom(e.target.value)}
          disabled={!names.length}
        >
          {!names.length ? <option value="">No symptoms yet</option> : null}
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <section className="trend-panel">
        <h2>Severity over time</h2>
        {severityValues.length < 2 ? (
          <p className="empty small">Need at least two symptom entries to chart.</p>
        ) : (
          <>
            <Sparkline values={severityValues} />
            <p className="meta-line">
              Latest {severityValues[severityValues.length - 1]}/10 · avg{' '}
              {(
                severityValues.reduce((a, b) => a + b, 0) / severityValues.length
              ).toFixed(1)}
              /10 across {severityValues.length} logs
            </p>
          </>
        )}
      </section>

      <section className="trend-panel">
        <h2>Sleep duration</h2>
        {durationValues.length < 2 ? (
          <p className="empty small">Need at least two sleep entries to chart.</p>
        ) : (
          <>
            <Sparkline values={durationValues} />
            <p className="meta-line">
              Latest {durationValues[durationValues.length - 1]}h · avg{' '}
              {(durationValues.reduce((a, b) => a + b, 0) / durationValues.length).toFixed(1)}h
            </p>
          </>
        )}
      </section>

      <section className="trend-panel">
        <h2>Sleep quality</h2>
        {qualityValues.length < 2 ? (
          <p className="empty small">Need at least two sleep entries to chart.</p>
        ) : (
          <>
            <Sparkline values={qualityValues} />
            <p className="meta-line">
              Latest {qualityValues[qualityValues.length - 1]}/5 · avg{' '}
              {(qualityValues.reduce((a, b) => a + b, 0) / qualityValues.length).toFixed(1)}/5
            </p>
          </>
        )}
      </section>

      <section className="trend-panel callout">
        <h2>Correlation callout</h2>
        {!correlation ? (
          <p className="empty small">
            Log sleep and symptoms on overlapping days to compare severity on low-sleep vs
            high-sleep days.
          </p>
        ) : (
          <p>
            For <strong>{correlation.symptomLabel}</strong>, average severity on days with under{' '}
            {correlation.medianSleepHours}h sleep was{' '}
            <strong>{correlation.avgSeverityLowSleep}/10</strong> ({correlation.lowSleepDays} days)
            vs <strong>{correlation.avgSeverityHighSleep}/10</strong> on higher-sleep days (
            {correlation.highSleepDays} days).
          </p>
        )}
      </section>
    </div>
  )
}

function Sparkline({ values }: { values: number[] }) {
  const width = 280
  const height = 64
  const points = sparklinePoints(values, width, height)
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
      <polyline fill="none" stroke="currentColor" strokeWidth="3" points={points} />
    </svg>
  )
}
