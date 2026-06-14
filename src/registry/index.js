const DEFAULT_SPECIALISTS = Object.freeze([
  {
    key: 'builder',
    name: 'Copilot',
    capabilities: ['code generation', 'implementation', 'debugging']
  },
  {
    key: 'lorekeeper',
    name: 'Canon Guardian',
    capabilities: ['canon consistency', 'lore validation', 'worldstate rules']
  },
  {
    key: 'generalist',
    name: 'Orchestrator',
    capabilities: ['routing', 'synthesis', 'task triage']
  }
]);

export class SpecialistRegistry {
  constructor(specialists = DEFAULT_SPECIALISTS) {
    this.specialists = new Map(specialists.map((specialist) => [specialist.key, specialist]));
  }

  list() {
    return [...this.specialists.values()];
  }

  get(key) {
    return this.specialists.get(key) ?? null;
  }
}

export function createDefaultSpecialistRegistry() {
  return new SpecialistRegistry();
}
