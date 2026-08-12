/**
 * Daymark → Google Sheets sync
 *
 * IMPORTANT: Create this script FROM the Google Sheet
 * (Extensions → Apps Script), not as a standalone project.
 *
 * Setup:
 * 1. Open your Daymark Google Sheet.
 * 2. Extensions → Apps Script → paste this file → Save.
 * 3. Optional standalone only: set SPREADSHEET_ID below.
 * 4. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the /exec URL into Daymark Settings.
 * 6. After edits: Deploy → Manage deployments → ✎ → New version → Deploy.
 *
 * Test: open YOUR_EXEC_URL?action=test
 */

var SPREADSHEET_ID = '';
var SHEET_NAME = 'Entries';

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return handleUpsert_(body.entry, body.sentAt);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = params.action || '';

    if (action === 'test') {
      var now = new Date().toISOString();
      return handleUpsert_(
        {
          id: 'test_' + Date.now(),
          type: 'context',
          createdAt: now,
          updatedAt: now,
          syncedAt: null,
          date: now.slice(0, 10),
          notes: 'Daymark connection test',
        },
        now,
      );
    }

    // Browser-friendly upsert (GitHub Pages → Apps Script POST is unreliable).
    if (action === 'upsert') {
      var raw = params.data || params.payload || '';
      if (!raw) return json_({ ok: false, error: 'Missing data' });
      var parsed = JSON.parse(raw);
      var entry = parsed.entry || parsed;
      var sentAt = parsed.sentAt || new Date().toISOString();
      return handleUpsert_(entry, sentAt);
    }

    var ss = getSpreadsheet_();
    return json_({
      ok: true,
      service: 'Daymark Sheets Sync',
      spreadsheetId: ss.getId(),
      spreadsheetName: ss.getName(),
      sheet: SHEET_NAME,
    });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function handleUpsert_(entry, sentAt) {
  if (!entry || !entry.id) {
    return json_({ ok: false, error: 'Missing entry' });
  }
  upsertEntry_(entry, sentAt);
  return json_({ ok: true, id: entry.id, sheet: SHEET_NAME });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.TEXT,
  );
}

function getSpreadsheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  if (SPREADSHEET_ID && String(SPREADSHEET_ID).trim()) {
    return SpreadsheetApp.openById(String(SPREADSHEET_ID).trim());
  }
  throw new Error(
    'No spreadsheet linked. In your Daymark Sheet use Extensions → Apps Script, ' +
      'or set SPREADSHEET_ID at the top of Code.gs.',
  );
}

function getOrCreateSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  return sheet;
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow([
    'id',
    'type',
    'createdAt',
    'updatedAt',
    'syncedAt',
    'sentAt',
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
    'rawJson',
  ]);
}

function upsertEntry_(entry, sentAt) {
  var sheet = getOrCreateSheet_();
  ensureHeader_(sheet);

  var row = flattenEntry_(entry, sentAt);
  var values = sheet.getDataRange().getValues();
  var foundRow = -1;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(entry.id)) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function flattenEntry_(entry, sentAt) {
  return [
    entry.id || '',
    entry.type || '',
    entry.createdAt || '',
    entry.updatedAt || '',
    entry.syncedAt || '',
    sentAt || new Date().toISOString(),
    entry.name || '',
    entry.severity != null ? entry.severity : '',
    entry.onsetAt || '',
    entry.startAt || '',
    entry.wakeAt || '',
    entry.quality != null ? entry.quality : '',
    entry.dose || '',
    entry.takenAt || '',
    entry.linkedSymptomId || '',
    entry.date || '',
    entry.stressLevel != null ? entry.stressLevel : '',
    entry.dietNotes || '',
    (entry.dietTags || []).join('|'),
    entry.hydrationOz != null ? entry.hydrationOz : '',
    entry.activityType || '',
    entry.activityIntensity != null ? entry.activityIntensity : '',
    entry.cyclePhase || '',
    (entry.location || []).join('|'),
    entry.weather ? JSON.stringify(entry.weather) : '',
    entry.notes || '',
    JSON.stringify(entry),
  ];
}
