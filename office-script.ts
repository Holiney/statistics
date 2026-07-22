// Office Script for Microsoft Excel — Aantal Personnel Sync
// ──────────────────────────────────────────────────────────
// Setup:
//   1. Open Economaatkast 2026.xlsx in Excel Online
//   2. Automate tab → New script → paste this file → Save as "AantalSync"
//   3. Set up a Power Automate flow (see README or instructions from developer)
//
// Supported payload types (sent from the app):
//   { type: 'personnel',            date, items, allZones }
//   { type: 'deletePersonnelColumn', zone }

const PROTECTED_HEADERS: string[] = ['Datum', "AUTO's"];
const HIDDEN_BG  = '#999999';  // hidden/deleted zone columns
const WORKDAY_BG = '#b8d4f0';  // Mon–Fri active columns
const WEEKEND_BG = '#999999';  // Sat–Sun active columns
const HIDDEN_FG  = '#666666';  // text on hidden columns
const DEFAULT_FG = '#000000';  // text on active columns

function main(workbook: ExcelScript.Workbook, payloadJson: string): string {
  let param: {
    type: string;
    zone?: string;
    allZones?: string[];
    date?: string;
    items?: Record<string, number>;
  };

  try {
    param = JSON.parse(payloadJson);
  } catch (e) {
    return JSON.stringify({ status: 'error', message: 'Invalid JSON: ' + String(e) });
  }

  const sheet = workbook.getWorksheet('Aantal');
  if (!sheet) {
    return JSON.stringify({ status: 'error', message: "Worksheet 'Aantal' not found" });
  }

  if (param.type === 'deletePersonnelColumn') {
    return handleDelete(sheet, (param.zone || '').toString().trim());
  }

  if (param.type === 'personnel') {
    return handlePersonnel(sheet, param);
  }

  return JSON.stringify({ status: 'error', message: 'Unknown type: ' + param.type });
}

// ─── Delete a zone column ─────────────────────────────────────────────────────
function handleDelete(sheet: ExcelScript.Worksheet, target: string): string {
  if (!target) return JSON.stringify({ status: 'error', message: 'Zone name is empty' });
  if (PROTECTED_HEADERS.includes(target)) {
    return JSON.stringify({ status: 'error', message: `'${target}' is protected` });
  }

  const headers = getHeaders(sheet);
  const idx = headers.indexOf(target);
  if (idx === -1) {
    return JSON.stringify({ status: 'error', message: `Column '${target}' not found` });
  }

  const col = columnLetter(idx);
  sheet.getRange(`${col}:${col}`).delete(ExcelScript.DeleteShiftDirection.left);
  return JSON.stringify({ status: 'success' });
}

// ─── Write personnel counts ───────────────────────────────────────────────────
function handlePersonnel(
  sheet: ExcelScript.Worksheet,
  param: { allZones?: string[]; date?: string; items?: Record<string, number> }
): string {
  let headers = getHeaders(sheet);

  // Add missing zone columns in sorted numeric order
  if (Array.isArray(param.allZones)) {
    for (const zone of param.allZones) {
      const zoneStr = zone.toString().trim();
      if (!zoneStr || headers.includes(zoneStr)) continue;

      const newNum = parseInt(zoneStr, 10);
      let insertBeforeIdx = -1;

      if (!isNaN(newNum)) {
        for (let i = 0; i < headers.length; i++) {
          if (!headers[i] || PROTECTED_HEADERS.includes(headers[i])) continue;
          const hNum = parseInt(headers[i], 10);
          if (!isNaN(hNum) && hNum > newNum) { insertBeforeIdx = i; break; }
        }
      }

      const lastRow = (sheet.getUsedRange() ?? sheet.getRange('A1')).getRowCount();
      let newColIdx: number;

      if (insertBeforeIdx >= 0) {
        const col = columnLetter(insertBeforeIdx);
        sheet.getRange(`${col}:${col}`).insert(ExcelScript.InsertShiftDirection.right);
        newColIdx = insertBeforeIdx;
        headers.splice(insertBeforeIdx, 0, zoneStr);
      } else {
        newColIdx = headers.length;
        headers.push(zoneStr);
      }

      sheet.getCell(0, newColIdx).setValue(zoneStr);

      // Copy format from column B (AUTO's) to the new column
      sheet.getRangeByIndexes(0, newColIdx, lastRow, 1).copyFrom(
        sheet.getRangeByIndexes(0, 1, lastRow, 1),
        ExcelScript.RangeCopyType.formats
      );
    }

    headers = getHeaders(sheet);
  }

  // Find the date row in column A
  if (!param.date) return JSON.stringify({ status: 'error', message: 'Missing date' });

  const dateObj = new Date(param.date);
  const tDay = dateObj.getDate();
  const tMonth = dateObj.getMonth();
  const tYear = dateObj.getFullYear();

  const lastRow = (sheet.getUsedRange() ?? sheet.getRange('A1')).getRowCount();
  const dateTexts = sheet.getRangeByIndexes(1, 0, lastRow - 1, 1).getTexts();
  let rowIdx = -1;

  for (let r = 0; r < dateTexts.length; r++) {
    if (matchDate((dateTexts[r][0] || '').trim(), tDay, tMonth, tYear)) {
      rowIdx = r + 1;
      break;
    }
  }

  if (rowIdx === -1) {
    return JSON.stringify({
      status: 'error',
      message: `Date ${tDay}.${tMonth + 1}.${tYear} not found in column A`
    });
  }

  // Write counts to the matching row
  for (const [key, val] of Object.entries(param.items || {})) {
    const colIdx = headers.indexOf(key.toString().trim());
    if (colIdx >= 0) sheet.getCell(rowIdx, colIdx).setValue(val);
  }

  // Apply weekday / weekend / hidden background colors
  applyColors(sheet, param.allZones || [], headers);

  return JSON.stringify({ status: 'success' });
}

