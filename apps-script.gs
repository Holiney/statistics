// Google Apps Script for Work Stats sync
// IMPORTANT: After editing, MUST deploy a NEW VERSION:
//   "Розгорнути" → "Керування розгортаннями" → ✏️ → Версія: "Нова версія" → "Розгорнути"
// Just saving (Ctrl+S) does NOT update the live webhook URL.

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const contents = e.postData.contents;
    Logger.log("=== doPost START ===");
    Logger.log("Raw payload: " + contents);

    const param = JSON.parse(contents);
    Logger.log("Type: " + param.type);
    Logger.log("allZones: " + JSON.stringify(param.allZones));
    Logger.log("items: " + JSON.stringify(param.items));

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // --- PERSONNEL (Aantal sheet) ---
    if (param.type === 'personnel') {
      const sheet = ss.getSheetByName('Aantal');
      if (!sheet) throw new Error("Аркуш 'Aantal' не знайдено!");

      if (param.allZones && Array.isArray(param.allZones)) {
        // Persist active zones so onOpen() / time triggers can re-apply
        // greying without needing a fresh sync from the app.
        PropertiesService.getScriptProperties()
          .setProperty('activeZones', JSON.stringify(param.allZones));

        const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn())
          .getDisplayValues()[0].map(h => h.toString().trim());
        Logger.log("Existing headers (display): " + existingHeaders.join(", "));

        param.allZones.forEach(zone => {
          const zoneStr = zone.toString().trim();
          if (zoneStr && !existingHeaders.includes(zoneStr)) {
            const newColIdx = sheet.getLastColumn() + 1;
            const lastRow = Math.max(sheet.getLastRow(), 1);
            const newHeaderCell = sheet.getRange(1, newColIdx);

            // Force text format BEFORE setValue so "040" keeps its leading zero
            newHeaderCell.setNumberFormat('@');
            newHeaderCell.setValue(zoneStr);

            // Copy format from the WHOLE template column (B) — not just header —
            // so the new column gets header background, body fill, borders, font, etc.
            const templateColRange = sheet.getRange(1, 2, lastRow, 1);
            templateColRange.copyFormatToRange(sheet, newColIdx, newColIdx, 1, lastRow);

            // copyFormatToRange may have overridden numberFormat; re-apply text on header
            newHeaderCell.setNumberFormat('@');

            existingHeaders.push(zoneStr);
            Logger.log("ADDED new column at " + newColIdx + ": " + zoneStr);
          } else {
            Logger.log("Skipped (exists): " + zoneStr);
          }
        });

        // Sync visual state: grey out body of any column whose header isn't in
        // active zones (deleted / hidden in the app). Active columns are left
        // with no manual fill so the conditional-formatting weekend rule shows.
        SpreadsheetApp.flush();
        applyZoneVisualState(sheet, param.allZones);
        SpreadsheetApp.flush();
      } else {
        Logger.log("WARNING: allZones missing or not array");
      }

      const dateObj = new Date(param.date);
      const tDay = dateObj.getDate();
      const tMonth = dateObj.getMonth();
      const tYear = dateObj.getFullYear();

      const lastRow = sheet.getLastRow();
      const dateValues = sheet.getRange(1, 1, lastRow, 1).getValues().flat();
      let rowIndex = -1;

      for (let i = 0; i < dateValues.length; i++) {
        let cell = dateValues[i];
        if (cell instanceof Date) {
          if (cell.getDate() === tDay && cell.getMonth() === tMonth && cell.getFullYear() === tYear) {
            rowIndex = i + 1; break;
          }
        } else if (typeof cell === 'string' && cell.includes('.')) {
          let p = cell.split('.');
          if (parseInt(p[0]) === tDay && (parseInt(p[1]) - 1) === tMonth && parseInt(p[2]) === tYear) {
            rowIndex = i + 1; break;
          }
        }
      }

      if (rowIndex === -1) {
        Logger.log("ERROR: Date not found");
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: "Дату " + tDay + "." + (tMonth + 1) + "." + tYear + " не знайдено в колонці А аркуша Aantal!"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(h => h.toString().trim());
      Logger.log("Headers after add: " + headers.join(", "));

      for (const [key, val] of Object.entries(param.items)) {
        const colIndex = headers.indexOf(key.toString().trim()) + 1;
        if (colIndex > 0) {
          sheet.getRange(rowIndex, colIndex).setValue(val);
          Logger.log("Wrote " + val + " to row " + rowIndex + ", col " + colIndex + " (" + key + ")");
        } else {
          Logger.log("WARNING: column not found for key: " + key);
        }
      }

      Logger.log("=== doPost END (success) ===");
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    // --- OFFICE (first sheet) ---
    const room = param.room;
    const items = param.items;
    const sheet = ss.getSheets()[0];
    const date = new Date(param.date);
    let weekNum = getWeekNumber(date);

    if (weekNum === 1) weekNum = 2;

    const weekLabel = "Week " + weekNum;
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 2, lastCol).getValues();
    const headerRow1 = headers[0];
    const headerRow2 = headers[1];

    let weekStartIndex = -1;
    for (let i = 0; i < headerRow1.length; i++) {
      if (headerRow1[i] && headerRow1[i].toString().includes(weekLabel)) {
        weekStartIndex = i; break;
      }
    }

    if (weekStartIndex === -1) throw new Error("Тиждень " + weekLabel + " не знайдено.");

    let targetColIndex = -1;
    for (let i = weekStartIndex; i < weekStartIndex + 30 && i < lastCol; i++) {
      if (headerRow2[i].toString().trim() === room.toString().trim()) {
        targetColIndex = i + 1; break;
      }
    }

    if (targetColIndex === -1) {
      let insertIdx = weekStartIndex;
      while (insertIdx < weekStartIndex + 30 && insertIdx < headerRow2.length && headerRow2[insertIdx].toString().trim() !== '') {
        insertIdx++;
      }
      targetColIndex = insertIdx + 1;
      sheet.getRange(2, targetColIndex).setValue(room.toString().trim());
    }

    const itemNames = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues().flat();
    for (const [item, count] of Object.entries(items)) {
      if (count === 0 || count === "–") continue;
      const cleanKey = item.toString().replace(/\s/g, "").toLowerCase();
      let rowIdx = -1;
      for (let r = 0; r < itemNames.length; r++) {
        if (itemNames[r].toString().replace(/\s/g, "").toLowerCase() === cleanKey) {
          rowIdx = r + 1; break;
        }
      }
      if (rowIdx !== -1) sheet.getRange(rowIdx, targetColIndex).setValue(count);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("ERROR: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Columns that must never be greyed out regardless of allZones content.
const PROTECTED_HEADERS = ['Datum', "AUTO's"];
const HIDDEN_BG  = '#f4cccc';   // Hidden/deleted columns — light pink
const WORKDAY_BG = '#e8f0fe';   // Mon-Fri rows on active columns — light blue
const WEEKEND_BG = '#cccccc';   // Sat-Sun rows on active columns — medium grey

// Runs automatically every time someone opens the spreadsheet. Reads the last
// active zone list from ScriptProperties (saved by doPost) and re-applies all
// background colors — weekday/weekend fill on active columns, pink fill on
// hidden zones. No reliance on conditional formatting.
function onOpen(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Aantal');
  if (!sheet) return;

  const stored = PropertiesService.getScriptProperties().getProperty('activeZones');
  let zones = [];
  if (stored) {
    try { zones = JSON.parse(stored); } catch (err) { zones = []; }
  }
  applyZoneVisualState(sheet, zones);
}

// Returns true if a column-A cell value parses as Saturday or Sunday.
// Handles both real Date cells and dd.mm.yyyy text dates the app produces.
// tz must be the spreadsheet timezone string (e.g. "Europe/Brussels") to
// avoid UTC-offset errors when Apps Script's getDay() disagrees with local noon.
function isWeekendDate(cell, tz) {
  let d = null;
  if (cell instanceof Date) {
    d = cell;
  } else if (typeof cell === 'string' && cell.indexOf('.') !== -1) {
    const p = cell.split('.');
    if (p.length === 3) {
      // Build as UTC so local-TZ offset in new Date(y,m,d) doesn't shift the day.
      const dt = new Date(Date.UTC(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0])));
      if (!isNaN(dt.getTime())) d = dt;
    }
  } else if (typeof cell === 'number' && cell > 0) {
    d = new Date(Date.UTC(1899, 11, 30) + cell * 86400000);
  }
  if (!d || isNaN(d.getTime())) return null;
  // Format as yyyy-MM-dd in the spreadsheet TZ, then re-parse as UTC midnight
  // so getUTCDay() is immune to the execution environment's TZ offset.
  try {
    const s = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    const parts = s.split('-');
    const utcD = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
    const day = utcD.getUTCDay(); // 0=Sun, 6=Sat
    return day === 0 || day === 6;
  } catch (e) {
    return null;
  }
}

