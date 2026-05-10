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

        // Sync visual state: grey out body of any column whose header isn't in the
        // active zones list (deleted / hidden in the app). Restore default fill on
        // active columns so re-activated zones lose their grey overlay.
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
// Body background palette (header row 1 is never touched).
const WORKDAY_BG = '#ffffff';   // Mon-Fri on active columns
const WEEKEND_BG = '#d9d9d9';   // Sat-Sun on active columns (week separator)
const HIDDEN_BG  = '#f4cccc';   // Hidden/deleted columns — light pink

// Returns true if cell value parses as a Saturday or Sunday.
function isWeekendDate(cell) {
  let d = null;
  if (cell instanceof Date) {
    d = cell;
  } else if (typeof cell === 'string' && cell.indexOf('.') !== -1) {
    const p = cell.split('.');
    if (p.length === 3) {
      const dt = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
      if (!isNaN(dt.getTime())) d = dt;
    }
  }
  if (!d) return false;
  const day = d.getDay();
  return day === 0 || day === 6;
}

// Repaints the body (rows 2+) of the Aantal sheet:
//   - Hidden / deleted zone columns         -> HIDDEN_BG (whole body)
//   - Active columns (zones, AUTO's, Datum) -> WEEKEND_BG on Sat-Sun rows,
//                                              WORKDAY_BG on Mon-Fri rows
// Header row stays untouched so column titles keep their original styling.
function applyZoneVisualState(sheet, activeZones) {
  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2 || lastCol < 1) return;

  const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0]
    .map(h => h.toString().trim());
  const dateCells = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  const activeSet = {};
  activeZones.forEach(z => { activeSet[z.toString().trim()] = true; });

  const hiddenCol = headers.map(h => {
    if (!h) return false;
    if (PROTECTED_HEADERS.indexOf(h) !== -1) return false;
    return !activeSet[h];
  });

  const weekendRow = dateCells.map(r => isWeekendDate(r[0]));

  const colors = [];
  for (let r = 0; r < weekendRow.length; r++) {
    const row = [];
    for (let c = 0; c < headers.length; c++) {
      if (hiddenCol[c]) {
        row.push(HIDDEN_BG);
      } else if (weekendRow[r]) {
        row.push(WEEKEND_BG);
      } else {
        row.push(WORKDAY_BG);
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

  applyZoneVisualState(sheet, allZones);
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
