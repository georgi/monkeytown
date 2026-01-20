import { describe, it, expect } from 'vitest';
import {
  loadConfig,
  validateConfig,
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
  });
});
