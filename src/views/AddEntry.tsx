import { useMemo, useState } from 'react'
import { ChipSelect, NamePicker, ScalePicker, Toast } from '../components/ui'
import { useTracker } from '../hooks/useTracker'
import { formatDuration, sleepDurationHours, toDateKey, toLocalInputValue } from '../lib/dates'
import {
  CYCLE_PHASES,
  DIET_TAGS,
  LOCATION_TAGS,
  type CyclePhase,
  type DietTag,
  type LocationTag,
} from '../types'

type Tab = 'symptom' | 'sleep' | 'medication' | 'context'

export function AddEntry() {
  const { catalogs, entries, settings, addSymptom, addSleep, addMedication, addContext } =
    useTracker()
  const [tab, setTab] = useState<Tab>('symptom')
  const [toast, setToast] = useState('')

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2200)
  }

  return (
    <div className="page">
      <header className="page-hero">
        <p className="brand">Daymark</p>
        <h1>Quick log</h1>
        <p className="lede">Tap what happened. Keep typing optional.</p>
      </header>

      <div className="segmented" role="tablist" aria-label="Entry type">
        {(
          [
            ['symptom', 'Symptom'],
            ['sleep', 'Sleep'],
            ['medication', 'Meds'],
            ['context', 'Context'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'is-active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'symptom' && (
        <SymptomForm
          suggestions={catalogs.symptoms}
          onSave={async (data) => {
            await addSymptom(data)
            flash('Symptom saved')
          }}
        />
      )}
      {tab === 'sleep' && (
        <SleepForm
          onSave={async (data) => {
            await addSleep(data)
            flash('Sleep saved')
          }}
        />
      )}
      {tab === 'medication' && (
        <MedicationForm
          suggestions={catalogs.medications}
          symptoms={entries.flatMap((e) => (e.type === 'symptom' ? [e] : []))}
          onSave={async (data) => {
            await addMedication(data)
            flash('Medication saved')
          }}
        />
      )}
      {tab === 'context' && (
        <ContextForm
          cycleEnabled={settings.cycleTrackingEnabled}
          hydrationUnit={settings.hydrationUnit}
          hasZip={Boolean(settings.zipCode.trim())}
          onSave={async (data) => {
            await addContext(data)
            flash('Daily context saved')
          }}
        />
      )}

      <Toast message={toast} />
    </div>
  )
}

function SymptomForm({
  suggestions,
  onSave,
}: {
  suggestions: string[]
  onSave: (data: { name: string; severity: number; onsetAt: string; notes?: string }) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [severity, setSeverity] = useState(5)
  const [onsetAt, setOnsetAt] = useState(toLocalInputValue())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        setSaving(true)
        try {
          await onSave({
            name: name.trim(),
            severity,
            onsetAt: new Date(onsetAt).toISOString(),
            notes: notes.trim() || undefined,
          })
          setNotes('')
          setOnsetAt(toLocalInputValue())
        } finally {
          setSaving(false)
        }
      }}
    >
      <NamePicker
        label="Symptom"
        value={name}
        suggestions={suggestions}
        onChange={setName}
        placeholder="e.g. headache, nausea"
      />
      <ScalePicker label="Severity" min={1} max={10} value={severity} onChange={setSeverity} />
      <label className="field">
        Onset
        <input
          className="input"
          type="datetime-local"
          value={onsetAt}
          onChange={(e) => setOnsetAt(e.target.value)}
        />
      </label>
      <label className="field">
        Notes <span className="hint">(optional)</span>
        <textarea
          className="input textarea"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything notable"
        />
      </label>
      <button className="btn primary" type="submit" disabled={!name.trim() || saving}>
        {saving ? 'Saving…' : 'Save symptom'}
      </button>
    </form>
  )
}

