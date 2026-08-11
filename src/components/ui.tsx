import type { ReactNode } from 'react'

export function ScalePicker({
  label,
  min,
  max,
  value,
  onChange,
  hint,
}: {
  label: string
  min: number
  max: number
  value: number
  onChange: (n: number) => void
  hint?: string
}) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  return (
    <fieldset className="field">
      <legend>
        {label}
        {hint ? <span className="hint"> · {hint}</span> : null}
      </legend>
      <div className="scale-row" role="radiogroup" aria-label={label}>
        {values.map((n) => (
          <button
            key={n}
            type="button"
            className={`scale-btn ${value === n ? 'is-active' : ''}`}
            aria-pressed={value === n}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  multi = false,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T | T[] | ''
  onChange: (next: T | T[] | '') => void
  multi?: boolean
}) {
  const selected = multi
    ? new Set(Array.isArray(value) ? value : [])
    : new Set(value ? [value as T] : [])

  return (
    <fieldset className="field">
      <legend>{label}</legend>
      <div className="chip-row">
        {options.map((opt) => {
          const active = selected.has(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              className={`chip ${active ? 'is-active' : ''}`}
              aria-pressed={active}
              onClick={() => {
                if (multi) {
                  const next = new Set(selected)
                  if (next.has(opt.value)) next.delete(opt.value)
                  else next.add(opt.value)
                  onChange([...next] as T[])
                } else {
                  onChange(active ? '' : opt.value)
                }
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function NamePicker({
  label,
  value,
  suggestions,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  suggestions: string[]
  onChange: (v: string) => void
  placeholder: string
}) {
  const filtered = suggestions
    .filter((s) => !value || s.toLowerCase().includes(value.toLowerCase()))
    .slice(0, 8)

  return (
    <div className="field">
      <label>
        {label}
        <input
          className="input"
          list={`${label}-list`}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
        />
      </label>
      {filtered.length > 0 ? (
        <div className="chip-row suggestion-row">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              className={`chip ${value === s ? 'is-active' : ''}`}
              onClick={() => onChange(s)}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <datalist id={`${label}-list`}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  )
}

export function Collapsible({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details className="collapsible" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="collapsible-body">{children}</div>
    </details>
  )
}

export function Toast({ message }: { message: string }) {
  if (!message) return null
  return <div className="toast" role="status">{message}</div>
}
