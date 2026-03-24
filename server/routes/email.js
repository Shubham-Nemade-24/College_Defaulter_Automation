import { Router } from 'express';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();
const noticesDir = join(__dirname, '..', 'generated_notices');

router.post('/send-email', async (req, res) => {
  try {
    const { filename, email } = req.body;

    if (!filename || !email) {
      return res.status(400).json({ error: 'Both filename and email are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Check credentials
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    if (!user || !pass) {
      return res.status(500).json({
        error: 'Email credentials are not configured. Set EMAIL_USER and EMAIL_PASS in the .env file.',
      });
    }

    // Check file exists
    const sanitized = path.basename(filename);
    const filePath = join(noticesDir, sanitized);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Notice PDF not found' });
    }

    // Derive student name for subject
    const studentName = sanitized
      .replace(/_notice\.pdf$/i, '')
      .replace(/_/g, ' ');

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });

    // Send email
    await transporter.sendMail({
      from: `"Attendance Notice System" <${user}>`,
      to: email,
      subject: `Attendance Notice — ${studentName}`,
      text: `Dear Recipient,\n\nPlease find attached the attendance notice for ${studentName}.\n\nRegards,\nCollege Administration`,
      html: `<p>Dear Recipient,</p><p>Please find attached the attendance notice for <strong>${studentName}</strong>.</p><p>Regards,<br/>College Administration</p>`,
      attachments: [
        {
          filename: sanitized,
          path: filePath,
        },
      ],
    });

    res.json({ message: `Email sent successfully to ${email}` });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({
      error: err.message || 'Failed to send email',
    });
  }
});

export default router;
