# Daymark

Personal symptom, sleep, medication, and daily-context tracker. Installable PWA, works offline, syncs to Google Sheets via an Apps Script Web App.

## Features

- **Quick log**: symptoms (1–10), sleep (duration auto-calc + quality 1–5), medications, daily context
- **History**: day-grouped timeline with symptom/date filters
- **Trends**: severity & sleep charts plus low-sleep vs high-sleep severity callouts
- **Export/import**: JSON + CSV backup
- **Sheets sync**: local retry queue → configurable Apps Script URL
- **Weather**: Open-Meteo auto-fetch from a saved zip/location on context entries

## Develop

```bash
npm install
npm run dev
```

```bash
npm run build
npm run preview
```

## GitHub Pages (phone-friendly)

After the repo is at `aarontriefler-pixel/daymark`:

1. GitHub → **Settings → Pages**
2. Source: **GitHub Actions**
3. Push to `main` (or run the **Deploy GitHub Pages** workflow)

Live URL:

`https://aarontriefler-pixel.github.io/daymark/`

On your phone: open that link → Share/Browser menu → **Add to Home Screen**.

## Google Sheets sync

1. Create a Google Sheet.
2. Extensions → Apps Script → paste `google-apps-script/Code.gs`.
3. Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
4. Paste the `/exec` URL into Daymark **Settings**.

Each new entry is queued locally and POSTed as JSON. Failures retry on next load or **Sync now**.

## Notes

- No accounts, no multi-user cloud backend.
- Data lives in IndexedDB on device; use export for backups.
- Cycle-phase field is off until enabled in Settings.
