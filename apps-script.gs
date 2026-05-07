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
          .getValues()[0].map(h => h.toString().trim());
        Logger.log("Existing headers: " + existingHeaders.join(", "));

        const templateCell = sheet.getRange(1, 2);
        param.allZones.forEach(zone => {
          const zoneStr = zone.toString().trim();
          if (zoneStr && !existingHeaders.includes(zoneStr)) {
            const newColIdx = sheet.getLastColumn() + 1;
            sheet.getRange(1, newColIdx).setValue(zoneStr);
            templateCell.copyFormatToRange(sheet, newColIdx, newColIdx, 1, 1);
            existingHeaders.push(zoneStr);
            Logger.log("ADDED new column at " + newColIdx + ": " + zoneStr);
          } else {
            Logger.log("Skipped (exists): " + zoneStr);
          }
        });
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

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h.toString().trim());
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

function testAddColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Aantal');

  const allZones = ["220", "230", "240", "250", "260", "520", "040", "050"];

  const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0].map(h => h.toString().trim());

  const templateCell = sheet.getRange(1, 2);

  Logger.log("Existing headers: " + existingHeaders.join(", "));

  allZones.forEach(zone => {
    if (!existingHeaders.includes(zone)) {
      const newColIdx = sheet.getLastColumn() + 1;
      sheet.getRange(1, newColIdx).setValue(zone);
      templateCell.copyFormatToRange(sheet, newColIdx, newColIdx, 1, 1);
      existingHeaders.push(zone);
      Logger.log("Added new column: " + zone);
    } else {
      Logger.log("Already exists: " + zone);
    }
  });
}
