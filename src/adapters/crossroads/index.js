export function createCrossroadsAdapter() {
  return {
    name: 'crossroads-adapter',
    capabilities: ['read-worldstate', 'route-npc-actions', 'validate-canon']
  };
}

export function listCrossroadsCapabilities() {
  return createCrossroadsAdapter().capabilities;
}

export function routeCrossroadsTask(kind, text) {
  const normalizedKind = String(kind ?? 'general').toLowerCase();

  return {
    adapter: 'crossroads-adapter',
    route:
      normalizedKind === 'canon'
        ? 'validate-canon'
        : normalizedKind === 'world'
          ? 'read-worldstate'
          : 'route-npc-actions',
    text: String(text ?? '').trim()
  };
}
