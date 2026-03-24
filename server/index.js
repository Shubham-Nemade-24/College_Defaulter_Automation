import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

import uploadRouter from './routes/upload.js';
import noticesRouter from './routes/notices.js';
import emailRouter from './routes/email.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

// Ensure generated_notices directory exists
const noticesDir = join(__dirname, 'generated_notices');
if (!fs.existsSync(noticesDir)) {
  fs.mkdirSync(noticesDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', uploadRouter);
app.use('/api', noticesRouter);
app.use('/api', emailRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