// Repaints rows 2+ of the Aantal sheet in one batch:
//   - Hidden / deleted zone columns -> HIDDEN_BG (whole body, all rows)
//   - Active columns on Sat/Sun rows -> WEEKEND_BG
//   - Active columns on Mon-Fri rows -> WORKDAY_BG
//   - Rows with no date in column A -> null (left blank)
// Header row 1 is never touched.
function applyZoneVisualState(sheet, activeZones) {
  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2 || lastCol < 1) return;

  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0]
    .map(h => h.toString().trim());
  const dateCells = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  const activeSet = {};
  activeZones.forEach(z => { activeSet[z.toString().trim()] = true; });
  Logger.log("applyZoneVisualState: tz=" + tz + " activeZones=" + JSON.stringify(activeZones));
  Logger.log("headers=" + JSON.stringify(headers));

  // Per-column flag: true if this column should be greyed (hidden/deleted).
  const isHiddenCol = headers.map(h => {
    if (!h) return false;
    if (PROTECTED_HEADERS.indexOf(h) !== -1) return false;
    return !activeSet[h];
  });

  // Per-row weekend flag (null if no parseable date in column A).
  const weekendRow = dateCells.map(r => isWeekendDate(r[0], tz));

  const colors = [];
  for (let r = 0; r < dateCells.length; r++) {
    const row = [];
    const w = weekendRow[r];
    for (let c = 0; c < headers.length; c++) {
      if (isHiddenCol[c]) {
        row.push(HIDDEN_BG);
      } else if (w === true) {
        row.push(WEEKEND_BG);
      } else if (w === false) {
        row.push(WORKDAY_BG);
      } else {
        row.push(null);
      }
    }
    colors.push(row);
  }

  sheet.getRange(2, 1, lastRow - 1, lastCol).setBackgrounds(colors);
  Logger.log("Repainted body: " + (lastRow - 1) + " rows x " + lastCol + " cols");
}

function testAddColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Aantal');

  const allZones = ["220", "230", "240", "250", "260", "520", "040", "050"];

  const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0].map(h => h.toString().trim());

  Logger.log("Existing headers: " + existingHeaders.join(", "));

  allZones.forEach(zone => {
    if (!existingHeaders.includes(zone)) {
      const newColIdx = sheet.getLastColumn() + 1;
      const lastRow = Math.max(sheet.getLastRow(), 1);
      const newHeaderCell = sheet.getRange(1, newColIdx);
      newHeaderCell.setNumberFormat('@');
      newHeaderCell.setValue(zone);

      const templateColRange = sheet.getRange(1, 2, lastRow, 1);
      templateColRange.copyFormatToRange(sheet, newColIdx, newColIdx, 1, lastRow);

      newHeaderCell.setNumberFormat('@');
      existingHeaders.push(zone);
      Logger.log("Added new column: " + zone);
    } else {
      Logger.log("Already exists: " + zone);
    }
  });

  PropertiesService.getScriptProperties().setProperty('activeZones', JSON.stringify(allZones));
  applyZoneVisualState(sheet, allZones);
}

// Run this manually any time to re-paint the whole Aantal body using the last
// active-zones list from ScriptProperties. Useful for testing / fixing without
// needing a sync from the app.
function repaintNow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Aantal');
  if (!sheet) return;
  const stored = PropertiesService.getScriptProperties().getProperty('activeZones');
  let zones = [];
  if (stored) {
    try { zones = JSON.parse(stored); } catch (err) { zones = []; }
  }
  Logger.log("Active zones from props: " + JSON.stringify(zones));
  applyZoneVisualState(sheet, zones);
}

// Drops any leftover conditional-formatting rules from the previous CF-based
// approach so they don't conflict with the new direct painting.
function clearConditionalFormatting() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Aantal');
  if (!sheet) return;
  sheet.setConditionalFormatRules([]);
  Logger.log("Cleared all conditional formatting rules on Aantal.");
}

// Run this ONCE to fix existing zone columns that lost leading zeros.
// It re-formats all header cells in row 1 as text — your existing data
// is preserved, but "40" will display as "40" (you may need to manually
// rename it to "040" in the cell if the app expects "040").
function fixHeadersTextFormat() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Aantal');
  const lastCol = sheet.getLastColumn();
  const headerRange = sheet.getRange(1, 1, 1, lastCol);
  headerRange.setNumberFormat('@');
  Logger.log("Set text format on all " + lastCol + " header cells.");
  Logger.log("Headers: " + headerRange.getDisplayValues()[0].join(", "));
}

// Run this to diagnose painting issues. Shows stored zones, headers, and
// how the first 5 date cells are interpreted (type, value, weekend flag).
function debugZoneState() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Aantal');
  if (!sheet) { Logger.log("Sheet 'Aantal' not found!"); return; }

  const stored = PropertiesService.getScriptProperties().getProperty('activeZones');
  Logger.log("Stored activeZones: " + stored);

  const tz = ss.getSpreadsheetTimeZone();
  Logger.log("Spreadsheet timezone: " + tz);

  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  Logger.log("Dimensions: " + lastRow + " rows x " + lastCol + " cols");

  const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  Logger.log("Headers: " + JSON.stringify(headers));

  const sampleCount = Math.min(7, lastRow - 1);
  if (sampleCount > 0) {
    const dateCells = sheet.getRange(2, 1, sampleCount, 1).getValues();
    dateCells.forEach(function(row, i) {
      const cell = row[0];
      const isWeekend = isWeekendDate(cell, tz);
      Logger.log("Row " + (i + 2) + ": type=" + typeof cell +
                 " value=" + JSON.stringify(cell) +
                 " isDate=" + (cell instanceof Date) +
                 " isWeekend=" + isWeekend);
    });
  }
}
