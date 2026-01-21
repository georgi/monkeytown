/**
 * Integration tests for the multi-agent framework
 * 
 * These tests verify the full workflow of:
 * - Coordinator orchestrating multiple agents
 * - Message passing between components
 * - PR processing flow
 * - End-to-end agent execution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Coordinator } from '../src/coordinator/coordinator.js';
import { AgentRegistry, BaseAgent, AgentContext } from '../src/agents/base-agent.js';
import { MessageBus } from '../src/messaging/message-bus.js';
import { GitHubClient, PRManager } from '../src/github/github-client.js';
import { loadConfig, validateConfig, AgentTemplates } from '../src/config/loader.js';
import type {
  AgentConfig,
  AgentMessage,
  AgentRunResult,
  SystemConfig,
  PRInfo,
} from '../src/types.js';

// Stateful mock agent that tracks its execution history
class StatefulMockAgent extends BaseAgent {
  public executionHistory: Array<{ timestamp: Date; context: AgentContext }> = [];
  public messagesReceived: AgentMessage[] = [];
  public outputFiles: string[] = [];

  async generatePrompt(context: AgentContext): Promise<string> {
    return `Agent ${this.id} processing ${context.repositoryFiles.length} files`;
  }

  async execute(context: AgentContext): Promise<AgentRunResult> {
    this.executionHistory.push({ timestamp: new Date(), context });
    this.setStatus('running');

    // Simulate file creation
    const outputFile = `.${this.id}/output-${Date.now()}.md`;
    this.outputFiles.push(outputFile);

    this.setStatus('completed');
    return {
      agentId: this.id,
      status: 'success',
      filesChanged: [outputFile],
      timestamp: new Date(),
      durationMs: 50,
      output: `Processed by ${this.config.persona.name}`,
    };
  }

  async handleMessage(message: AgentMessage): Promise<void> {
    this.messagesReceived.push(message);
  }
}

describe('Integration: Full System Flow', () => {
  let config: SystemConfig;
  let registry: AgentRegistry;
  let messageBus: MessageBus;
  let coordinator: Coordinator;

  beforeEach(() => {
    config = loadConfig({
      owner: 'test-org',
      repo: 'test-repo',
      messagingPath: '.agents/messages',
      decisionsPath: '.agents/decisions',
      autoMerge: {
        enabled: true,
        requiredChecks: ['build', 'test'],
        mergeDelay: 0,
        blockingLabels: ['wip', 'do-not-merge'],
      },
    });

    registry = new AgentRegistry();
    registry.register('stateful', (agentConfig) => new StatefulMockAgent(agentConfig));

    messageBus = new MessageBus(config.messagingPath);

    coordinator = new Coordinator(config, {
      githubToken: 'test-token',
      registry,
      messageBus,
    });
  });

  describe('Multi-Agent Coordination', () => {
    it('should coordinate multiple agents in sequence', async () => {
      // Create multiple agents with different domains
      const founderConfig: AgentConfig = {
        id: 'founder',
        persona: { name: 'Founder', role: 'Vision', traits: ['visionary'], voice: 'inspiring' },
        domain: { writePaths: ['.agents/vision/**'] },
      };
      const architectConfig: AgentConfig = {
        id: 'architect',
        persona: { name: 'Architect', role: 'Structure', traits: ['systematic'], voice: 'technical' },
        domain: { writePaths: ['.agents/architecture/**'] },
      };
      const builderConfig: AgentConfig = {
        id: 'builder',
        persona: { name: 'Builder', role: 'Code', traits: ['pragmatic'], voice: 'concise' },
        domain: { writePaths: ['src/**', 'packages/**'] },
      };

      const founder = registry.createAgent('stateful', founderConfig) as StatefulMockAgent;
      const architect = registry.createAgent('stateful', architectConfig) as StatefulMockAgent;
      const builder = registry.createAgent('stateful', builderConfig) as StatefulMockAgent;

      await coordinator.initialize();
      const result = await coordinator.run({ skipPRProcessing: true });

      // All agents should have executed
      expect(founder.executionHistory).toHaveLength(1);
      expect(architect.executionHistory).toHaveLength(1);
      expect(builder.executionHistory).toHaveLength(1);

      // All agents should have produced output
      expect(result.agentResults).toHaveLength(3);
      expect(result.agentResults.every((r) => r.status === 'success')).toBe(true);

      // Total files changed should reflect all agents' work
      const totalFilesChanged = result.agentResults.reduce(
        (sum, r) => sum + r.filesChanged.length,
        0
      );
      expect(totalFilesChanged).toBe(3);
    });

    it('should broadcast completion signals that other agents receive', async () => {
      const agent1Config: AgentConfig = {
        id: 'agent-1',
        persona: { name: 'Agent 1', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.agent1/**'] },
      };
      const agent2Config: AgentConfig = {
        id: 'agent-2',
        persona: { name: 'Agent 2', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.agent2/**'] },
      };

      const agent1 = registry.createAgent('stateful', agent1Config) as StatefulMockAgent;
      const agent2 = registry.createAgent('stateful', agent2Config) as StatefulMockAgent;

      await coordinator.initialize();
      await coordinator.run({ skipPRProcessing: true });

      // Agent 1 should receive broadcasts (init + agent-2 completion)
      // Agent 2 should receive broadcasts (init + agent-1 completion)
      expect(agent1.messagesReceived.length).toBeGreaterThan(0);
      expect(agent2.messagesReceived.length).toBeGreaterThan(0);

      // Should have received task_completed signals
      const agent1CompletionSignals = agent1.messagesReceived.filter(
        (m) => m.payload.signal === 'task_completed'
      );
      const agent2CompletionSignals = agent2.messagesReceived.filter(
        (m) => m.payload.signal === 'task_completed'
      );

      // Each agent receives completion signal from the other
      expect(agent1CompletionSignals.length).toBeGreaterThanOrEqual(1);
      expect(agent2CompletionSignals.length).toBeGreaterThanOrEqual(1);
    });

    it('should pass previous run context to agents', async () => {
      const agentConfig: AgentConfig = {
        id: 'context-agent',
        persona: { name: 'Context', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.context/**'] },
      };

      const agent = registry.createAgent('stateful', agentConfig) as StatefulMockAgent;

      await coordinator.initialize();

      // First run - no previous context
      await coordinator.run({ skipPRProcessing: true });
      expect(agent.executionHistory[0].context.previousRun).toBeUndefined();

      // Second run - should have previous run context
      await coordinator.run({ skipPRProcessing: true });
      expect(agent.executionHistory[1].context.previousRun).toBeDefined();
      expect(agent.executionHistory[1].context.previousRun?.agentId).toBe('context-agent');
    });

    it('should support running specific agents only', async () => {
      const agent1Config: AgentConfig = {
        id: 'target-agent',
        persona: { name: 'Target', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.target/**'] },
      };
      const agent2Config: AgentConfig = {
        id: 'skip-agent',
        persona: { name: 'Skip', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.skip/**'] },
      };

      const targetAgent = registry.createAgent('stateful', agent1Config) as StatefulMockAgent;
      const skipAgent = registry.createAgent('stateful', agent2Config) as StatefulMockAgent;

      await coordinator.initialize();
      await coordinator.run({ agents: ['target-agent'], skipPRProcessing: true });

      expect(targetAgent.executionHistory).toHaveLength(1);
      expect(skipAgent.executionHistory).toHaveLength(0);
    });
  });

  describe('Message Bus Integration', () => {
    it('should enable indirect agent communication through messages', async () => {
      const publisherConfig: AgentConfig = {
        id: 'publisher',
        persona: { name: 'Publisher', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.publisher/**'] },
      };
      const subscriberConfig: AgentConfig = {
        id: 'subscriber',
        persona: { name: 'Subscriber', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.subscriber/**'] },
      };

      registry.createAgent('stateful', publisherConfig);
      const subscriber = registry.createAgent('stateful', subscriberConfig) as StatefulMockAgent;

      await coordinator.initialize();

      // Get the count before publishing
      const countBefore = subscriber.messagesReceived.length;

      // Manually publish a message from one agent context
      const message = messageBus.createMessage('publisher', 'subscriber', 'signal', {
        action: 'notify',
        data: 'test-data',
      });
      await messageBus.publish(message);

      // Should have received one more message
      expect(subscriber.messagesReceived.length).toBe(countBefore + 1);
      const lastMessage = subscriber.messagesReceived[subscriber.messagesReceived.length - 1];
      expect(lastMessage.payload).toEqual({
        action: 'notify',
        data: 'test-data',
      });
    });

    it('should support message serialization roundtrip', () => {
      const original = messageBus.createMessage('agent-a', 'agent-b', 'decision', {
        priority: 'high',
        files: ['file1.md', 'file2.md'],
        metadata: { nested: { value: 123 } },
      });

      const serialized = messageBus.serializeMessage(original);
      const parsed = messageBus.parseMessage(serialized);

      expect(parsed.id).toBe(original.id);
      expect(parsed.payload).toEqual(original.payload);
      expect(parsed.timestamp.toISOString()).toBe(original.timestamp.toISOString());
    });
  });

  describe('Configuration Integration', () => {
    it('should validate complete system configuration', () => {
      const fullConfig = loadConfig({
        owner: 'my-org',
        repo: 'my-repo',
        defaultBranch: 'main',
        messagingPath: '.agents/messages',
        decisionsPath: '.agents/decisions',
        autoMerge: {
          enabled: true,
          requiredChecks: ['build', 'test', 'lint'],
          mergeDelay: 60000,
          blockingLabels: ['wip', 'blocked'],
        },
        agents: [
          AgentTemplates.founder('founder', '.agents/vision/**'),
          AgentTemplates.architect('architect', '.agents/architecture/**'),
          AgentTemplates.builder('builder', ['src/**', 'packages/**']),
          AgentTemplates.orchestrator('orchestrator', '.agents/decisions/**'),
        ],
      });

      const validation = validateConfig(fullConfig);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(fullConfig.agents).toHaveLength(4);
    });

    it('should detect configuration issues early', () => {
      const invalidConfig = loadConfig({
        owner: 'my-org',
        repo: 'my-repo',
        agents: [
          AgentTemplates.founder('agent-1', '.shared/**'),
          AgentTemplates.architect('agent-2', '.shared/**'), // Conflict!
        ],
      });

      const validation = validateConfig(invalidConfig);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('multiple agents'))).toBe(true);
    });
  });

  describe('PR Processing Integration', () => {
    it('should process PRs and make decisions', async () => {
      // Setup mock PRs
      const mockPR: PRInfo = {
        number: 1,
        title: 'Test PR',
        status: 'open',
        ciStatus: 'success',
        branch: 'feature',
        agentId: 'builder',
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/test-org/test-repo/pull/1',
        autoMergeEnabled: true,
      };

      // Get the GitHub client through the coordinator's PR manager
      const prManager = coordinator.getPRManager();
      
      // Mock the underlying client methods
      const mockClient = new GitHubClient({
        token: 'test-token',
        owner: 'test-org',
        repo: 'test-repo',
      });
      
      vi.spyOn(mockClient, 'listOpenPRs').mockResolvedValue([mockPR]);
      vi.spyOn(mockClient, 'getPR').mockResolvedValue(mockPR);
      vi.spyOn(mockClient, 'getCIStatus').mockResolvedValue('success');
      vi.spyOn(mockClient, 'allChecksPassed').mockResolvedValue(true);
      vi.spyOn(mockClient, 'mergePR').mockResolvedValue(true);

      // Create a new coordinator with the mocked client
      const mockPRManager = new PRManager(mockClient);
      
      // Test the PR manager directly
      const decisions = await mockPRManager.autoMergeReady(['build', 'test']);

      expect(decisions).toHaveLength(1);
      expect(decisions[0].action).toBe('merge');
    });

    it('should respect dry run mode', async () => {
      const agentConfig: AgentConfig = {
        id: 'test-agent',
        persona: { name: 'Test', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.test/**'] },
      };
      registry.createAgent('stateful', agentConfig);

      await coordinator.initialize();
      const result = await coordinator.run({
        dryRun: true,
        skipPRProcessing: false,
      });

      // Run should complete without actually merging
      expect(result.status).toBe('success');
    });
  });

  describe('Run History Tracking', () => {
    it('should track multiple run results', async () => {
      const agentConfig: AgentConfig = {
        id: 'test-agent',
        persona: { name: 'Test', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.test/**'] },
      };
      registry.createAgent('stateful', agentConfig);

      await coordinator.initialize();

      // Perform multiple runs
      await coordinator.run({ skipPRProcessing: true });
      await coordinator.run({ skipPRProcessing: true });
      await coordinator.run({ skipPRProcessing: true });

      const history = coordinator.getRunHistory();

      expect(history).toHaveLength(3);
      expect(history.every((h) => h.status === 'success')).toBe(true);
      expect(history.every((h) => h.timestamp instanceof Date)).toBe(true);
    });

    it('should correctly identify last run', async () => {
      const agentConfig: AgentConfig = {
        id: 'test-agent',
        persona: { name: 'Test', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.test/**'] },
      };
      registry.createAgent('stateful', agentConfig);

      await coordinator.initialize();

      await coordinator.run({ skipPRProcessing: true });
      const run2 = await coordinator.run({ skipPRProcessing: true });

      const lastRun = coordinator.getLastRun();
      expect(lastRun).toEqual(run2);
      
      // Verify it's the second run by checking history length
      const history = coordinator.getRunHistory();
      expect(history).toHaveLength(2);
      expect(history[1]).toEqual(run2);
    });

    it('should track errors across runs', async () => {
      // Create a failing agent
      class FailingAgent extends BaseAgent {
        async generatePrompt(_context: AgentContext): Promise<string> {
          return 'failing';
        }
        async execute(_context: AgentContext): Promise<AgentRunResult> {
          throw new Error('Intentional failure');
        }
        async handleMessage(_message: AgentMessage): Promise<void> {}
      }

      registry.register('failing', (cfg) => new FailingAgent(cfg));

      const failingConfig: AgentConfig = {
        id: 'failing-agent',
        persona: { name: 'Failing', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.failing/**'] },
      };
      registry.createAgent('failing', failingConfig);

      await coordinator.initialize();
      const result = await coordinator.run({ skipPRProcessing: true });

      expect(result.status).toBe('failure');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Intentional failure');
    });
  });

  describe('Domain Enforcement Integration', () => {
    it('should correctly enforce domain boundaries', () => {
      const founderConfig: AgentConfig = {
        id: 'founder',
        persona: { name: 'Founder', role: 'Vision', traits: [], voice: 'neutral' },
        domain: {
          writePaths: ['.agents/vision/**'],
          readPaths: ['docs/**', '*.md'],
        },
      };

      const founder = registry.createAgent('stateful', founderConfig) as StatefulMockAgent;

      // Write access
      expect(founder.canWrite('.agents/vision/roadmap.md')).toBe(true);
      expect(founder.canWrite('.agents/architecture/design.md')).toBe(false);
      expect(founder.canWrite('src/index.ts')).toBe(false);

      // Read access
      expect(founder.canRead('docs/guide.md')).toBe(true);
      expect(founder.canRead('src/index.ts')).toBe(false);
    });

    it('should allow unrestricted read when no readPaths specified', () => {
      const builderConfig: AgentConfig = {
        id: 'builder',
        persona: { name: 'Builder', role: 'Code', traits: [], voice: 'neutral' },
        domain: {
          writePaths: ['src/**'],
          // No readPaths = can read everything
        },
      };

      const builder = registry.createAgent('stateful', builderConfig) as StatefulMockAgent;

      expect(builder.canRead('.agents/vision/roadmap.md')).toBe(true);
      expect(builder.canRead('package.json')).toBe(true);
      expect(builder.canRead('any/path/file.xyz')).toBe(true);
    });
  });

  describe('Lifecycle Management', () => {
    it('should transition through correct states', async () => {
      const agentConfig: AgentConfig = {
        id: 'test-agent',
        persona: { name: 'Test', role: 'Test', traits: [], voice: 'neutral' },
        domain: { writePaths: ['.test/**'] },
      };
      registry.createAgent('stateful', agentConfig);

      // Initial state
      expect(coordinator.state).toBe('idle');

      // After initialize
      await coordinator.initialize();
      expect(coordinator.state).toBe('running');

      // During/after run
      const runPromise = coordinator.run({ skipPRProcessing: true });
      await runPromise;
      expect(coordinator.state).toBe('idle');

      // After stop
      await coordinator.stop();
      expect(coordinator.state).toBe('stopped');
    });

    it('should broadcast stop signal', async () => {
      const receivedMessages: AgentMessage[] = [];
      messageBus.subscribe('listener', async (msg) => {
        receivedMessages.push(msg);
      });

      await coordinator.initialize();
      await coordinator.stop();

      const stopSignal = receivedMessages.find(
        (m) => m.payload.event === 'coordinator_stopped'
      );
      expect(stopSignal).toBeDefined();
    });
  });
});

describe('Integration: Agent Templates', () => {
  it('should create correctly configured agents from templates', () => {
    const founder = AgentTemplates.founder('my-founder', '.vision/**');
    const architect = AgentTemplates.architect('my-architect', '.architecture/**');
    const builder = AgentTemplates.builder('my-builder', ['src/**', 'lib/**']);
    const orchestrator = AgentTemplates.orchestrator('my-orchestrator', '.decisions/**');

    expect(founder.persona.name).toBe('Founder');
    expect(architect.persona.name).toBe('Architect');
    expect(builder.persona.name).toBe('Builder');
    expect(orchestrator.persona.name).toBe('Orchestrator');

    expect(founder.domain.writePaths).toEqual(['.vision/**']);
    expect(architect.domain.writePaths).toEqual(['.architecture/**']);
    expect(builder.domain.writePaths).toEqual(['src/**', 'lib/**']);
    expect(orchestrator.domain.writePaths).toEqual(['.decisions/**']);
  });

  it('should have proper prompt templates', () => {
    const founder = AgentTemplates.founder('founder', '.vision/**');
    const architect = AgentTemplates.architect('architect', '.architecture/**');
    const builder = AgentTemplates.builder('builder', ['src/**']);
    const orchestrator = AgentTemplates.orchestrator('orchestrator', '.decisions/**');

    expect(founder.promptTemplate).toContain('vision');
    expect(architect.promptTemplate).toContain('structural'); // "structural skeleton"
    expect(builder.promptTemplate).toContain('software');
    expect(orchestrator.promptTemplate).toContain('synthesize');
  });
});
