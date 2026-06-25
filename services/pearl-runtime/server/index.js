const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

require('dotenv').config();
require('./services/registerUnityPackageTools');
require('./services/registerDeveloperTools');

const projectsRouter = require('./routes/projects');
const jobsRouter = require('./routes/jobs');
const whisperRouter = require('./routes/whisper');
const assistantRouter = require('./routes/assistant');
const voiceRouter = require('./routes/voice');
const developerRouter = require('./routes/developer');
const agentRuntime = require('./services/agentRuntimeService');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '4mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'pearl-runtime',
    status: 'healthy'
  });
});

app.use('/v1/projects', projectsRouter);
app.use('/v1/jobs', jobsRouter);
app.use('/v1/whisper', whisperRouter);
app.use('/v1/assistant', assistantRouter);
app.use('/v1/voice', voiceRouter);
app.use('/v1/developer', developerRouter);

const publicDir = path.join(__dirname, 'public');
app.get('/chat', (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.sendFile(path.join(publicDir, 'chat.html'));
});

const dataDir = path.join(__dirname, 'data');
app.use('/_data', express.static(dataDir));
app.use('/__data', express.static(dataDir));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Pearl runtime listening on ${PORT}`);
  agentRuntime.start({ baseUrl: `http://127.0.0.1:${PORT}` });
});
