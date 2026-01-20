import type { SystemConfig, AgentConfig } from '../types.js';

/**
 * Default system configuration
 */
export const defaultSystemConfig: Partial<SystemConfig> = {
  defaultBranch: 'main',
  messagingPath: '.agents/messages',
  decisionsPath: '.agents/decisions',
  autoMerge: {
    enabled: true,
    requiredChecks: [],
    mergeDelay: 60000, // 1 minute
    blockingLabels: ['do-not-merge', 'wip', 'blocked'],
  },
  agents: [],
};

/**
 * Load system configuration from a file or object
 */
export function loadConfig(
  config: Partial<SystemConfig> & { owner: string; repo: string }
): SystemConfig {
  return {
    owner: config.owner,
    repo: config.repo,
    defaultBranch: config.defaultBranch ?? defaultSystemConfig.defaultBranch!,
    messagingPath: config.messagingPath ?? defaultSystemConfig.messagingPath!,
    decisionsPath: config.decisionsPath ?? defaultSystemConfig.decisionsPath!,
    autoMerge: {
      ...defaultSystemConfig.autoMerge!,
      ...config.autoMerge,
    },
    agents: config.agents ?? [],
  };
}

/**
 * Validate a system configuration
 */
export function validateConfig(config: SystemConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!config.owner) errors.push('Missing required field: owner');
  if (!config.repo) errors.push('Missing required field: repo');

  // Validate agents
  const agentIds = new Set<string>();
  for (const agent of config.agents) {
    // Check for duplicate IDs
    if (agentIds.has(agent.id)) {
      errors.push(`Duplicate agent ID: ${agent.id}`);
    }
    agentIds.add(agent.id);

    // Validate agent config
    const agentValidation = validateAgentConfig(agent);
    errors.push(...agentValidation.errors.map((e) => `Agent ${agent.id}: ${e}`));
    warnings.push(
      ...agentValidation.warnings.map((w) => `Agent ${agent.id}: ${w}`)
    );
  }

  // Check for domain conflicts
  const domainConflicts = findDomainConflicts(config.agents);
  errors.push(...domainConflicts);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate an agent configuration
 */
export function validateAgentConfig(config: AgentConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.id) errors.push('Missing required field: id');
  if (!config.persona?.name) errors.push('Missing required field: persona.name');
  if (!config.persona?.role) errors.push('Missing required field: persona.role');
  if (!config.domain?.writePaths || config.domain.writePaths.length === 0) {
    errors.push('Agent must have at least one write path');
  }

  // Warnings
  if (!config.promptTemplate) {
    warnings.push('No custom prompt template defined');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Find conflicting domain ownership between agents
 */
function findDomainConflicts(agents: AgentConfig[]): string[] {
  const conflicts: string[] = [];
  const pathOwners = new Map<string, string[]>();

  for (const agent of agents) {
    for (const path of agent.domain.writePaths) {
      const owners = pathOwners.get(path) ?? [];
      owners.push(agent.id);
      pathOwners.set(path, owners);
    }
  }

  for (const [path, owners] of pathOwners) {
    if (owners.length > 1) {
      conflicts.push(
        `Path "${path}" is owned by multiple agents: ${owners.join(', ')}`
      );
    }
  }

  return conflicts;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Create a minimal agent configuration
 */
export function createAgentConfig(
  id: string,
  name: string,
  role: string,
  writePaths: string[]
): AgentConfig {
  return {
    id,
    persona: {
      name,
      role,
      traits: [],
      voice: 'neutral',
    },
    domain: {
      writePaths,
    },
  };
}

/**
 * Define common agent templates based on Monkeytown patterns
 */
export const AgentTemplates = {
  founder: (id: string, domainPath: string): AgentConfig => ({
    id,
    persona: {
      name: 'Founder',
      role: 'Vision and direction setter',
      traits: ['visionary', 'decisive', 'philosophical'],
      voice: 'authoritative yet inspiring',
    },
    domain: {
      writePaths: [domainPath],
    },
    promptTemplate: `You define the vision and meaning of the system.
You create the "why" that guides all other decisions.
Your writing is philosophical but actionable.`,
  }),

  architect: (id: string, domainPath: string): AgentConfig => ({
    id,
    persona: {
      name: 'Architect',
      role: 'System structure engineer',
      traits: ['systematic', 'precise', 'forward-thinking'],
      voice: 'technical and structured',
    },
    domain: {
      writePaths: [domainPath],
    },
    promptTemplate: `You design the structural skeleton of the system.
You think in systems, modules, interfaces, and failure modes.
Your writing is technically precise and systematically organized.`,
  }),

  builder: (id: string, codePaths: string[]): AgentConfig => ({
    id,
    persona: {
      name: 'Builder',
      role: 'Code implementation specialist',
      traits: ['pragmatic', 'skilled', 'quality-focused'],
      voice: 'silent - code speaks',
    },
    domain: {
      writePaths: codePaths,
    },
    promptTemplate: `You translate vision into working software.
You read specifications and implement them.
Your code is clean, tested, and maintainable.`,
  }),

  orchestrator: (id: string, domainPath: string): AgentConfig => ({
    id,
    persona: {
      name: 'Orchestrator',
      role: 'Meta-coordinator and decision executor',
      traits: ['calm', 'decisive', 'egoless'],
      voice: 'clinical and summary-oriented',
    },
    domain: {
      writePaths: [domainPath],
    },
    promptTemplate: `You synthesize outputs from all other agents.
You prioritize, reject, and schedule work.
You have no creative authority, only execution power.`,
  }),
} as const;
