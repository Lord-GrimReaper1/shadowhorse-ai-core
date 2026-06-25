const { transcribeFile } = require('../../services/whisperService');
const path = require('path');

/**
 * MCP adapter for Whisper transcription service
 * Wraps existing whisperService to conform to MCP tool signature
 */

async function transcribeAudio({ audioPath, format = 'wav' }) {
  try {
    if (!audioPath) {
      throw new Error('audioPath is required');
    }

    const text = await transcribeFile(audioPath);
    
    return { 
      content: [{
        type: 'text',
        text: JSON.stringify({
          transcription: text, 
          filename: path.basename(audioPath),
          success: true
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

module.exports = { transcribeAudio };
