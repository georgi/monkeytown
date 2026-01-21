import { describe, it, expect } from 'vitest';
import { AgentRegistry } from '../src/agents/base-agent.js';
import type { AgentConfig, AgentMessage, AgentRunResult } from '../src/types.js';
import { BaseAgent, AgentContext } from '../src/agents/base-agent.js';

// Test implementation of BaseAgent
class TestAgent extends BaseAgent {
  public executeCalled = false;
  public lastContext: AgentContext | null = null;
  public messagesReceived: AgentMessage[] = [];

  async generatePrompt(_context: AgentContext): Promise<string> {
    return `Test prompt for ${this.id}`;
  }

  async execute(context: AgentContext): Promise<AgentRunResult> {
    this.executeCalled = true;
    this.lastContext = context;
    this.setStatus('completed');

    return {
      agentId: this.id,
      status: 'success',
      filesChanged: [],
      timestamp: new Date(),
      durationMs: 100,
    };
  }

  async handleMessage(message: AgentMessage): Promise<void> {
    this.messagesReceived.push(message);
  }
}

describe('BaseAgent', () => {
  const testConfig: AgentConfig = {
    id: 'test-agent',
    persona: {
      name: 'Test Agent',
      role: 'Testing',
      traits: ['test'],
      voice: 'neutral',
    },
    domain: {
      writePaths: ['.test/**', 'src/test/**'],
      readPaths: ['**/*.md', '**/*.ts'],
    },
  };

  describe('canWrite', () => {
    it('should allow writing to owned paths', () => {
      const agent = new TestAgent(testConfig);

      expect(agent.canWrite('.test/file.md')).toBe(true);
      expect(agent.canWrite('.test/deep/file.md')).toBe(true);
      expect(agent.canWrite('src/test/file.ts')).toBe(true);
    });

    it('should deny writing to non-owned paths', () => {
      const agent = new TestAgent(testConfig);

      expect(agent.canWrite('.other/file.md')).toBe(false);
      expect(agent.canWrite('src/main/file.ts')).toBe(false);
    });
  });

  describe('canRead', () => {
    it('should allow reading from specified paths', () => {
      const agent = new TestAgent(testConfig);

      expect(agent.canRead('docs/README.md')).toBe(true);
      expect(agent.canRead('src/index.ts')).toBe(true);
    });

    it('should deny reading from non-specified paths', () => {
      const agent = new TestAgent(testConfig);

      expect(agent.canRead('binary.exe')).toBe(false);
      expect(agent.canRead('image.png')).toBe(false);
    });

    it('should allow all reads when no readPaths specified', () => {
      const configNoReadPaths: AgentConfig = {
        ...testConfig,
        domain: { writePaths: ['.test/**'] },
      };
      const agent = new TestAgent(configNoReadPaths);

      expect(agent.canRead('anything.exe')).toBe(true);
      expect(agent.canRead('any/path/file.xyz')).toBe(true);
    });
  });

  describe('status', () => {
    it('should start with idle status', () => {
      const agent = new TestAgent(testConfig);
      expect(agent.status).toBe('idle');
    });

    it('should update status after execution', async () => {
      const agent = new TestAgent(testConfig);

      await agent.execute({
        repositoryFiles: [],
        fileContents: new Map(),
        messages: [],
        timestamp: new Date(),
      });

      expect(agent.status).toBe('completed');
    });
  });

  describe('getContextFiles', () => {
    it('should return readPaths when specified', () => {
      const agent = new TestAgent(testConfig);
      const files = agent.getContextFiles();

      expect(files).toEqual(['**/*.md', '**/*.ts']);
    });

    it('should return default pattern when no readPaths specified', () => {
      const configNoReadPaths: AgentConfig = {
        ...testConfig,
        domain: { writePaths: ['.test/**'] },
      };
      const agent = new TestAgent(configNoReadPaths);
      const files = agent.getContextFiles();

      expect(files).toEqual(['**/*']);
    });
  });

  describe('handleMessage', () => {
    it('should receive and store messages', async () => {
      const agent = new TestAgent(testConfig);
      const message: AgentMessage = {
        id: 'msg-1',
        from: 'coordinator',
        to: 'test-agent',
        type: 'signal',
        payload: { test: true },
        timestamp: new Date(),
      };

      await agent.handleMessage(message);

      expect(agent.messagesReceived).toHaveLength(1);
      expect(agent.messagesReceived[0]).toEqual(message);
    });
  });

  describe('generatePrompt', () => {
    it('should generate prompt based on agent id', async () => {
      const agent = new TestAgent(testConfig);
      const context: AgentContext = {
        repositoryFiles: [],
        fileContents: new Map(),
        messages: [],
        timestamp: new Date(),
      };

      const prompt = await agent.generatePrompt(context);

      expect(prompt).toBe('Test prompt for test-agent');
    });
  });

  describe('glob pattern matching', () => {
    it('should match single wildcard patterns', () => {
      const config: AgentConfig = {
        ...testConfig,
        domain: { writePaths: ['src/*.ts'] },
      };
      const agent = new TestAgent(config);

      expect(agent.canWrite('src/index.ts')).toBe(true);
      expect(agent.canWrite('src/deep/index.ts')).toBe(false);
    });

    it('should match double wildcard patterns', () => {
      const config: AgentConfig = {
        ...testConfig,
        domain: { writePaths: ['src/**'] },
      };
      const agent = new TestAgent(config);

      expect(agent.canWrite('src/index.ts')).toBe(true);
      expect(agent.canWrite('src/deep/index.ts')).toBe(true);
      expect(agent.canWrite('src/deep/nested/index.ts')).toBe(true);
    });

    it('should match question mark patterns', () => {
      const config: AgentConfig = {
        ...testConfig,
        domain: { writePaths: ['file?.md'] },
      };
      const agent = new TestAgent(config);

      expect(agent.canWrite('file1.md')).toBe(true);
      expect(agent.canWrite('fileA.md')).toBe(true);
      expect(agent.canWrite('file12.md')).toBe(false);
    });
  });
});

