#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

// Create a minimal WAV file for testing
const tempDir = path.join(__dirname, '.temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
const wavPath = path.join(tempDir, 'test.wav');

// WAV header: 44 bytes (silence)
const wavBuffer = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x28, 0x00, 0x00, 0x00, // "RIFF" + size
  0x57, 0x41, 0x56, 0x45,                           // "WAVE"
  0x66, 0x6D, 0x74, 0x20,                           // "fmt "
  0x10, 0x00, 0x00, 0x00,                           // subchunk1 size
  0x01, 0x00,                                       // audio format (PCM)
  0x01, 0x00,                                       // channels
  0x22, 0x56, 0x00, 0x00,                           // sample rate (22050)
  0x44, 0xAC, 0x00, 0x00,                           // byte rate
  0x02, 0x00,                                       // block align
  0x10, 0x00,                                       // bits per sample
  0x64, 0x61, 0x74, 0x61,                           // "data"
  0x00, 0x00, 0x00, 0x00                            // subchunk2 size (0 silence)
]);

fs.writeFileSync(wavPath, wavBuffer);
console.log(`[test-whisper] Created test WAV: ${wavPath} (${wavBuffer.length} bytes)`);

// Post it
const postData = (req, file) => {
  const boundary = '----FormBoundary7MA4YWxkTrZu0gW';
  const eol = '\r\n';
  
  let body = `${boundary}${eol}`;
  body += `Content-Disposition: form-data; name="audio"; filename="test.wav"${eol}`;
  body += `Content-Type: audio/wav${eol}${eol}`;
  
  const headerBuffer = Buffer.from(body);
  const endBuffer = Buffer.from(`${eol}${boundary}--${eol}`);
  const fileData = fs.readFileSync(file);
  
  return Buffer.concat([headerBuffer, fileData, endBuffer]);
};

const postBody = postData(null, wavPath);
const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/v1/whisper',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=----FormBoundary7MA4YWxkTrZu0gW',
    'Content-Length': postBody.length
  }
};

console.log(`[test-whisper] Posting to http://localhost:4000/v1/whisper (${postBody.length} bytes)...`);

const req = http.request(options, (res) => {
  console.log(`[test-whisper] Response status: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(`[test-whisper] Response body:\n${data}`);
    process.exit(res.statusCode === 200 ? 0 : 1);
  });
});

req.on('error', (err) => {
  console.error(`[test-whisper] Request error: ${err.message}`);
  process.exit(1);
});

req.setTimeout(30000, () => {
  console.error('[test-whisper] Request timeout');
  req.destroy();
  process.exit(1);
});

req.write(postBody);
req.end();

console.log('[test-whisper] Waiting for response...');
