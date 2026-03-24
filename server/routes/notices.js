import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();
const noticesDir = join(__dirname, '..', 'generated_notices');

// List all generated notice PDFs
router.get('/notices', (_req, res) => {
  try {
    if (!fs.existsSync(noticesDir)) {
      return res.json({ files: [] });
    }

    const files = fs
      .readdirSync(noticesDir)
      .filter((f) => f.toLowerCase().endsWith('.pdf'))
      .map((filename) => {
        const stats = fs.statSync(join(noticesDir, filename));
        // Derive student name from filename pattern: Name_notice.pdf
        const studentName = filename
          .replace(/_notice\.pdf$/i, '')
          .replace(/_/g, ' ');

        return {
          filename,
          studentName,
          size: stats.size,
          createdAt: stats.birthtime,
        };
      });

    res.json({ files });
  } catch (err) {
    console.error('Error listing notices:', err);
    res.status(500).json({ error: 'Failed to list notices' });
  }
});

// Download / serve a specific notice PDF
router.get('/notices/:filename', (req, res) => {
  try {
    const { filename } = req.params;

    // Prevent directory traversal
    const sanitized = path.basename(filename);
    const filePath = join(noticesDir, sanitized);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Notice not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitized}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('Error serving notice:', err);
    res.status(500).json({ error: 'Failed to serve notice' });
  }
});

export default router;
