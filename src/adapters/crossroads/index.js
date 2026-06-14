export function createCrossroadsAdapter() {
  return {
    name: 'crossroads-adapter',
    capabilities: ['read-worldstate', 'route-npc-actions', 'validate-canon']
  };
}
