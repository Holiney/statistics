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

        ensureConditionalFormatting(sheet);

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
// active zone list from ScriptProperties (saved by doPost) and re-applies the
// hidden-column greying. The weekend coloring is handled by a conditional
// formatting rule that reacts to new rows automatically — no script needed.
function onOpen(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Aantal');
  if (!sheet) return;

  ensureConditionalFormatting(sheet);

  const stored = PropertiesService.getScriptProperties().getProperty('activeZones');
  if (stored) {
    try {
      applyZoneVisualState(sheet, JSON.parse(stored));
    } catch (err) {
      Logger.log('onOpen failed to apply visual state: ' + err);
    }
  }
}

// Installs two conditional-formatting rules on Aantal!A2:ZZ:
//   - Sat/Sun rows -> WEEKEND_BG (medium grey)
//   - Mon-Fri rows -> WORKDAY_BG (light blue)
// Both check that column A has a date so empty rows below the data stay clean.
// Replaces any previously-installed Work Stats rules; other rules are kept.
function ensureConditionalFormatting(sheet) {
  const range = sheet.getRange("A2:ZZ");

  // Handles both real Date cells (ISNUMBER true) and text dates like
  // "05.01.2026" (DATEVALUE parses dd.mm.yyyy in this locale). IFERROR
  // wraps the comparison so non-date rows fall through cleanly.
  const weekendFormula = '=AND($A2<>"",IFERROR(WEEKDAY(IF(ISNUMBER($A2),$A2,DATEVALUE($A2)),2)>5,FALSE))';
  const workdayFormula = '=AND($A2<>"",IFERROR(WEEKDAY(IF(ISNUMBER($A2),$A2,DATEVALUE($A2)),2)<6,FALSE))';
  const ourFormulas = [weekendFormula, workdayFormula];

  // Known prior versions of our formulas, so we drop them all when re-installing.
  const legacyFormulas = [
    '=AND($A2<>"",WEEKDAY($A2,2)>5)',
    '=AND($A2<>"",WEEKDAY($A2,2)<6)',
  ];
  const isOurs = (f) => ourFormulas.indexOf(f) !== -1 || legacyFormulas.indexOf(f) !== -1;

  // Drop any previous Work Stats rules so we can re-install fresh ones
  // (idempotent: re-running just reinstalls, no duplicates accumulate).
  const kept = sheet.getConditionalFormatRules().filter(r => {
    const cond = r.getBooleanCondition && r.getBooleanCondition();
    if (!cond) return true;
    const vals = cond.getCriteriaValues && cond.getCriteriaValues();
    if (!vals) return true;
    return !isOurs(vals[0]);
  });

  const weekendRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(weekendFormula)
    .setBackground(WEEKEND_BG)
    .setRanges([range])
    .build();

  const workdayRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(workdayFormula)
    .setBackground(WORKDAY_BG)
    .setRanges([range])
    .build();

  // Weekend rule goes first so it wins over the workday rule on Sat/Sun rows.
  sheet.setConditionalFormatRules([weekendRule, workdayRule].concat(kept));
  Logger.log('Installed weekend + workday conditional-formatting rules.');
}

// Greys the body (rows 2+) of any column whose header isn't in `activeZones`,
// and clears manual fill on active columns so the weekend conditional rule
// can paint Sat/Sun rows. Header row 1 is left untouched.
function applyZoneVisualState(sheet, activeZones) {
  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2 || lastCol < 1) return;

  const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0]
    .map(h => h.toString().trim());

  const activeSet = {};
  activeZones.forEach(z => { activeSet[z.toString().trim()] = true; });

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (!header) continue;

    const bodyRange = sheet.getRange(2, i + 1, lastRow - 1, 1);
    const isProtected = PROTECTED_HEADERS.indexOf(header) !== -1;

    if (isProtected || activeSet[header]) {
      // Clear manual background so conditional formatting (weekend rule) shows.
      bodyRange.setBackground(null);
    } else {
      // Hidden / deleted zone — solid grey overrides the weekend CF rule.
      bodyRange.setBackground(HIDDEN_BG);
      Logger.log("Greyed col " + (i + 1) + " (" + header + ")");
    }
  }
}

function testAddColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Aantal');

  const allZones = ["220", "230", "240", "250", "260", "520", "040", "050"];

  ensureConditionalFormatting(sheet);

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

// Run this ONCE manually to clean up any stray manual backgrounds left over
// from the previous version of applyZoneVisualState (which painted every cell).
// After this runs, the conditional-formatting weekend rule + per-column hidden
// greying take over, and you don't need to re-run it.
function clearAllManualBackgrounds() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Aantal');
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return;
  sheet.getRange(2, 1, lastRow - 1, lastCol).setBackground(null);
  Logger.log("Cleared manual backgrounds on body (rows 2-" + lastRow + ", cols 1-" + lastCol + ")");
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
