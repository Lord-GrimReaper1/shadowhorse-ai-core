const fs = require('fs');
const path = require('path');
const uuid = require('uuid').v4;
const { chatCompletion } = require('../../openaiClient');
const { getSystemPromptForAssetType } = require('../../services/rolePrompts');
const { validateAsset } = require('../../services/schemaValidator');

const DATA_DIR = path.join(__dirname, '../../..', 'server', 'data');

/**
 * MCP adapter for asset generation
 * Creates an async job for asset generation (NPC, scenario, etc.)
 */

async function generateAsset({ projectId, prompt, assetType = 'npc', style = 'pragmatic', metadata = {} }) {
  try {
    if (!projectId || !prompt) {
      throw new Error('projectId and prompt are required');
    }

    const jobId = uuid();
    const jobFile = path.join(DATA_DIR, `job_${jobId}.json`);
    
    const job = { 
      id: jobId, 
      status: 'queued', 
      request: { prompt, type: assetType, style, metadata }, 
      projectId, 
      created_at: new Date().toISOString() 
    };
    
    fs.writeFileSync(jobFile, JSON.stringify(job, null, 2));

    // Async processing (non-blocking)
    processJobAsync(jobId, projectId, prompt, assetType, style, metadata).catch(err => {
      console.error(`Job ${jobId} processing error:`, err);
    });

    return { 
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          jobId,
          status: 'Job created. Use crossroads_poll_job to check status.',
          pollUrl: `job://${jobId}`
        }, null, 2)
      }]
    };
  } catch (error) {
    return { 
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false, 
          error: error.message || String(error)
        }, null, 2)
      }],
      isError: true
    };
  }
}

async function processJobAsync(jobId, projectId, prompt, assetType, style, metadata) {
  const jobFile = path.join(DATA_DIR, `job_${jobId}.json`);
  
  try {
    // Update status to processing
    const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
    job.status = 'processing';
    job.started_at = new Date().toISOString();
    fs.writeFileSync(jobFile, JSON.stringify(job, null, 2));

    // Generate with GPT
    const systemPrompt = getSystemPromptForAssetType(assetType, style);
    const userPrompt = `ProjectId: ${projectId}\nType: ${assetType}\nStyle: ${style}\n\nUser prompt:\n${prompt}`;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const completion = await chatCompletion(messages, { max_tokens: 2000 });
    
    // Parse and validate JSON
    let parsedResult;
    let schemaValid = false;
    let schemaErrors = [];

    try {
      parsedResult = JSON.parse(completion);
      const validation = validateAsset(parsedResult, assetType);
      schemaValid = validation.valid;
      schemaErrors = validation.errors || [];
    } catch (parseErr) {
      parsedResult = { raw_text: completion, parse_error: parseErr.message };
    }

    // Save result
    const resultFilename = `asset_${jobId}_${assetType}.json`;
    const resultPath = path.join(DATA_DIR, resultFilename);
    fs.writeFileSync(resultPath, JSON.stringify(parsedResult, null, 2));

    // Update job with result
    job.status = 'completed';
    job.completed_at = new Date().toISOString();
    job.result = {
      type: assetType,
      path: `/_data/${resultFilename}`,
      schema_valid: schemaValid,
      schema_errors: schemaErrors,
      metadata: {
        ...metadata,
        generated_at: new Date().toISOString(),
        model: 'gpt-4o-mini'
      }
    };
    fs.writeFileSync(jobFile, JSON.stringify(job, null, 2));

  } catch (error) {
    // Update job with error
    const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
    job.status = 'failed';
    job.error = error.message || String(error);
    job.failed_at = new Date().toISOString();
    fs.writeFileSync(jobFile, JSON.stringify(job, null, 2));
  }
}

module.exports = { generateAsset };
