import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// Multer config
const storage = multer.diskStorage({
  destination: join(__dirname, '..', 'uploads'),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') cb(null, true);
    else cb(new Error('Only .xlsx and .xls files are allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const uploadsDir = join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// -------------------------------------------------------
// Parse the PCCOE-style attendance Excel
// -------------------------------------------------------
function parseAttendanceExcel(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Row 3 has department/year/semester metadata
  const metaRow3 = rows[3] || [];
  const metaRow4 = rows[4] || [];
  const department = String(metaRow3[0] || '').replace('Department : ', '').trim() || 'Computer Engineering';
  const academicYear = String(metaRow3[1] || '').replace('Academic Year : ', '').trim() || '';
  const semester = String(metaRow3[2] || '').replace('Semester : ', '').trim() || '';
  const year = String(metaRow4[0] || '').replace('Year : ', '').trim() || '';
  const division = String(metaRow4[1] || '').replace('Division : ', '').trim() || '';

  // Row 5 has date range
  const dateRange = String(rows[5]?.[0] || '').trim();

  // Row 6 = subject headers; Row 7 = total lectures
  const headerRow = rows[6] || [];
  const totalLecRow = rows[7] || [];

  // Discover subject columns: every subject starts at col 3, 6, 9, ...
  // Each subject occupies 3 columns: [subjectHeader, (empty), percentage]
  const subjects = [];
  for (let c = 3; c < headerRow.length - 3; c += 3) {
    const rawHeader = String(headerRow[c] || '').trim();
    if (!rawHeader) continue;

    // Parse subject name from header like "BCE7418 - CC-\nCP - TH "
    const cleanHeader = rawHeader.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    // Extract short name: between first " - " and the second " - " or " -"
    const parts = cleanHeader.split(' - ');
    let subjectCode = parts[0]?.trim() || '';
    let shortName = parts.length > 1 ? parts[1]?.replace(/-$/, '').trim() : subjectCode;

    // Determine if TH or PR
    const type = cleanHeader.includes('- PR') ? 'PR' : 'TH';

    const totalLec = String(totalLecRow[c] || '').trim();

    subjects.push({
      colIndex: c,
      pctColIndex: c + 2,
      code: subjectCode,
      shortName,
      type,
      fullHeader: cleanHeader,
      totalLectures: totalLec,
    });
  }

  // Overall attendance column indices
  const overallThIdx = headerRow.findIndex(h => String(h).includes('Overall TH'));
  const overallPrIdx = headerRow.findIndex(h => String(h).includes('Overall PR'));
  const overallIdx = headerRow.findIndex(h => String(h) === 'Overall Att.');

  // Parse student data (starts after the total lecture row)
  const students = [];
  for (let r = 8; r < rows.length; r++) {
    const row = rows[r];
    const srNo = String(row[0] || '').trim();
    const prn = String(row[1] || '').trim();
    const name = String(row[2] || '').trim();

    // Skip empty rows or non-student rows
    if (!name || !prn || srNo === '' || srNo === 'Total Lecture') continue;

    // Get subject-wise attendance for this student
    const subjectAttendance = [];
    for (const subj of subjects) {
      const attended = String(row[subj.colIndex] || '-').trim();
      const pct = String(row[subj.pctColIndex] || '-').trim();
      // Only include subjects the student is enrolled in (not "-")
      if (attended !== '-' && pct !== '-') {
        subjectAttendance.push({
          ...subj,
          attended,
          percentage: pct,
        });
      }
    }

    // Overall attendance
    const overallTh = String(row[overallThIdx] || '-').trim().replace('%', '').trim();
    const overallPr = String(row[overallPrIdx] || '-').trim().replace('%', '').trim();
    const overallAtt = String(row[overallIdx] || '-').trim().replace('%', '').trim();

    const overallNum = parseFloat(overallAtt);
    const isDefaulter = !isNaN(overallNum) && overallNum < 75;

    students.push({
      srNo,
      prn,
      name,
      subjectAttendance,
      overallTh,
      overallPr,
      overallAtt,
      overallAttNum: isNaN(overallNum) ? null : overallNum,
      isDefaulter,
    });
  }

  return {
    metadata: { department, academicYear, semester, year, division, dateRange },
    subjects,
    students,
  };
}

// -------------------------------------------------------
// Generate a PDF notice matching the Format.docx style
// -------------------------------------------------------
async function generateNoticePdf(student, metadata, dateStr) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  const margin = 50;
  const rightEdge = width - margin;
  let y = height - 40;
  const black = rgb(0.05, 0.05, 0.05);
  const gray = rgb(0.3, 0.3, 0.3);

  const drawLine = (x1, y1, x2, y2, thickness = 0.5) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: gray });
  };

  const text = (str, x, yPos, opts = {}) => {
    page.drawText(str, {
      x,
      y: yPos,
      size: opts.size || 10,
      font: opts.bold ? fontBold : opts.italic ? fontItalic : fontRegular,
      color: opts.color || black,
    });
  };

  // ---- HEADER ----
  text("Pimpri Chinchwad Education Trust's", width / 2 - 100, y, { size: 10 });
  y -= 15;
  text("Pimpri Chinchwad College of Engineering", width / 2 - 110, y, { bold: true, size: 11 });
  y -= 15;

  // Record / Revision / Date on the right
  text("Record No.: ACAD/R/23", rightEdge - 130, height - 40, { size: 8 });
  text("Revision: 01", rightEdge - 130, height - 52, { size: 8 });
  text(`Date: ${dateStr}`, rightEdge - 130, height - 64, { size: 8 });

  drawLine(margin, y, rightEdge, y, 1);
  y -= 18;

  // ---- TITLE ----
  text("Letter to Parents of Poor Performing Students", width / 2 - 130, y, { bold: true, size: 11 });
  y -= 20;

  // ---- META INFO ----
  text(`Department: ${metadata.department}`, margin, y, { size: 9.5 });
  text(`Academic Year: ${metadata.academicYear}`, width / 2 - 30, y, { size: 9.5 });
  text(`Semester: ${metadata.semester}`, rightEdge - 100, y, { size: 9.5 });
  y -= 14;
  text(`Date: ${dateStr}`, rightEdge - 100, y, { size: 9.5 });
  y -= 22;

  // ---- SALUTATION ----
  text("To,", margin, y, { size: 10 });
  y -= 14;
  text("Dear Sir/Madam,", margin, y, { size: 10 });
  y -= 18;

  // ---- BODY ----
  text("We are sorry to inform you that attendance of your ward", margin, y, { size: 10 });
  y -= 14;
  text(`${student.name}`, margin, y, { bold: true, size: 10 });
  text(`PRN No. ${student.prn}`, margin + 200, y, { size: 10 });
  y -= 14;
  text(`Year ${metadata.year || 'B.Tech'}`, margin, y, { size: 10 });
  text(`Div ${metadata.division || '-'}`, margin + 120, y, { size: 10 });
  text("is poor.", margin + 180, y, { size: 10 });
  y -= 22;

  // ---- SUBJECT ATTENDANCE TABLE ----
  text("Subject wise attendance is as follows:", margin, y, { size: 10 });
  y -= 18;

  // Separate TH and PR subjects
  const thSubjects = student.subjectAttendance.filter(s => s.type === 'TH');
  const prSubjects = student.subjectAttendance.filter(s => s.type === 'PR');

  // Table header
  const tableX = margin;
  const colWidths = [35, 180, 130, 130];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  const drawTableRow = (cells, yPos, opts = {}) => {
    let x = tableX;
    const h = opts.height || 16;
    // Draw cell borders
    for (let i = 0; i < cells.length; i++) {
      page.drawRectangle({
        x,
        y: yPos - h + 4,
        width: colWidths[i],
        height: h,
        borderColor: gray,
        borderWidth: 0.5,
        color: opts.fill || undefined,
      });
      text(cells[i], x + 4, yPos - 1, {
        size: opts.size || 8.5,
        bold: opts.bold || false,
      });
      x += colWidths[i];
    }
    return yPos - h;
  };

  y = drawTableRow(["Sr.No", "Subject", "Theory Attendance (%)", "Practical Attendance (%)"], y, { bold: true, height: 18 });

  let srNo = 1;
  // Combine subjects logically: group by subject short name when possible
  // For simplicity, list all subjects with their TH/PR percentage
  const allSubjects = student.subjectAttendance;

  // Group by short name to combine TH and PR in same row
  const subjectMap = new Map();
  for (const s of allSubjects) {
    const key = s.shortName;
    if (!subjectMap.has(key)) {
      subjectMap.set(key, { name: s.shortName, th: '-', pr: '-' });
    }
    const entry = subjectMap.get(key);
    if (s.type === 'TH') entry.th = s.percentage;
    else entry.pr = s.percentage;
  }

  for (const [, subj] of subjectMap) {
    y = drawTableRow([String(srNo), subj.name, subj.th, subj.pr], y);
    srNo++;
  }

  // Average / Total row
  y = drawTableRow(["", "Average attendance (%)", student.overallTh + ' %', student.overallPr + ' %'], y, { bold: true });
  y = drawTableRow(["", "Total Attendance (%)", student.overallAtt + ' %', ''], y, { bold: true });

  y -= 18;

  // ---- WARNING PARAGRAPH ----
  const warnText = `If he/she fails to improve attendance and to satisfy the minimum criteria of 75% attendance in theory and practicals conducted by college, he/she shall not be eligible to appear for SA in Semester ${metadata.semester} Theory Examination.`;
  // Word-wrap the warning text
  const words = warnText.split(' ');
  let line = '';
  const maxWidth = rightEdge - margin - 10;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const testWidth = fontRegular.widthOfTextAtSize(testLine, 9.5);
    if (testWidth > maxWidth) {
      text(line, margin, y, { size: 9.5 });
      y -= 13;
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) {
    text(line, margin, y, { size: 9.5 });
    y -= 30;
  }

  // ---- SIGNATURES ----
  text("Class Teacher", margin, y, { size: 9.5 });
  text("Academic Coordinator", width / 2 - 50, y, { size: 9.5 });
  text("Head of the Department", rightEdge - 130, y, { size: 9.5 });

  return await pdfDoc.save();
}

