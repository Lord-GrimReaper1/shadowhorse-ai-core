const express = require('express');
const fs = require('fs');
const path = require('path');
const uuid = require('uuid').v4;
const { chatCompletion } = require('../openaiClient');
const { anthropicCompletion } = require('../anthropicClient');
const { xaiChatCompletion } = require('../xaiClient');
const { geminiCompletion } = require('../geminiClient');
const { getSystemPromptForAssetType, getClaudeEthicsSystemPrompt, getGrokSocialSystemPrompt, getGeminiPresentationSystemPrompt } = require('../services/rolePrompts');
const { validateAsset } = require('../services/schemaValidator');

const router = express.Router();
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function ensureJsonFilename(value) {
  const name = String(value || '').trim();
  if (!name) return 'asset.json';
  return name.toLowerCase().endsWith('.json') ? name : `${name}.json`;
}

function normalizeAdvisors(value) {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr
    .map(v => String(v || '').trim().toLowerCase())
    .filter(Boolean);
}

function truncate(value, maxLen) {
  const text = String(value || '');
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

async function getAdvisorOutputs({ advisors, assetType, style, projectId, prompt, requestBody }) {
  const wantClaude = advisors.includes('claude');
  const wantGrok = advisors.includes('grok');
  const wantGemini = advisors.includes('gemini');
  if (!wantClaude && !wantGrok && !wantGemini) return {};

  const sharedContext =
    `Type: ${assetType}\n` +
    `Style: ${style}\n` +
    `ProjectId: ${projectId}\n` +
    `Prompt: ${prompt}\n` +
    `Context (may include hints/metadata):\n${JSON.stringify(requestBody, null, 2)}`;

  const tasks = [];

  if (wantClaude) {
    tasks.push(
      anthropicCompletion({
        system: getClaudeEthicsSystemPrompt(),
        user: sharedContext,
        maxTokens: 900,
        temperature: 0.2
      })
        .then(text => ({ key: 'claude', ok: true, text }))
        .catch(err => ({ key: 'claude', ok: false, error: String(err && err.message ? err.message : err) }))
    );
  }

  if (wantGrok) {
    tasks.push(
      xaiChatCompletion(
        [
          { role: 'system', content: getGrokSocialSystemPrompt() },
          { role: 'user', content: sharedContext }
        ],
        { max_tokens: 900, temperature: 0.4 }
      )
        .then(text => ({ key: 'grok', ok: true, text }))
        .catch(err => ({ key: 'grok', ok: false, error: String(err && err.message ? err.message : err) }))
    );
  }

  if (wantGemini) {
    tasks.push(
      geminiCompletion({
        system: getGeminiPresentationSystemPrompt(),
        user: sharedContext,
        maxTokens: 900,
        temperature: 0.3
      })
        .then(text => ({ key: 'gemini', ok: true, text }))
        .catch(err => ({ key: 'gemini', ok: false, error: String(err && err.message ? err.message : err) }))
    );
  }

  const results = await Promise.all(tasks);
  const out = {};
  for (const r of results) {
    out[r.key] = r.ok
      ? { ok: true, text: truncate(r.text, 4000) }
      : { ok: false, error: truncate(r.error, 4000) };
  }
  return out;
}

// GET /v1/projects  -> list all projects
router.get('/', (req, res) => {
  try {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('project_'));
    const projects = files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
      return { id: data.id || f.replace('project_', '').replace('.json', ''), name: data.name || 'Unnamed', created_at: data.created_at };
    });
    return res.json({ projects });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list projects', message: String(err) });
  }
});

// POST /v1/projects  -> save project JSON
router.post('/', (req, res) => {
  const id = req.body.id || uuid();
  const filePath = path.join(DATA_DIR, `project_${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
  return res.json({ projectId: id });
});

// GET /v1/projects/:projectId
router.get('/:projectId', (req, res) => {
  const id = req.params.projectId;
  const filePath = path.join(DATA_DIR, `project_${id}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'not found' });
  return res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
});

