import { useEffect, useRef, useState } from 'react'
import { Toast } from '../components/ui'
import { useTracker } from '../hooks/useTracker'
import {
  downloadText,
  entriesToCsv,
  entriesToJson,
  parseImportJson,
} from '../lib/export'
import type { AppSettings } from '../types'

export function Settings() {
  const {
    settings,
    saveAppSettings,
    syncNow,
    queueCount,
    lastSyncMessage,
    entries,
    importEntries,
  } = useTracker()
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [toast, setToast] = useState('')
  const [syncing, setSyncing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => setDraft(settings), [settings])

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2400)
  }

  return (
    <div className="page">
      <header className="page-hero compact">
        <p className="brand">Daymark</p>
        <h1>Settings</h1>
        <p className="lede">Sync, weather location, and optional fields.</p>
      </header>

      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault()
          await saveAppSettings({
            ...draft,
            appsScriptUrl: draft.appsScriptUrl.trim(),
            zipCode: draft.zipCode.trim(),
          })
          flash('Settings saved')
        }}
      >
        <label className="field">
          Google Apps Script Web App URL
          <input
            className="input"
            type="url"
            value={draft.appsScriptUrl}
            onChange={(e) => setDraft({ ...draft, appsScriptUrl: e.target.value })}
            placeholder="https://script.google.com/macros/s/…/exec"
          />
        </label>
        <p className="helper">
          Deploy the script in <code>google-apps-script/Code.gs</code> as a Web App (Anyone can
          access), then paste the <code>/exec</code> URL here. Entries POST as JSON on save and
          retry if offline. If sync fails: confirm access is Anyone, URL ends in /exec, and
          you created a New deployment (not just Saved).
        </p>

        <label className="field">
          Zip / location (for weather)
          <input
            className="input"
            value={draft.zipCode}
            onChange={(e) => setDraft({ ...draft, zipCode: e.target.value })}
            placeholder="e.g. 10001 or city name"
          />
        </label>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={draft.cycleTrackingEnabled}
            onChange={(e) =>
              setDraft({ ...draft, cycleTrackingEnabled: e.target.checked })
            }
          />
          <span>Enable menstrual cycle phase field</span>
        </label>

        <label className="field">
          Hydration unit
          <select
            className="input"
            value={draft.hydrationUnit}
            onChange={(e) =>
              setDraft({
                ...draft,
                hydrationUnit: e.target.value as AppSettings['hydrationUnit'],
              })
            }
          >
            <option value="glasses">Glasses (~8 oz)</option>
            <option value="oz">Ounces</option>
          </select>
        </label>

        <button className="btn primary" type="submit">
          Save settings
        </button>
      </form>

      <section className="settings-block">
        <h2>Google Sheets sync</h2>
        <p className="meta-line">
          Queue: {queueCount} pending
          {lastSyncMessage ? ` · ${lastSyncMessage}` : ''}
        </p>
        <button
          type="button"
          className="btn secondary"
          disabled={syncing}
          onClick={async () => {
            setSyncing(true)
            try {
              const result = await syncNow()
              flash(result.message)
            } finally {
              setSyncing(false)
            }
          }}
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </section>

      <section className="settings-block">
        <h2>Export / import</h2>
        <p className="helper">Backup for doctor visits or moving devices. No account required.</p>
        <div className="btn-row">
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              downloadText(
                `daymark-${new Date().toISOString().slice(0, 10)}.json`,
                entriesToJson(entries),
                'application/json',
              )
            }
          >
            Export JSON
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              downloadText(
                `daymark-${new Date().toISOString().slice(0, 10)}.csv`,
                entriesToCsv(entries),
                'text/csv',
              )
            }
          >
            Export CSV
          </button>
          <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                const text = await file.text()
                const parsed = parseImportJson(text)
                const replace = window.confirm(
                  `Import ${parsed.length} entries?\nOK = merge with existing\nCancel = abort\n\nUse Merge. To replace instead, confirm the next prompt.`,
                )
                if (!replace) return
                const mode = window.confirm('Replace all existing data? (Cancel = merge)')
                  ? 'replace'
                  : 'merge'
                await importEntries(parsed, mode)
                flash(`Imported ${parsed.length} entries (${mode})`)
              } catch (err) {
                flash(err instanceof Error ? err.message : 'Import failed')
              } finally {
                e.target.value = ''
              }
            }}
          />
        </div>
      </section>

      <Toast message={toast} />
    </div>
  )
}