// ─── Paint row/column colors ──────────────────────────────────────────────────
function applyColors(
  sheet: ExcelScript.Worksheet,
  activeZones: string[],
  headers: string[]
): void {
  const usedRange = sheet.getUsedRange();
  if (!usedRange || usedRange.getRowCount() < 2) return;

  const lastRow = usedRange.getRowCount();
  const lastCol = headers.length;

  const activeSet: Record<string, boolean> = {};
  activeZones.forEach(z => { activeSet[z.toString().trim()] = true; });

  const isHiddenCol = headers.map(h => {
    if (!h || PROTECTED_HEADERS.includes(h)) return false;
    return !activeSet[h];
  });

  const weekendRow = sheet.getRangeByIndexes(1, 0, lastRow - 1, 1)
    .getTexts().map(r => isWeekend((r[0] || '').trim()));

  for (let c = 0; c < lastCol; c++) {
    const colRange = sheet.getRangeByIndexes(1, c, lastRow - 1, 1);

    if (isHiddenCol[c]) {
      colRange.getFormat().getFill().setColor(HIDDEN_BG);
      colRange.getFormat().getFont().setColor(HIDDEN_FG);
      continue;
    }

    // Paint the whole active column as workday first
    colRange.getFormat().getFill().setColor(WORKDAY_BG);
    colRange.getFormat().getFont().setColor(DEFAULT_FG);

    // Override individual weekend rows
    if (WEEKEND_BG !== WORKDAY_BG) {
      for (let r = 0; r < weekendRow.length; r++) {
        if (weekendRow[r] === true) {
          sheet.getCell(r + 1, c).getFormat().getFill().setColor(WEEKEND_BG);
        }
      }
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getHeaders(sheet: ExcelScript.Worksheet): string[] {
  const used = sheet.getUsedRange();
  if (!used) return [];
  return sheet.getRangeByIndexes(0, 0, 1, used.getColumnCount())
    .getTexts()[0].map(t => t.toString().trim());
}

function matchDate(text: string, day: number, month: number, year: number): boolean {
  if (!text || !text.includes('.')) return false;
  const p = text.split('.');
  return p.length === 3 &&
    parseInt(p[0], 10) === day &&
    parseInt(p[1], 10) - 1 === month &&
    parseInt(p[2], 10) === year;
}

function isWeekend(text: string): boolean | null {
  if (!text || !text.includes('.')) return null;
  const p = text.split('.');
  if (p.length !== 3) return null;
  const d = new Date(Date.UTC(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10)));
  if (isNaN(d.getTime())) return null;
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

// Converts 0-based column index to Excel letter(s): 0→A, 25→Z, 26→AA …
function columnLetter(index: number): string {
  let letter = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}