describe('AgentRegistry', () => {
  it('should register and create agents', () => {
    const registry = new AgentRegistry();

    registry.register('test', (config) => new TestAgent(config));

    const config: AgentConfig = {
      id: 'my-test-agent',
      persona: {
        name: 'Test',
        role: 'Test',
        traits: [],
        voice: 'neutral',
      },
      domain: { writePaths: ['.test/**'] },
    };

    const agent = registry.createAgent('test', config);

    expect(agent).toBeInstanceOf(TestAgent);
    expect(agent.id).toBe('my-test-agent');
  });

  it('should retrieve agents by ID', () => {
    const registry = new AgentRegistry();
    registry.register('test', (config) => new TestAgent(config));

    const config: AgentConfig = {
      id: 'retrievable-agent',
      persona: {
        name: 'Test',
        role: 'Test',
        traits: [],
        voice: 'neutral',
      },
      domain: { writePaths: ['.test/**'] },
    };

    registry.createAgent('test', config);

    const retrieved = registry.getAgent('retrievable-agent');
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('retrievable-agent');
  });

  it('should list all agents', () => {
    const registry = new AgentRegistry();
    registry.register('test', (config) => new TestAgent(config));

    const makeConfig = (id: string): AgentConfig => ({
      id,
      persona: { name: id, role: 'Test', traits: [], voice: 'neutral' },
      domain: { writePaths: [`.${id}/**`] },
    });

    registry.createAgent('test', makeConfig('agent-1'));
    registry.createAgent('test', makeConfig('agent-2'));
    registry.createAgent('test', makeConfig('agent-3'));

    const all = registry.getAllAgents();
    expect(all).toHaveLength(3);
  });

  it('should throw for unknown agent type', () => {
    const registry = new AgentRegistry();

    const config: AgentConfig = {
      id: 'unknown-type',
      persona: { name: 'Test', role: 'Test', traits: [], voice: 'neutral' },
      domain: { writePaths: ['.test/**'] },
    };

    expect(() => registry.createAgent('unknown', config)).toThrow(
      'Unknown agent type: unknown'
    );
  });

  it('should remove an agent from registry', () => {
    const registry = new AgentRegistry();
    registry.register('test', (config) => new TestAgent(config));

    const config: AgentConfig = {
      id: 'removable-agent',
      persona: { name: 'Test', role: 'Test', traits: [], voice: 'neutral' },
      domain: { writePaths: ['.test/**'] },
    };

    registry.createAgent('test', config);
    expect(registry.getAgent('removable-agent')).toBeDefined();

    const removed = registry.removeAgent('removable-agent');
    expect(removed).toBe(true);
    expect(registry.getAgent('removable-agent')).toBeUndefined();
  });

  it('should return false when removing non-existent agent', () => {
    const registry = new AgentRegistry();
    const removed = registry.removeAgent('non-existent');
    expect(removed).toBe(false);
  });

  it('should return undefined for non-existent agent', () => {
    const registry = new AgentRegistry();
    expect(registry.getAgent('non-existent')).toBeUndefined();
  });

  it('should return empty array when no agents registered', () => {
    const registry = new AgentRegistry();
    expect(registry.getAllAgents()).toEqual([]);
  });
});