// -------------------------------------------------------
// POST /api/upload
// -------------------------------------------------------
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let parsed;
    try {
      parsed = parseAttendanceExcel(req.file.path);
    } catch (parseErr) {
      console.error('Parse error:', parseErr);
      return res.status(400).json({ error: 'Failed to parse the Excel file. Make sure the format matches the attendance report.' });
    }

    const { metadata, students } = parsed;
    const defaulters = students.filter(s => s.isDefaulter);

    if (defaulters.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.json({
        message: 'No students have attendance below 75%',
        totalStudents: students.length,
        defaulters: [],
        generatedFiles: [],
      });
    }

    // Clear old notices
    const noticesDir = join(__dirname, '..', 'generated_notices');
    const existingFiles = fs.readdirSync(noticesDir);
    for (const f of existingFiles) fs.unlinkSync(join(noticesDir, f));

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });

    const generatedFiles = [];

    for (const student of defaulters) {
      try {
        const pdfBytes = await generateNoticePdf(student, metadata, dateStr);
        const safeName = student.name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
        const pdfFilename = `${safeName}_notice.pdf`;
        fs.writeFileSync(join(noticesDir, pdfFilename), pdfBytes);
        generatedFiles.push(pdfFilename);
      } catch (err) {
        console.error(`Error generating notice for ${student.name}:`, err.message);
      }
    }

    fs.unlinkSync(req.file.path);

    // Build return data
    const defaulterData = defaulters.map(s => ({
      name: s.name,
      prn: s.prn,
      overallAtt: s.overallAtt,
    }));

    res.json({
      message: `Generated ${generatedFiles.length} notice(s)`,
      totalStudents: students.length,
      defaulters: defaulterData,
      generatedFiles,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'An error occurred while processing the file' });
  }
});

router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err) return res.status(400).json({ error: err.message });
});

export default router;