// POST /v1/projects/:projectId/generate/asset
router.post('/:projectId/generate/asset', async (req, res) => {
  const jobId = uuid();
  const jobFile = path.join(DATA_DIR, `job_${jobId}.json`);
  const job = { id: jobId, status: 'queued', request: req.body, projectId: req.params.projectId, created_at: new Date().toISOString() };
  fs.writeFileSync(jobFile, JSON.stringify(job, null, 2));
  res.json({ jobId });

  // Async processing
  (async () => {
    try {
      console.log(`[Job ${jobId}] Starting async processing...`);
      job.status = 'running';
      fs.writeFileSync(jobFile, JSON.stringify(job, null, 2));

      const assetType = (req.body && req.body.type) ? String(req.body.type) : 'npc';
      const style = (req.body && req.body.style) ? String(req.body.style) : 'pragmatic';
      const prompt = (req.body && req.body.prompt) ? String(req.body.prompt) : '';

      console.log(`[Job ${jobId}] Asset type: ${assetType}, Style: ${style}`);

      const advisors = normalizeAdvisors(req.body && req.body.advisors);
      console.log(`[Job ${jobId}] Calling advisors:`, advisors);
      const advisorOutputs = await getAdvisorOutputs({
        advisors,
        assetType,
        style,
        projectId: req.params.projectId,
        prompt,
        requestBody: req.body
      });
      console.log(`[Job ${jobId}] Advisors complete. Building prompt...`);

      const system = getSystemPromptForAssetType(assetType);
      const advisorBlock = Object.keys(advisorOutputs).length
        ?
          `\n\nAdvisor Inputs (optional; plain text):\n` +
          Object.entries(advisorOutputs)
            .map(([k, v]) => {
              if (v && v.ok) return `--- ${k.toUpperCase()} (ok) ---\n${v.text}`;
              return `--- ${k.toUpperCase()} (error) ---\n${v && v.error ? v.error : 'unknown error'}`;
            })
            .join('\n\n')
        : '';

      const user =
        `Type: ${assetType}\n` +
        `Style: ${style}\n` +
        `ProjectId: ${req.params.projectId}\n` +
        `Prompt: ${prompt}\n` +
        `Context (may include hints/metadata):\n${JSON.stringify(req.body, null, 2)}` +
        advisorBlock;

      console.log(`[Job ${jobId}] Calling OpenAI...`);
      const aiText = await chatCompletion([
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]);
      console.log(`[Job ${jobId}] OpenAI response received (${aiText ? aiText.length : 0} chars)`);

      let parsed;
      try {
        parsed = JSON.parse(aiText);
      } catch (e) {
        parsed = {
          type: assetType,
          style,
          prompt,
          __parse_error: true,
          __parse_error_message: String(e && e.message ? e.message : e),
          raw: aiText,
          metadata: (req.body && req.body.metadata) ? req.body.metadata : {}
        };
      }

      const assetId = uuid();
      const strictSchema = String(process.env.CROSSROADS_STRICT_SCHEMA || '').trim() === '1';
      const validation = validateAsset(assetType, parsed);
      const validationErrors = validation && validation.errors ? validation.errors : null;

      let baseName = slugify(assetType) || 'asset';
      if (assetType === 'npc') baseName = slugify(parsed && parsed.name) || 'npc';
      if (assetType === 'scenario') baseName = slugify(parsed && parsed.scenario_name) || 'scenario';
      if (assetType === 'faction') baseName = slugify(parsed && parsed.faction_name) || 'faction';
      if (assetType === 'region') baseName = slugify(parsed && parsed.region_name) || 'region';

      let outObject = parsed;
      let filename = ensureJsonFilename(`${baseName}_${assetId}`);

      if (validation && validation.ok === false) {
        outObject = {
          __invalid: true,
          __type: assetType,
          __style: style,
          __schema_errors: validationErrors,
          raw: aiText,
          parsed
        };
        filename = ensureJsonFilename(`invalid_${baseName}_${assetId}`);

        if (strictSchema) {
          const err = new Error('Schema validation failed');
          err.validationErrors = validationErrors;
          throw err;
        }
      }

      const outPath = path.join(DATA_DIR, filename);
      fs.writeFileSync(outPath, JSON.stringify(outObject, null, 2));

      const resultMetadata = Object.assign(
        {},
        (req.body && req.body.metadata) ? req.body.metadata : {},
        (parsed && parsed.metadata) ? parsed.metadata : {}
      );

      if (advisors.length) {
        resultMetadata.advisors_requested = advisors;
        resultMetadata.advisors = advisorOutputs;
      }

      resultMetadata.schema_valid = validation ? Boolean(validation.ok) : true;
      if (validationErrors) resultMetadata.schema_errors = validationErrors;

      job.status = 'done';
      job.result = {
        id: assetId,
        type: assetType,
        path: `/_data/${path.basename(outPath)}`,
        metadata: resultMetadata
      };
      fs.writeFileSync(jobFile, JSON.stringify(job, null, 2));
      console.log(`[Job ${jobId}] SUCCESS - Asset saved to ${path.basename(outPath)}`);
    } catch (err) {
      console.error(`[Job ${jobId}] ERROR:`, err);
      job.status = 'error';
      job.error = (err && err.message) ? String(err.message) : String(err);
      if (err && err.validationErrors) job.validationErrors = err.validationErrors;
      fs.writeFileSync(jobFile, JSON.stringify(job, null, 2));
    }
  })();
});

module.exports = router;