function SleepForm({
  onSave,
}: {
  onSave: (data: {
    startAt: string
    wakeAt: string
    quality: number
    notes?: string
  }) => Promise<void>
}) {
  const defaultStart = () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    d.setHours(23, 0, 0, 0)
    return toLocalInputValue(d)
  }
  const [startAt, setStartAt] = useState(defaultStart)
  const [wakeAt, setWakeAt] = useState(toLocalInputValue())
  const [quality, setQuality] = useState(3)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const duration = useMemo(
    () => sleepDurationHours(new Date(startAt).toISOString(), new Date(wakeAt).toISOString()),
    [startAt, wakeAt],
  )

  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
          await onSave({
            startAt: new Date(startAt).toISOString(),
            wakeAt: new Date(wakeAt).toISOString(),
            quality,
            notes: notes.trim() || undefined,
          })
          setNotes('')
        } finally {
          setSaving(false)
        }
      }}
    >
      <div className="split-fields">
        <label className="field">
          Sleep start
          <input
            className="input"
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
          />
        </label>
        <label className="field">
          Wake time
          <input
            className="input"
            type="datetime-local"
            value={wakeAt}
            onChange={(e) => setWakeAt(e.target.value)}
          />
        </label>
      </div>
      <p className="duration-pill">Duration {formatDuration(duration)}</p>
      <ScalePicker
        label="Sleep quality"
        min={1}
        max={5}
        value={quality}
        onChange={setQuality}
        hint="1 restless · 5 restorative"
      />
      <label className="field">
        Notes <span className="hint">(optional)</span>
        <textarea
          className="input textarea"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Woke up multiple times, restless…"
        />
      </label>
      <button className="btn primary" type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save sleep'}
      </button>
    </form>
  )
}

