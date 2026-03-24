import XLSX from 'xlsx';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const xlPath = join(root, 'Attendance_Report_37.xlsx');
const wb = XLSX.readFile(xlPath);
const sheet = wb.Sheets[wb.SheetNames[0]];
const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log('=== Row 6 (headers) - all columns ===');
const headerRow = allRows[6];
headerRow.forEach((val, i) => {
  if (val !== '' && val !== null) {
    console.log(`  Col ${i}: "${String(val).replace(/\n/g, ' | ')}"`)
  }
});

console.log('\n=== Row 7 (total lectures) - all columns ===');
const totalRow = allRows[7];
totalRow.forEach((val, i) => {
  if (val !== '' && val !== null) {
    console.log(`  Col ${i}: "${String(val).replace(/\n/g, ' | ')}"`)
  }
});

console.log('\n=== First 3 student rows (Row 8-10) ===');
for (let r = 8; r <= 10; r++) {
  const row = allRows[r];
  if (!row || !row[0]) continue;
  console.log(`\nRow ${r}:`);
  row.forEach((val, i) => {
    if (val !== '' && val !== null && val !== undefined) {
      const header = headerRow[i] || `(col ${i})`;
      console.log(`  Col ${i} [${String(header).replace(/\n/g,' ').substring(0,30)}]: "${val}"`);
    }
  });
}

console.log('\n=== Last 3 columns of Row 6 (overall attendance headers) ===');
const lastCols = headerRow.length;
for (let i = lastCols - 5; i < lastCols; i++) {
  const val = headerRow[i];
  console.log(`  Col ${i}: "${String(val || '').replace(/\n/g, ' | ')}"`);
}

console.log('\n=== Total student rows ===');
let studentCount = 0;
for (let r = 8; r < allRows.length; r++) {
  const row = allRows[r];
  if (row && row[0] && typeof row[0] === 'number') studentCount++;
}
console.log(`${studentCount} students found`);

// Show overall attendance columns for first 5 students
console.log('\n=== Overall attendance for first 5 students ===');
const overallThIdx = headerRow.findIndex(h => String(h).includes('Overall TH'));
const overallPrIdx = headerRow.findIndex(h => String(h).includes('Overall PR'));
const overallIdx = headerRow.findIndex(h => String(h).includes('Overall Att'));
console.log(`Overall TH col: ${overallThIdx}, PR col: ${overallPrIdx}, Overall col: ${overallIdx}`);

for (let r = 8; r <= 12; r++) {
  const row = allRows[r];
  if (!row) continue;
  console.log(`  ${row[2]}: TH=${row[overallThIdx]}, PR=${row[overallPrIdx]}, Overall=${row[overallIdx]}`);
}
