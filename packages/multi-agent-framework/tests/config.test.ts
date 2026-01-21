import { describe, it, expect } from 'vitest';
import {
  loadConfig,
  validateConfig,
  validateAgentConfig,
  createAgentConfig,
  AgentTemplates,
} from '../src/config/loader.js';

describe('Configuration', () => {
  describe('loadConfig', () => {
    it('should load config with defaults', () => {
      const config = loadConfig({
        owner: 'test-owner',
        repo: 'test-repo',
      });

      expect(config.owner).toBe('test-owner');
      expect(config.repo).toBe('test-repo');
      expect(config.defaultBranch).toBe('main');
      expect(config.autoMerge.enabled).toBe(true);
    });

    it('should override defaults with provided values', () => {
      const config = loadConfig({
        owner: 'test-owner',
        repo: 'test-repo',
        defaultBranch: 'develop',
        autoMerge: {
          enabled: false,
          requiredChecks: ['custom-check'],
          mergeDelay: 30000,
          blockingLabels: ['custom-block'],
        },
      });

      expect(config.defaultBranch).toBe('develop');
      expect(config.autoMerge.enabled).toBe(false);
      expect(config.autoMerge.requiredChecks).toEqual(['custom-check']);
    });
  });

  describe('validateConfig', () => {
    it('should validate a correct config', () => {
      const config = loadConfig({
        owner: 'test-owner',
        repo: 'test-repo',
        agents: [
          createAgentConfig('agent-1', 'Agent One', 'Test role', ['.test/**']),
        ],
      });

      const result = validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing owner', () => {
      const config = {
        owner: '',
        repo: 'test-repo',
        defaultBranch: 'main',
        messagingPath: '.agents/messages',
        decisionsPath: '.agents/decisions',
        autoMerge: {
          enabled: true,
          requiredChecks: [],
          mergeDelay: 60000,
          blockingLabels: [],
        },
        agents: [],
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: owner');
    });

    it('should detect duplicate agent IDs', () => {
      const config = loadConfig({
        owner: 'test-owner',
        repo: 'test-repo',
        agents: [
          createAgentConfig('agent-1', 'Agent One', 'Role', ['.test1/**']),
          createAgentConfig('agent-1', 'Agent Dup', 'Role', ['.test2/**']),
        ],
      });

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Duplicate agent ID: agent-1');
    });

    it('should detect domain conflicts', () => {
      const config = loadConfig({
        owner: 'test-owner',
        repo: 'test-repo',
        agents: [
          createAgentConfig('agent-1', 'Agent One', 'Role', ['.shared/**']),
          createAgentConfig('agent-2', 'Agent Two', 'Role', ['.shared/**']),
        ],
      });

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('multiple agents'))).toBe(
        true
      );
    });
  });

  describe('AgentTemplates', () => {
    it('should create founder template', () => {
      const agent = AgentTemplates.founder('my-founder', '.vision/**');

      expect(agent.id).toBe('my-founder');
      expect(agent.persona.name).toBe('Founder');
      expect(agent.domain.writePaths).toEqual(['.vision/**']);
    });

    it('should create builder template', () => {
      const agent = AgentTemplates.builder('my-builder', ['src/**', 'lib/**']);

      expect(agent.id).toBe('my-builder');
      expect(agent.persona.name).toBe('Builder');
      expect(agent.domain.writePaths).toEqual(['src/**', 'lib/**']);
    });

    it('should create architect template', () => {
      const agent = AgentTemplates.architect('my-architect', '.arch/**');

      expect(agent.id).toBe('my-architect');
      expect(agent.persona.name).toBe('Architect');
      expect(agent.persona.role).toBe('System structure engineer');
      expect(agent.domain.writePaths).toEqual(['.arch/**']);
    });

    it('should create orchestrator template', () => {
      const agent = AgentTemplates.orchestrator('my-orch', '.decisions/**');

      expect(agent.id).toBe('my-orch');
      expect(agent.persona.name).toBe('Orchestrator');
      expect(agent.persona.role).toBe('Meta-coordinator and decision executor');
      expect(agent.domain.writePaths).toEqual(['.decisions/**']);
    });

    it('should include prompt templates', () => {
      const founder = AgentTemplates.founder('f', '.v/**');
      const architect = AgentTemplates.architect('a', '.a/**');
      const builder = AgentTemplates.builder('b', ['src/**']);
      const orchestrator = AgentTemplates.orchestrator('o', '.d/**');

      expect(founder.promptTemplate).toBeDefined();
      expect(architect.promptTemplate).toBeDefined();
      expect(builder.promptTemplate).toBeDefined();
      expect(orchestrator.promptTemplate).toBeDefined();
    });

    it('should include persona traits', () => {
      const founder = AgentTemplates.founder('f', '.v/**');
      
      expect(founder.persona.traits).toContain('visionary');
      expect(founder.persona.traits).toContain('decisive');
      expect(founder.persona.traits).toContain('philosophical');
    });
  });

  describe('validateAgentConfig', () => {
    it('should detect missing agent id', () => {
      const config = {
        id: '',
        persona: { name: 'Test', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.test/**'] },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: id');
    });

    it('should detect missing persona name', () => {
      const config = {
        id: 'test',
        persona: { name: '', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.test/**'] },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: persona.name');
    });

    it('should detect missing persona role', () => {
      const config = {
        id: 'test',
        persona: { name: 'Test', role: '', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.test/**'] },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: persona.role');
    });

    it('should detect missing write paths', () => {
      const config = {
        id: 'test',
        persona: { name: 'Test', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: [] },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent must have at least one write path');
    });

    it('should warn when no prompt template', () => {
      const config = createAgentConfig('test', 'Test', 'Test', ['.test/**']);

      const result = validateAgentConfig(config);
      expect(result.warnings).toContain('No custom prompt template defined');
    });

    it('should not warn when prompt template exists', () => {
      const config = {
        ...createAgentConfig('test', 'Test', 'Test', ['.test/**']),
        promptTemplate: 'My template',
      };

      const result = validateAgentConfig(config);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('createAgentConfig', () => {
    it('should create minimal valid config', () => {
      const config = createAgentConfig('my-agent', 'Agent Name', 'Agent Role', ['.path/**']);

      expect(config.id).toBe('my-agent');
      expect(config.persona.name).toBe('Agent Name');
      expect(config.persona.role).toBe('Agent Role');
      expect(config.persona.traits).toEqual([]);
      expect(config.persona.voice).toBe('neutral');
      expect(config.domain.writePaths).toEqual(['.path/**']);
    });
  });

  describe('loadConfig defaults', () => {
    it('should set default messaging path', () => {
      const config = loadConfig({ owner: 'test', repo: 'test' });
      expect(config.messagingPath).toBe('.agents/messages');
    });

    it('should set default decisions path', () => {
      const config = loadConfig({ owner: 'test', repo: 'test' });
      expect(config.decisionsPath).toBe('.agents/decisions');
    });

    it('should set default blocking labels', () => {
      const config = loadConfig({ owner: 'test', repo: 'test' });
      expect(config.autoMerge.blockingLabels).toContain('do-not-merge');
      expect(config.autoMerge.blockingLabels).toContain('wip');
      expect(config.autoMerge.blockingLabels).toContain('blocked');
    });

    it('should set default merge delay', () => {
      const config = loadConfig({ owner: 'test', repo: 'test' });
      expect(config.autoMerge.mergeDelay).toBe(60000);
    });
  });

  describe('validateConfig missing repo', () => {
    it('should detect missing repo', () => {
      const config = {
        owner: 'test',
        repo: '',
        defaultBranch: 'main',
        messagingPath: '.agents/messages',
        decisionsPath: '.agents/decisions',
        autoMerge: {
          enabled: true,
          requiredChecks: [],
          mergeDelay: 60000,
          blockingLabels: [],
        },
        agents: [],
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: repo');
    });
  });
});
