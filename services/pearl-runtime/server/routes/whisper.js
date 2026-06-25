const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { transcribeFile } = require('../services/whisperService');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ts = Date.now();
    const name = `${ts}_${file.originalname}`;
    cb(null, name);
  }
});

const upload = multer({ storage });

// POST /v1/whisper - accepts multipart form-data with field 'audio'
router.post('/', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no file uploaded' });
    const filePath = req.file.path;
    const text = await transcribeFile(filePath);
    // Optionally keep the uploaded file; respond with transcription
    return res.json({ transcription: text, filename: path.basename(filePath) });
  } catch (err) {
    console.error('whisper error', err);
    return res.status(500).json({ error: String(err) });
  }
});

module.exports = router;
