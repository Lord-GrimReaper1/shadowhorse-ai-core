const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const DATA_DIR = path.join(__dirname, '..', 'data');

// GET /v1/jobs?limit=20  -> list recent jobs (newest first)
router.get('/', (req, res) => {
  try {
    const limitRaw = req.query && req.query.limit ? Number(req.query.limit) : 20;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.floor(limitRaw))) : 20;

    const files = fs
      .readdirSync(DATA_DIR)
      .filter(f => f.startsWith('job_') && f.endsWith('.json'))
      .map(f => {
        const filePath = path.join(DATA_DIR, f);
        const stat = fs.statSync(filePath);
        return { file: f, filePath, mtimeMs: stat.mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, limit);

    const jobs = files.map(({ filePath }) => {
      try {
        const job = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return {
          id: job.id,
          status: job.status,
          created_at: job.created_at,
          projectId: job.projectId,
          error: job.error,
          validationErrors: job.validationErrors,
          result: job.result
            ? {
                id: job.result.id,
                type: job.result.type,
                path: job.result.path,
                metadata: job.result.metadata
              }
            : null
        };
      } catch (e) {
        return { error: 'failed to parse job file', message: String(e) };
      }
    });

    return res.json({ jobs });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list jobs', message: String(err) });
  }
});

router.get('/:jobId', (req, res) => {
  const jobFile = path.join(DATA_DIR, `job_${req.params.jobId}.json`);
  if (!fs.existsSync(jobFile)) return res.status(404).json({ error: 'not found' });
  return res.json(JSON.parse(fs.readFileSync(jobFile,'utf8')));
});

module.exports = router;
