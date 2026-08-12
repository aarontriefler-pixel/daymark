/**
 * Daymark → Google Sheets sync
 *
 * IMPORTANT: Create this script FROM the Google Sheet
 * (Extensions → Apps Script), not as a standalone project.
 * Otherwise the script has no spreadsheet to write to.
 *
 * Setup:
 * 1. Create/open your Daymark Google Sheet.
 * 2. Extensions → Apps Script → paste this file → Save.
 * 3. Optional: if you must use a standalone script, paste the Sheet ID
 *    below (from docs.google.com/spreadsheets/d/SHEET_ID/edit).
 * 4. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web App URL (must end in /exec) into Daymark Settings.
 * 6. After any script change: Deploy → Manage deployments → ✎ Edit
 *    → Version: New version → Deploy.
 *
 * Test: open
 *   YOUR_EXEC_URL?action=test
 * in a browser. You should see {"ok":true,...} and a Test row in Entries.
 */

// Paste Sheet ID only if this is a STANDALONE script (not opened via Extensions).
var SPREADSHEET_ID = '';

var SHEET_NAME = 'Entries';

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var entry = body.entry;
    if (!entry || !entry.id) {
      return json_({ ok: false, error: 'Missing entry' });
    }

    upsertEntry_(entry, body.sentAt);
    return json_({ ok: true, id: entry.id });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || '';
    if (action === 'test') {
      var now = new Date().toISOString();
      var testEntry = {
        id: 'test_' + Date.now(),
        type: 'context',
        createdAt: now,
        updatedAt: now,
        syncedAt: null,
        date: now.slice(0, 10),
        notes: 'Daymark connection test',
      };
      upsertEntry_(testEntry, now);
      return json_({
        ok: true,
        service: 'Daymark Sheets Sync',
        wroteTestRow: true,
        id: testEntry.id,
        spreadsheetId: getSpreadsheet_().getId(),
        sheet: SHEET_NAME,
      });
    }
    // Health check — confirms the web app is reachable and bound.
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

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function getSpreadsheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  if (SPREADSHEET_ID && String(SPREADSHEET_ID).trim()) {
    return SpreadsheetApp.openById(String(SPREADSHEET_ID).trim());
  }
  throw new Error(
    'No spreadsheet linked. In your Daymark Sheet use Extensions → Apps Script ' +
      '(recommended), or set SPREADSHEET_ID at the top of Code.gs.',
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