function MedicationForm({
  suggestions,
  symptoms,
  onSave,
}: {
  suggestions: string[]
  symptoms: { id: string; name: string; onsetAt: string }[]
  onSave: (data: {
    name: string
    dose: string
    takenAt: string
    linkedSymptomId?: string
    notes?: string
  }) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [takenAt, setTakenAt] = useState(toLocalInputValue())
  const [linkedSymptomId, setLinkedSymptomId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const recentSymptoms = symptoms.slice(0, 12)

  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim() || !dose.trim()) return
        setSaving(true)
        try {
          await onSave({
            name: name.trim(),
            dose: dose.trim(),
            takenAt: new Date(takenAt).toISOString(),
            linkedSymptomId: linkedSymptomId || undefined,
            notes: notes.trim() || undefined,
          })
          setDose('')
          setNotes('')
          setTakenAt(toLocalInputValue())
        } finally {
          setSaving(false)
        }
      }}
    >
      <NamePicker
        label="Medication"
        value={name}
        suggestions={suggestions}
        onChange={setName}
        placeholder="e.g. ibuprofen"
      />
      <label className="field">
        Dose
        <input
          className="input"
          value={dose}
          onChange={(e) => setDose(e.target.value)}
          placeholder="e.g. 200mg"
        />
      </label>
      <label className="field">
        Time taken
        <input
          className="input"
          type="datetime-local"
          value={takenAt}
          onChange={(e) => setTakenAt(e.target.value)}
        />
      </label>
      <label className="field">
        Link to symptom <span className="hint">(optional)</span>
        <select
          className="input"
          value={linkedSymptomId}
          onChange={(e) => setLinkedSymptomId(e.target.value)}
        >
          <option value="">None</option>
          {recentSymptoms.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {new Date(s.onsetAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Notes <span className="hint">(optional)</span>
        <textarea
          className="input textarea"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <button className="btn primary" type="submit" disabled={!name.trim() || !dose.trim() || saving}>
        {saving ? 'Saving…' : 'Save medication'}
      </button>
    </form>
  )
}

function ContextForm({
  cycleEnabled,
  hydrationUnit,
  hasZip,
  onSave,
}: {
  cycleEnabled: boolean
  hydrationUnit: 'oz' | 'glasses'
  hasZip: boolean
  onSave: (data: {
    date: string
    stressLevel?: number
    dietNotes?: string
    dietTags?: DietTag[]
    hydrationOz?: number
    activityType?: string
    activityIntensity?: number
    cyclePhase?: CyclePhase
    location?: LocationTag[]
    notes?: string
    fetchWeather?: boolean
  }) => Promise<void>
}) {
  const [date, setDate] = useState(toDateKey())
  const [stressLevel, setStressLevel] = useState(3)
  const [dietNotes, setDietNotes] = useState('')
  const [dietTags, setDietTags] = useState<DietTag[]>([])
  const [hydration, setHydration] = useState(6)
  const [activityType, setActivityType] = useState('')
  const [activityIntensity, setActivityIntensity] = useState(3)
  const [cyclePhase, setCyclePhase] = useState<CyclePhase | ''>('')
  const [location, setLocation] = useState<LocationTag[]>([])
  const [notes, setNotes] = useState('')
  const [extraOpen, setExtraOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const hydrationOz = hydrationUnit === 'glasses' ? hydration * 8 : hydration

  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
          await onSave({
            date,
            stressLevel: extraOpen ? stressLevel : undefined,
            dietNotes: dietNotes.trim() || undefined,
            dietTags: dietTags.length ? dietTags : undefined,
            hydrationOz: extraOpen ? hydrationOz : undefined,
            activityType: extraOpen && activityType.trim() ? activityType.trim() : undefined,
            activityIntensity:
              extraOpen && activityType.trim() ? activityIntensity : undefined,
            cyclePhase: extraOpen && cycleEnabled && cyclePhase ? cyclePhase : undefined,
            location: location.length ? location : undefined,
            notes: extraOpen && notes.trim() ? notes.trim() : undefined,
            fetchWeather: true,
          })
          setDietNotes('')
          setDietTags([])
          setActivityType('')
          setNotes('')
        } finally {
          setSaving(false)
        }
      }}
    >
      <label className="field">
        Date
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      <ChipSelect
        label="Diet tags"
        multi
        options={DIET_TAGS.map((t) => ({ value: t, label: t }))}
        value={dietTags}
        onChange={(v) => setDietTags(v as DietTag[])}
      />

      <label className="field">
        Diet notes <span className="hint">(optional)</span>
        <input
          className="input"
          value={dietNotes}
          onChange={(e) => setDietNotes(e.target.value)}
          placeholder="What stood out today"
        />
      </label>

      <ChipSelect
        label="Location / environment"
        multi
        options={LOCATION_TAGS.map((t) => ({ value: t, label: t }))}
        value={location}
        onChange={(v) => setLocation(v as LocationTag[])}
      />

      <details
        className="collapsible"
        onToggle={(e) => setExtraOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary>Add more context</summary>
        <div className="collapsible-body">
          <div className="form-stack nested">
            <ScalePicker label="Stress level" min={1} max={5} value={stressLevel} onChange={setStressLevel} />
            <label className="field">
              Hydration ({hydrationUnit === 'glasses' ? 'glasses' : 'oz'})
              <input
                className="input"
                type="number"
                min={0}
                step={1}
                value={hydration}
                onChange={(e) => setHydration(Number(e.target.value))}
              />
            </label>
            <label className="field">
              Activity / exercise
              <input
                className="input"
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                placeholder="Walk, yoga, gym…"
              />
            </label>
            {activityType.trim() ? (
              <ScalePicker
                label="Intensity"
                min={1}
                max={5}
                value={activityIntensity}
                onChange={setActivityIntensity}
              />
            ) : null}
            {cycleEnabled ? (
              <ChipSelect
                label="Cycle phase"
                options={CYCLE_PHASES}
                value={cyclePhase}
                onChange={(v) => setCyclePhase(v as CyclePhase | '')}
              />
            ) : null}
            <label className="field">
              Notes
              <textarea
                className="input textarea"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </div>
        </div>
      </details>

      <p className="helper">
        {hasZip
          ? 'Weather & barometric pressure will be fetched automatically from your saved location.'
          : 'Set a zip/location in Settings to auto-log weather with context entries.'}
      </p>

      <button className="btn primary" type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save daily context'}
      </button>
    </form>
  )
}
