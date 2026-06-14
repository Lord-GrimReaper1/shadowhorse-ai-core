import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_CANON = Object.freeze({
  version: '1.2',
  entries: []
});

export class CanonStore {
  constructor({ filePath } = {}) {
    this.filePath = filePath ?? null;
    this.state = structuredClone(DEFAULT_CANON);
  }

  list() {
    return [...this.state.entries];
  }

  add(entry) {
    this.state.entries.push({
      id: this.state.entries.length + 1,
      ...entry
    });
  }

  async load() {
    if (!this.filePath) {
      return this.state;
    }

    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      this.state = {
        version: parsed.version ?? DEFAULT_CANON.version,
        entries: Array.isArray(parsed.entries) ? parsed.entries : []
      };
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }

    return this.state;
  }

  async save() {
    if (!this.filePath) {
      return this.state;
    }

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.state, null, 2), 'utf8');
    return this.state;
  }
}
