function buildProvider({ key, name, strengths, handler }) {
  return {
    key,
    name,
    strengths,
    async generate(input) {
      return handler(input);
    }
  };
}

export function createProviderRegistry() {
  return {
    gpt: buildProvider({
      key: 'gpt',
      name: 'GPT Continuity',
      strengths: ['long-context synthesis', 'planning', 'cross-system continuity'],
      handler: ({ text, context }) =>
        `GPT response: ${text}\n\nContext snapshot: canon=${context.canonCount}, memory=${context.memoryCount}.`
    }),
    copilot: buildProvider({
      key: 'copilot',
      name: 'Copilot Builder',
      strengths: ['coding', 'repo workflows', 'implementation detail'],
      handler: ({ text }) => `Copilot builder response: ${text}`
    }),
    claude: buildProvider({
      key: 'claude',
      name: 'Claude Reasoning',
      strengths: ['ethical review', 'deep reasoning', 'canon-safe argumentation'],
      handler: ({ text }) => `Claude reasoning response: ${text}`
    }),
    gemini: buildProvider({
      key: 'gemini',
      name: 'Gemini Spatial',
      strengths: ['geography', 'media synthesis', 'multimodal framing'],
      handler: ({ text }) => `Gemini spatial response: ${text}`
    }),
    grok: buildProvider({
      key: 'grok',
      name: 'Grok Explorer',
      strengths: ['exploration', 'alternative ideas', 'rapid ideation'],
      handler: ({ text }) => `Grok exploration response: ${text}`
    })
  };
}

export function selectProviderForRoute({ route, override, registry }) {
  if (override && registry[override]) {
    return registry[override];
  }

  if (route === 'builder') {
    return registry.copilot;
  }

  if (route === 'lorekeeper') {
    return registry.claude;
  }

  return registry.gpt;
}
