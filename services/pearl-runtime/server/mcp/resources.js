const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../..', 'server', 'data');

/**
 * MCP Resource Definitions for Crossroads
 * Resources are URI-addressable data (projects, jobs, assets)
 */

const resources = [
  {
    uri: 'project://{projectId}',
    name: 'Crossroads Project',
    description: 'Access project data by project ID',
    mimeType: 'application/json'
  },
  {
    uri: 'job://{jobId}',
    name: 'Crossroads Job',
    description: 'Access job status and results by job ID',
    mimeType: 'application/json'
  },
  {
    uri: 'asset://{filename}',
    name: 'Crossroads Asset',
    description: 'Access generated asset file by filename',
    mimeType: 'application/json'
  }
];

/**
 * Resource handler - resolves URI to actual content
 */
async function handleResourceRead(uri) {
  try {
    // Parse URI
    const uriObj = new URL(uri);
    const scheme = uriObj.protocol.replace(':', '');
    const identifier = uriObj.hostname || uriObj.pathname.replace(/^\/\//, '');

    let filePath;
    let content;

    switch (scheme) {
      case 'project':
        filePath = path.join(DATA_DIR, `project_${identifier}.json`);
        if (!fs.existsSync(filePath)) {
          throw new Error(`Project not found: ${identifier}`);
        }
        content = fs.readFileSync(filePath, 'utf8');
        break;

      case 'job':
        filePath = path.join(DATA_DIR, `job_${identifier}.json`);
        if (!fs.existsSync(filePath)) {
          throw new Error(`Job not found: ${identifier}`);
        }
        content = fs.readFileSync(filePath, 'utf8');
        break;

      case 'asset':
        // Asset files can have various names, try to find exact match
        filePath = path.join(DATA_DIR, identifier);
        if (!fs.existsSync(filePath)) {
          // Try with asset_ prefix
          filePath = path.join(DATA_DIR, `asset_${identifier}`);
          if (!fs.existsSync(filePath)) {
            throw new Error(`Asset not found: ${identifier}`);
          }
        }
        content = fs.readFileSync(filePath, 'utf8');
        break;

      default:
        throw new Error(`Unsupported URI scheme: ${scheme}`);
    }

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: content
      }]
    };

  } catch (error) {
    return {
      contents: [{
        uri,
        mimeType: 'text/plain',
        text: `Error reading resource: ${error.message || String(error)}`
      }]
    };
  }
}

/**
 * List available resources (for discovery)
 */
async function listResources() {
  try {
    const files = fs.readdirSync(DATA_DIR);
    const resourceList = [];

    // List projects
    const projects = files.filter(f => f.startsWith('project_') && f.endsWith('.json'));
    projects.forEach(f => {
      const id = f.replace('project_', '').replace('.json', '');
      resourceList.push({
        uri: `project://${id}`,
        name: `Project: ${id}`,
        mimeType: 'application/json'
      });
    });

    // List jobs
    const jobs = files.filter(f => f.startsWith('job_') && f.endsWith('.json'));
    jobs.forEach(f => {
      const id = f.replace('job_', '').replace('.json', '');
      resourceList.push({
        uri: `job://${id}`,
        name: `Job: ${id}`,
        mimeType: 'application/json'
      });
    });

    // List assets
    const assets = files.filter(f => f.startsWith('asset_') && f.endsWith('.json'));
    assets.forEach(f => {
      resourceList.push({
        uri: `asset://${f}`,
        name: `Asset: ${f}`,
        mimeType: 'application/json'
      });
    });

    return { resources: resourceList };

  } catch (error) {
    console.error('Error listing resources:', error);
    return { resources: [] };
  }
}

module.exports = { 
  resources, 
  handleResourceRead,
  listResources 
};
