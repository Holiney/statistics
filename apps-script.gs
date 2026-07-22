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

    // --- DELETE PERSONNEL ZONE COLUMN (Aantal sheet) ---
    // Called from the app when the user permanently deletes a personnel zone.
    // Removes the entire column matching `param.zone` from the Aantal sheet.
    if (param.type === 'deletePersonnelColumn') {
      const sheet = ss.getSheetByName('Aantal');
      if (!sheet) throw new Error("Аркуш 'Aantal' не знайдено!");
      const target = param.zone.toString().trim();
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
        .getDisplayValues()[0].map(h => h.toString().trim());
      const idx = headers.indexOf(target);
      if (idx === -1) {
        Logger.log("deletePersonnelColumn: header not found: " + target);
      } else if (PROTECTED_HEADERS.indexOf(target) !== -1) {
        Logger.log("deletePersonnelColumn: refused to delete protected header: " + target);
      } else {
        sheet.deleteColumn(idx + 1);
        Logger.log("deletePersonnelColumn: removed column " + (idx + 1) + " (" + target + ")");
        // Also drop it from stored activeZones if it was there.
        const stored = PropertiesService.getScriptProperties().getProperty('activeZones');
        if (stored) {
          try {
            const zones = JSON.parse(stored).filter(z => z.toString().trim() !== target);
            PropertiesService.getScriptProperties().setProperty('activeZones', JSON.stringify(zones));
          } catch (err) {}
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

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
          if (!zoneStr || existingHeaders.includes(zoneStr)) {
            Logger.log("Skipped (exists): " + zoneStr);
            return;
          }

          const lastRow = Math.max(sheet.getLastRow(), 1);
          const newNum = parseInt(zoneStr, 10);

          // Find the first non-protected zone column whose numeric value exceeds
          // the new zone, so we can insert before it (sorted order).
          let insertBeforeCol = null;
          if (!isNaN(newNum)) {
            for (let i = 0; i < existingHeaders.length; i++) {
              const h = existingHeaders[i];
              if (!h || PROTECTED_HEADERS.indexOf(h) !== -1) continue;
              const hNum = parseInt(h, 10);
              if (!isNaN(hNum) && hNum > newNum) {
                insertBeforeCol = i + 1; // 1-based column index
                break;
              }
            }
          }

          let newColIdx;
          if (insertBeforeCol !== null) {
            sheet.insertColumnBefore(insertBeforeCol);
            newColIdx = insertBeforeCol;
            // Shift tracked headers so subsequent zones resolve correctly.
            existingHeaders.splice(insertBeforeCol - 1, 0, zoneStr);
            Logger.log("INSERTED column at " + newColIdx + " (before col " + (insertBeforeCol + 1) + "): " + zoneStr);
          } else {
            newColIdx = sheet.getLastColumn() + 1;
            existingHeaders.push(zoneStr);
            Logger.log("APPENDED new column at " + newColIdx + ": " + zoneStr);
          }

          // Force text format BEFORE setValue so "040" keeps its leading zero
          const newHeaderCell = sheet.getRange(1, newColIdx);
          newHeaderCell.setNumberFormat('@');
          newHeaderCell.setValue(zoneStr);

          // Copy format from the WHOLE template column (B) — not just header —
          // so the new column gets header background, body fill, borders, font, etc.
          sheet.getRange(1, 2, lastRow, 1).copyFormatToRange(sheet, newColIdx, newColIdx, 1, lastRow);

          // copyFormatToRange may have overridden numberFormat; re-apply text on header
          newHeaderCell.setNumberFormat('@');
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

    // --- OFFICE ---
    const room = param.room;
    const items = param.items;

    // Find the Economaatkast sheet by name (case-insensitive prefix match),
    // falling back to the first sheet if not found.
    let sheet = null;
    const allSheets = ss.getSheets();
    for (var s = 0; s < allSheets.length; s++) {
      if (allSheets[s].getName().toLowerCase().indexOf('economaatkast') !== -1) {
        sheet = allSheets[s];
        break;
      }
    }
    if (!sheet) sheet = allSheets[0];
    Logger.log("OFFICE: using sheet '" + sheet.getName() + "' (index " + allSheets.indexOf(sheet) + ")");

    const date = new Date(param.date);

    const isoWeek = (typeof param.week === 'number' ? param.week : getWeekNumber(date));
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 2, lastCol).getValues();
    const headerRow1 = headers[0];
    const headerRow2 = headers[1];

    Logger.log("OFFICE: isoWeek=" + isoWeek + " room=" + room);
    Logger.log("OFFICE headerRow1: " + JSON.stringify(headerRow1));
    Logger.log("OFFICE headerRow2: " + JSON.stringify(headerRow2));

    // The user's sheet labels weeks one number behind ISO 8601
    // (ISO Week 22 -> column "Week 21"). Prefer that, but fall back to the
    // exact ISO label if the shifted column doesn't exist.
    let weekStartIndex = findWeekColumn(headerRow1, isoWeek - 1);
    let usedWeek = isoWeek - 1;
    if (weekStartIndex === -1) {
      weekStartIndex = findWeekColumn(headerRow1, isoWeek);
      usedWeek = isoWeek;
    }
    Logger.log("OFFICE: matched Week " + usedWeek + " at index " + weekStartIndex);

    if (weekStartIndex === -1) {
      // Week header not found in the sheet — auto-create it so data is never lost.
      usedWeek = (isoWeek - 1 >= 1) ? isoWeek - 1 : isoWeek;

      // Find the last non-empty column in row 1, place new header right after.
      var newWeekCol = 0;
      for (var ci = lastCol - 1; ci >= 0; ci--) {
        if (headerRow1[ci] && headerRow1[ci].toString().trim() !== '') {
          newWeekCol = ci + 1; // 0-based index of the new column
          break;
        }
      }
      sheet.getRange(1, newWeekCol + 1).setValue("Week " + usedWeek);
      weekStartIndex = newWeekCol;
      Logger.log("OFFICE: Week " + usedWeek + " not found — auto-created at col " + (newWeekCol + 1));
    }

    let targetColIndex = -1;
    for (let i = weekStartIndex; i < weekStartIndex + 30 && i < lastCol; i++) {
      const cellVal = headerRow2[i] ? headerRow2[i].toString().trim() : '';
      Logger.log("OFFICE: checking row2[" + i + "] = '" + cellVal + "' vs room '" + room + "'");
      if (cellVal === room.toString().trim()) {
        targetColIndex = i + 1; break;
      }
    }
    Logger.log("OFFICE: targetColIndex=" + targetColIndex);

    if (targetColIndex === -1) {
      let insertIdx = weekStartIndex;
      while (insertIdx < weekStartIndex + 30 && insertIdx < headerRow2.length && headerRow2[insertIdx].toString().trim() !== '') {
        insertIdx++;
      }
      targetColIndex = insertIdx + 1;
      sheet.getRange(2, targetColIndex).setValue(room.toString().trim());
      Logger.log("OFFICE: room not found, created new column at " + targetColIndex);
    }

    const itemNames = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues().flat();
    Logger.log("OFFICE: itemNames (col A) = " + JSON.stringify(itemNames.slice(0, 25)));
    Logger.log("OFFICE: items to write = " + JSON.stringify(items));
    let writtenCount = 0;
    for (const [item, count] of Object.entries(items)) {
      // Skip empty/zero values — note: the app stores '-' (hyphen) for empty
      if (count === 0 || count === '-' || count === '–' || count === '') continue;
      const cleanKey = item.toString().replace(/\s/g, "").toLowerCase();
      let rowIdx = -1;
      for (let r = 0; r < itemNames.length; r++) {
        if (itemNames[r].toString().replace(/\s/g, "").toLowerCase() === cleanKey) {
          rowIdx = r + 1; break;
        }
      }
      if (rowIdx !== -1) {
        sheet.getRange(rowIdx, targetColIndex).setValue(count);
        Logger.log("OFFICE: wrote item '" + item + "' = " + count + " at row " + rowIdx + ", col " + targetColIndex);
        writtenCount++;
      } else {
        Logger.log("OFFICE: item '" + item + "' (cleanKey='" + cleanKey + "') NOT FOUND in column A");
      }
    }
    Logger.log("OFFICE: done, wrote " + writtenCount + " cells");

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

// Finds the column index (0-based) in headerRow1 whose label refers to the
// given week number. Uses a non-digit boundary so "Week 1" does NOT match
// "Week 19", and tolerates "Week19" / "Week 019" / "Week 19 (11/05)" forms.
function findWeekColumn(headerRow1, weekNum) {
  if (weekNum < 1) return -1;
  var re = new RegExp("Week\\s*0*" + weekNum + "(?!\\d)");
  for (var i = 0; i < headerRow1.length; i++) {
    var h = headerRow1[i] ? headerRow1[i].toString() : "";
    if (re.test(h)) return i;
  }
  return -1;
}

// Columns that must never be greyed out regardless of allZones content.
const PROTECTED_HEADERS = ['Datum', "AUTO's"];
const HIDDEN_BG  = '#999999';   // Hidden/deleted columns — dark grey
const WORKDAY_BG = '#b8d4f0';   // Mon-Fri rows on active columns — blue
const WEEKEND_BG = '#999999';   // Sat-Sun rows on active columns — dark grey
const HIDDEN_FG  = '#666666';   // Hidden columns: dimmed text
const DEFAULT_FG = '#000000';   // Active columns: standard black text

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
  const fonts = [];
  for (let r = 0; r < dateCells.length; r++) {
    const row = [];
    const fontRow = [];
    const w = weekendRow[r];
    for (let c = 0; c < headers.length; c++) {
      if (isHiddenCol[c]) {
        row.push(HIDDEN_BG);
        fontRow.push(HIDDEN_FG);
      } else if (w === true) {
        row.push(WEEKEND_BG);
        fontRow.push(DEFAULT_FG);
      } else if (w === false) {
        row.push(WORKDAY_BG);
        fontRow.push(DEFAULT_FG);
      } else {
        row.push(null);
        fontRow.push(DEFAULT_FG);
      }
    }
    colors.push(row);
    fonts.push(fontRow);
  }

  const bodyRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
  bodyRange.setBackgrounds(colors);
  bodyRange.setFontColors(fonts);
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
    const zoneStr = zone.toString().trim();
    if (!zoneStr || existingHeaders.includes(zoneStr)) {
      Logger.log("Already exists: " + zoneStr);
      return;
    }
    const lastRow = Math.max(sheet.getLastRow(), 1);
    const newNum = parseInt(zoneStr, 10);
    let insertBeforeCol = null;
    if (!isNaN(newNum)) {
      for (let i = 0; i < existingHeaders.length; i++) {
        const h = existingHeaders[i];
        if (!h || PROTECTED_HEADERS.indexOf(h) !== -1) continue;
        const hNum = parseInt(h, 10);
        if (!isNaN(hNum) && hNum > newNum) { insertBeforeCol = i + 1; break; }
      }
    }
    let newColIdx;
    if (insertBeforeCol !== null) {
      sheet.insertColumnBefore(insertBeforeCol);
      newColIdx = insertBeforeCol;
      existingHeaders.splice(insertBeforeCol - 1, 0, zoneStr);
    } else {
      newColIdx = sheet.getLastColumn() + 1;
      existingHeaders.push(zoneStr);
    }
    const newHeaderCell = sheet.getRange(1, newColIdx);
    newHeaderCell.setNumberFormat('@');
    newHeaderCell.setValue(zoneStr);
    sheet.getRange(1, 2, lastRow, 1).copyFormatToRange(sheet, newColIdx, newColIdx, 1, lastRow);
    newHeaderCell.setNumberFormat('@');
    Logger.log("Added column at " + newColIdx + ": " + zoneStr);
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

// Simulates exactly what the app sends. Run manually from the editor.
// If this writes values → the logic is correct and the HTTP payload is the problem.
// If this does NOT write → there is a bug in doPost itself.
// Sends a real HTTP POST to the deployed URL — exactly like the app does.
// If this writes data → deployed code is correct, problem is in the app's payload.
// If this doesn't write → deployed code is old/broken.
function testHttpPost() {
  const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzgovsIQyZPGdeWR-x4UBuoJRNtSM7n3Q7QYDWg2VTdRuR2RrmXSrriV7Uw8a82FmMc9Q/exec';
  const payload = {
    date: "2026-07-22T12:00:00",
    year: 2026,
    week: 29,
    room: "220",
    items: { "EK 1": 55, "EK 3": 44 }
  };
  Logger.log("Sending HTTP POST to deployed URL (week 29, room 220)...");
  const response = UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'text/plain',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  Logger.log("HTTP status: " + response.getResponseCode());
  Logger.log("Response: " + response.getContentText());
  Logger.log("Done — check sheet for 55/44 in room 220, current week");
}

function testDoPostOffice() {
  const fakePayload = {
    date: "2026-07-22T12:00:00",
    year: 2026,
    week: 29,       // Current ISO week (July 22, 2026)
    room: "220",    // Non-black room — one the user says doesn't work
    items: { "EK 1": 99, "EK 2": 88, "EK 5": 77 }
  };

  Logger.log("=== testDoPostOffice: week 29, room 220 ===");
  Logger.log("Payload: " + JSON.stringify(fakePayload));

  const fakeE = { postData: { contents: JSON.stringify(fakePayload) } };
  const result = doPost(fakeE);
  Logger.log("doPost result: " + result.getContent());
  Logger.log("=== done — check the sheet for 99/88/77 in room 220, Week 28/29 ===");
}

// Run this manually to diagnose the Office (Канцелярія) write issue.
// Select this function in the dropdown and click "Запустити".
// Results appear immediately in the bottom "Журнал виконання" panel.
function debugOffice() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Find Economaatkast sheet
  const allSheets = ss.getSheets();
  let sheet = null;
  for (var i = 0; i < allSheets.length; i++) {
    if (allSheets[i].getName().toLowerCase().indexOf('economaatkast') !== -1) {
      sheet = allSheets[i]; break;
    }
  }
  if (!sheet) sheet = allSheets[0];
  Logger.log("Sheet: '" + sheet.getName() + "'  size: " + sheet.getLastRow() + "r x " + sheet.getLastColumn() + "c");

  const lastCol = sheet.getLastColumn();

  // 2. Read ALL of row 1 — search for weeks 21/22 (historical) AND current weeks 27-30
  const row1full = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var weekCols = {};
  [21, 22, 27, 28, 29, 30].forEach(function(wn) {
    var re = new RegExp("Week\\s*0*" + wn + "(?!\\d)");
    for (var c = 0; c < row1full.length; c++) {
      var h = row1full[c] ? row1full[c].toString() : "";
      if (re.test(h)) { weekCols[wn] = c; break; }
    }
    Logger.log("Week " + wn + " col (0-based): " + (weekCols[wn] !== undefined ? weekCols[wn] + "  value: '" + row1full[weekCols[wn]] + "'" : "NOT FOUND"));
  });

  // 3. If found, show rooms row and attempt test write
  // Prefer current week 28/29; fall back to 21/22 for historical reference
  var targetWeekCol = weekCols[28] !== undefined ? weekCols[28] :
                      weekCols[29] !== undefined ? weekCols[29] :
                      weekCols[21] !== undefined ? weekCols[21] :
                      weekCols[22] !== undefined ? weekCols[22] : -1;
  if (targetWeekCol >= 0) {
    const row2slice = sheet.getRange(2, targetWeekCol + 1, 1, 14).getValues()[0];
    Logger.log("Row 2 rooms under that week: " + JSON.stringify(row2slice));

    // Try to write TEST to EK 1 row, first room column
    var testCol = targetWeekCol + 2; // +1 for 1-based, +1 to skip week-label col → first room
    Logger.log("Writing TEST to row 3, col " + testCol + " ...");
    sheet.getRange(3, testCol).setValue("TEST");
    Logger.log("Write OK — check the sheet now!");
  } else {
    Logger.log("PROBLEM: Neither Week 21 nor Week 22 found in 600 columns!");
    Logger.log("First 5 non-empty row-1 values: " + row1full.filter(function(v){ return v !== ""; }).slice(0, 5).join(" | "));
  }
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
