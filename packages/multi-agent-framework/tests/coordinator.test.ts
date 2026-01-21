import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Coordinator } from '../src/coordinator/coordinator.js';
import { AgentRegistry, BaseAgent, AgentContext } from '../src/agents/base-agent.js';
import { MessageBus } from '../src/messaging/message-bus.js';
import { loadConfig } from '../src/config/loader.js';
import type { AgentConfig, AgentMessage, AgentRunResult, SystemConfig } from '../src/types.js';

// Mock agent for testing
class MockAgent extends BaseAgent {
  public executeCalled = false;
  public executeError: Error | null = null;

  async generatePrompt(_context: AgentContext): Promise<string> {
    return `Mock prompt for ${this.id}`;
  }

  async execute(_context: AgentContext): Promise<AgentRunResult> {
    this.executeCalled = true;
    
    if (this.executeError) {
      throw this.executeError;
    }

    this.setStatus('completed');
    return {
      agentId: this.id,
      status: 'success',
      filesChanged: ['mock-file.md'],
      timestamp: new Date(),
      durationMs: 50,
    };
  }

  async handleMessage(_message: AgentMessage): Promise<void> {
    // Mock message handling
  }
}

describe('Coordinator', () => {
  let config: SystemConfig;
  let registry: AgentRegistry;
  let messageBus: MessageBus;

  beforeEach(() => {
    config = loadConfig({
      owner: 'test-owner',
      repo: 'test-repo',
      autoMerge: {
        enabled: true,
        requiredChecks: ['build', 'test'],
        mergeDelay: 1000,
        blockingLabels: ['wip'],
      },
    });

    registry = new AgentRegistry();
    registry.register('mock', (agentConfig) => new MockAgent(agentConfig));

    messageBus = new MessageBus('.test/messages');
  });

  describe('constructor', () => {
    it('should create coordinator with custom registry and message bus', () => {
      const coordinator = new Coordinator(config, {
        githubToken: 'test-token',
        registry,
        messageBus,
      });

      expect(coordinator.getRegistry()).toBe(registry);
      expect(coordinator.getMessageBus()).toBe(messageBus);
    });

    it('should create default registry and message bus when not provided', () => {
      const coordinator = new Coordinator(config, {
        githubToken: 'test-token',
      });

      expect(coordinator.getRegistry()).toBeDefined();
      expect(coordinator.getMessageBus()).toBeDefined();
    });
  });

  describe('state', () => {
    it('should start in idle state', () => {
      const coordinator = new Coordinator(config, {
        githubToken: 'test-token',
        registry,
        messageBus,
      });

      expect(coordinator.state).toBe('idle');
    });

    it('should change to running state after initialize', async () => {
      const coordinator = new Coordinator(config, {
        githubToken: 'test-token',
        registry,
        messageBus,
      });

      await coordinator.initialize();

      expect(coordinator.state).toBe('running');
    });

    it('should change to stopped state after stop', async () => {
      const coordinator = new Coordinator(config, {
        githubToken: 'test-token',
        registry,
        messageBus,
      });

      await coordinator.initialize();
      await coordinator.stop();

      expect(coordinator.state).toBe('stopped');
    });
  });

  describe('initialize', () => {
    it('should subscribe agents to message bus', async () => {
      const agentConfig: AgentConfig = {
        id: 'test-agent',
        persona: { name: 'Test', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.test/**'] },
      };
      registry.createAgent('mock', agentConfig);

      const coordinator = new Coordinator(config, {
        githubToken: 'test-token',
        registry,
        messageBus,
      });

      await coordinator.initialize();

      // The agent should now receive broadcast messages
      const receivedMessages: AgentMessage[] = [];
      const agent = registry.getAgent('test-agent') as MockAgent;
      vi.spyOn(agent, 'handleMessage').mockImplementation(async (msg) => {
        receivedMessages.push(msg);
      });

      await messageBus.broadcast('coordinator', 'signal', { test: true });

      expect(receivedMessages.length).toBeGreaterThan(0);
    });

    it('should broadcast initialization signal', async () => {
      const receivedMessages: AgentMessage[] = [];
      messageBus.subscribe('listener', async (msg) => {
        receivedMessages.push(msg);
      });

      const coordinator = new Coordinator(config, {
        githubToken: 'test-token',
        registry,
        messageBus,
      });

      await coordinator.initialize();

      expect(receivedMessages.length).toBe(1);
      expect(receivedMessages[0].payload).toHaveProperty('event', 'coordinator_initialized');
    });
  });

  describe('run', () => {
    it('should run all agents when no specific agents specified', async () => {
      const agentConfig1: AgentConfig = {
        id: 'agent-1',
        persona: { name: 'Agent 1', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.test1/**'] },
      };
      const agentConfig2: AgentConfig = {
        id: 'agent-2',
        persona: { name: 'Agent 2', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.test2/**'] },
      };

      registry.createAgent('mock', agentConfig1);
      registry.createAgent('mock', agentConfig2);

      const coordinator = new Coordinator(config, {
        githubToken: 'test-token',
        registry,
        messageBus,
      });

      await coordinator.initialize();
      const result = await coordinator.run({ skipPRProcessing: true });

      expect(result.status).toBe('success');
      expect(result.agentResults).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should run only specified agents', async () => {
      const agentConfig1: AgentConfig = {
        id: 'agent-1',
        persona: { name: 'Agent 1', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.test1/**'] },
      };
      const agentConfig2: AgentConfig = {
        id: 'agent-2',
        persona: { name: 'Agent 2', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.test2/**'] },
      };

      registry.createAgent('mock', agentConfig1);
      registry.createAgent('mock', agentConfig2);

      const coordinator = new Coordinator(config, {
        githubToken: 'test-token',
        registry,
        messageBus,
      });

      await coordinator.initialize();
      const result = await coordinator.run({
        agents: ['agent-1'],
        skipPRProcessing: true,
      });

      expect(result.agentResults).toHaveLength(1);
      expect(result.agentResults[0].agentId).toBe('agent-1');
    });

    it('should handle agent execution errors gracefully', async () => {
      const agentConfig: AgentConfig = {
        id: 'failing-agent',
        persona: { name: 'Failing', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.test/**'] },
      };

      const agent = registry.createAgent('mock', agentConfig) as MockAgent;
      agent.executeError = new Error('Agent execution failed');

      const coordinator = new Coordinator(config, {
        githubToken: 'test-token',
        registry,
        messageBus,
      });

      await coordinator.initialize();
      const result = await coordinator.run({ skipPRProcessing: true });

      expect(result.status).toBe('failure');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Agent execution failed');
    });

    it('should return partial status when some agents fail', async () => {
      const agentConfig1: AgentConfig = {
        id: 'success-agent',
        persona: { name: 'Success', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.test1/**'] },
      };
      const agentConfig2: AgentConfig = {
        id: 'failing-agent',
        persona: { name: 'Failing', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.test2/**'] },
      };

      registry.createAgent('mock', agentConfig1);
      const failingAgent = registry.createAgent('mock', agentConfig2) as MockAgent;
      failingAgent.executeError = new Error('Failed');

      const coordinator = new Coordinator(config, {
        githubToken: 'test-token',
        registry,
        messageBus,
      });

      await coordinator.initialize();
      const result = await coordinator.run({ skipPRProcessing: true });

      expect(result.status).toBe('partial');
      expect(result.agentResults).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should record duration of run', async () => {
      const agentConfig: AgentConfig = {
        id: 'test-agent',
        persona: { name: 'Test', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.test/**'] },
      };
      registry.createAgent('mock', agentConfig);

      const coordinator = new Coordinator(config, {
        githubToken: 'test-token',
        registry,
        messageBus,
      });

      await coordinator.initialize();
      const result = await coordinator.run({ skipPRProcessing: true });

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should skip non-existent agents gracefully', async () => {
      const coordinator = new Coordinator(config, {
        githubToken: 'test-token',
        registry,
        messageBus,
      });

      await coordinator.initialize();
      const result = await coordinator.run({
        agents: ['non-existent-agent'],
        skipPRProcessing: true,
      });

      expect(result.status).toBe('success');
      expect(result.agentResults).toHaveLength(0);
    });

    it('should broadcast completion signals after each agent', async () => {
      const agentConfig: AgentConfig = {
        id: 'test-agent',
        persona: { name: 'Test', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.test/**'] },
      };
      registry.createAgent('mock', agentConfig);

      const receivedSignals: AgentMessage[] = [];
      messageBus.subscribe('listener', async (msg) => {
        if (msg.type === 'signal') {
          receivedSignals.push(msg);
        }
      });

      const coordinator = new Coordinator(config, {
        githubToken: 'test-token',
        registry,
        messageBus,
      });

      await coordinator.initialize();
      await coordinator.run({ skipPRProcessing: true });

      expect(receivedSignals.length).toBeGreaterThan(0);
      expect(receivedSignals[0].payload).toHaveProperty('signal', 'task_completed');
    });
  });

  describe('getStatus', () => {
    it('should return current status summary', async () => {
      const agentConfig: AgentConfig = {
        id: 'test-agent',
        persona: { name: 'Test', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.test/**'] },
      };
      registry.createAgent('mock', agentConfig);

      const coordinator = new Coordinator(config, {
        githubToken: 'test-token',
        registry,
        messageBus,
      });

      await coordinator.initialize();
      await coordinator.run({ skipPRProcessing: true });

      const status = coordinator.getStatus();

      expect(status.state).toBe('idle');
      expect(status.agentCount).toBe(1);
      expect(status.agentStatuses).toHaveLength(1);
      expect(status.totalRuns).toBe(1);
      expect(status.lastRun).toBeInstanceOf(Date);
    });
  });

  describe('getRunHistory', () => {
    it('should return empty history initially', () => {
      const coordinator = new Coordinator(config, {
        githubToken: 'test-token',
        registry,
        messageBus,
      });

      const history = coordinator.getRunHistory();

      expect(history).toHaveLength(0);
    });

    it('should accumulate run history', async () => {
      const agentConfig: AgentConfig = {
        id: 'test-agent',
        persona: { name: 'Test', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.test/**'] },
      };
      registry.createAgent('mock', agentConfig);

      const coordinator = new Coordinator(config, {
        githubToken: 'test-token',
        registry,
        messageBus,
      });

      await coordinator.initialize();
      await coordinator.run({ skipPRProcessing: true });
      await coordinator.run({ skipPRProcessing: true });

      const history = coordinator.getRunHistory();

      expect(history).toHaveLength(2);
    });

    it('should return a copy of history array', async () => {
      const coordinator = new Coordinator(config, {
        githubToken: 'test-token',
        registry,
        messageBus,
      });

      await coordinator.initialize();
      await coordinator.run({ skipPRProcessing: true });

      const history1 = coordinator.getRunHistory();
      const history2 = coordinator.getRunHistory();

      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    });
  });

  describe('getLastRun', () => {
    it('should return undefined when no runs', () => {
      const coordinator = new Coordinator(config, {
        githubToken: 'test-token',
        registry,
        messageBus,
      });

      expect(coordinator.getLastRun()).toBeUndefined();
    });

    it('should return most recent run result', async () => {
      const agentConfig: AgentConfig = {
        id: 'test-agent',
        persona: { name: 'Test', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.test/**'] },
      };
      registry.createAgent('mock', agentConfig);

      const coordinator = new Coordinator(config, {
        githubToken: 'test-token',
        registry,
        messageBus,
      });

      await coordinator.initialize();
      await coordinator.run({ skipPRProcessing: true });
      const lastResult = await coordinator.run({ skipPRProcessing: true });

      expect(coordinator.getLastRun()).toEqual(lastResult);
    });
  });

  describe('getPRManager', () => {
    it('should return the PR manager instance', () => {
      const coordinator = new Coordinator(config, {
        githubToken: 'test-token',
        registry,
        messageBus,
      });

      const prManager = coordinator.getPRManager();

      expect(prManager).toBeDefined();
    });
  });
});
