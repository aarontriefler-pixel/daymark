/**
 * Daymark → Google Sheets sync
 *
 * Setup:
 * 1. Create a Google Sheet with a tab named "Entries" (or let this script create it).
 * 2. Extensions → Apps Script, paste this file.
 * 3. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the Web App URL into Daymark Settings.
 */

var SHEET_NAME = 'Entries';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var entry = body.entry;
    if (!entry || !entry.id) {
      return json_({ ok: false, error: 'Missing entry' });
    }

    var sheet = getOrCreateSheet_();
    ensureHeader_(sheet);

    var row = flattenEntry_(entry, body.sentAt);
    var idCol = 1;
    var values = sheet.getDataRange().getValues();
    var foundRow = -1;
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][idCol - 1]) === String(entry.id)) {
        foundRow = i + 1;
        break;
      }
    }

    if (foundRow > 0) {
      sheet.getRange(foundRow, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    return json_({ ok: true, id: entry.id });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'Daymark Sheets Sync' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function getOrCreateSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
