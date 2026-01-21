import type {
  SystemConfig,
  AgentId,
  AgentRunResult,
  PRDecision,
} from '../types.js';
import { AgentRegistry, BaseAgent, AgentContext } from '../agents/index.js';
import { MessageBus, SignalTypes } from '../messaging/index.js';
import { GitHubClient, PRManager } from '../github/index.js';

/**
 * Coordinator state
 */
export type CoordinatorState =
  | 'idle'
  | 'running'
  | 'processing'
  | 'error'
  | 'stopped';

/**
 * Run options for the coordinator
 */
export interface CoordinatorRunOptions {
  /** Specific agents to run (defaults to all) */
  agents?: AgentId[];
  /** Skip PR processing */
  skipPRProcessing?: boolean;
  /** Dry run mode (no actual changes) */
  dryRun?: boolean;
}

/**
 * Result of a coordinator run
 */
export interface CoordinatorRunResult {
  /** Overall status */
  status: 'success' | 'partial' | 'failure';
  /** Results from agent runs */
  agentResults: AgentRunResult[];
  /** PR decisions made */
  prDecisions: PRDecision[];
  /** Run timestamp */
  timestamp: Date;
  /** Total duration */
  durationMs: number;
  /** Errors encountered */
  errors: string[];
}

/**
 * The Coordinator is the central orchestrator of the multi-agent system.
 * It manages agent lifecycle, coordinates execution, handles PR processing,
 * and ensures the system moves forward.
 *
 * Key responsibilities:
 * - Schedule and trigger agent runs
 * - Route messages between agents via the message bus
 * - Monitor PRs and trigger auto-merge when CI passes
 * - Maintain system state and decision logs
 */
export class Coordinator {
  private readonly config: SystemConfig;
  private readonly registry: AgentRegistry;
  private readonly messageBus: MessageBus;
  private readonly githubClient: GitHubClient;
  private readonly prManager: PRManager;
  private _state: CoordinatorState = 'idle';
  private runHistory: CoordinatorRunResult[] = [];

  constructor(
    config: SystemConfig,
    options: {
      githubToken: string;
      registry?: AgentRegistry;
      messageBus?: MessageBus;
    }
  ) {
    this.config = config;
    this.registry = options.registry ?? new AgentRegistry();
    this.messageBus =
      options.messageBus ?? new MessageBus(config.messagingPath);
    this.githubClient = new GitHubClient({
      token: options.githubToken,
      owner: config.owner,
      repo: config.repo,
    });
    this.prManager = new PRManager(this.githubClient);
  }

  /**
   * Current coordinator state
   */
  get state(): CoordinatorState {
    return this._state;
  }

  /**
   * Get the agent registry
   */
  getRegistry(): AgentRegistry {
    return this.registry;
  }

  /**
   * Get the message bus
   */
  getMessageBus(): MessageBus {
    return this.messageBus;
  }

  /**
   * Get the PR manager
   */
  getPRManager(): PRManager {
    return this.prManager;
  }

  /**
   * Initialize the coordinator and all agents
   */
  async initialize(): Promise<void> {
    this._state = 'running';

    // Subscribe agents to their messages
    for (const agent of this.registry.getAllAgents()) {
      this.messageBus.subscribe(agent.id, async (message) => {
        await agent.handleMessage(message);
      });
    }

    // Broadcast initialization signal
    await this.messageBus.broadcast('coordinator', 'status', {
      event: 'coordinator_initialized',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Run the coordination cycle
   */
  async run(options: CoordinatorRunOptions = {}): Promise<CoordinatorRunResult> {
    const startTime = Date.now();
    const result: CoordinatorRunResult = {
      status: 'success',
      agentResults: [],
      prDecisions: [],
      timestamp: new Date(),
      durationMs: 0,
      errors: [],
    };

    try {
      this._state = 'processing';

      // Determine which agents to run
      const agentsToRun = options.agents
        ? options.agents
            .map((id) => this.registry.getAgent(id))
            .filter((a): a is BaseAgent => a !== undefined)
        : this.registry.getAllAgents();

      // Run each agent
      for (const agent of agentsToRun) {
        try {
          const context = await this.buildAgentContext(agent);
          const agentResult = await agent.execute(context);
          result.agentResults.push(agentResult);

          // Broadcast completion signal
          await this.messageBus.broadcast('coordinator', 'signal', {
            signal: SignalTypes.TASK_COMPLETED,
            agentId: agent.id,
            status: agentResult.status,
            filesChanged: agentResult.filesChanged,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          result.errors.push(`Agent ${agent.id}: ${errorMessage}`);
        }
      }

      // Process PRs unless skipped
      if (!options.skipPRProcessing) {
        result.prDecisions = await this.processPRs(options.dryRun ?? false);
      }

      // Determine overall status
      if (result.errors.length > 0) {
        result.status =
          result.agentResults.length > 0 ? 'partial' : 'failure';
      }

      this._state = 'idle';
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      result.errors.push(`Coordinator: ${errorMessage}`);
      result.status = 'failure';
      this._state = 'error';
    }

    result.durationMs = Date.now() - startTime;
    this.runHistory.push(result);

    return result;
  }

  /**
   * Build the context for an agent run
   */
  private async buildAgentContext(agent: BaseAgent): Promise<AgentContext> {
    const messages = await this.messageBus.getMessagesForAgent(agent.id);

    return {
      repositoryFiles: [], // Would be populated by file system scan
      fileContents: new Map(),
      messages,
      timestamp: new Date(),
      previousRun: this.getLastAgentResult(agent.id),
    };
  }

  /**
   * Get the last run result for an agent
   */
  private getLastAgentResult(agentId: AgentId): AgentRunResult | undefined {
    for (let i = this.runHistory.length - 1; i >= 0; i--) {
      const result = this.runHistory[i].agentResults.find(
        (r) => r.agentId === agentId
      );
      if (result) return result;
    }
    return undefined;
  }

  /**
   * Process open PRs and make merge decisions
   */
  private async processPRs(dryRun: boolean): Promise<PRDecision[]> {
    const decisions: PRDecision[] = [];
    const openPRs = await this.githubClient.listOpenPRs();

    for (const pr of openPRs) {
      const decision = await this.prManager.processPR(pr.number);
      decisions.push(decision);

      // Execute decision unless dry run
      if (!dryRun && decision.action === 'merge') {
        await this.prManager.executeDecision(decision);
      }
    }

    // Also run auto-merge check
    if (!dryRun && this.config.autoMerge.enabled) {
      const autoMergeDecisions = await this.prManager.autoMergeReady(
        this.config.autoMerge.requiredChecks
      );
      decisions.push(...autoMergeDecisions);
    }

    return decisions;
  }

  /**
   * Stop the coordinator
   */
  async stop(): Promise<void> {
    this._state = 'stopped';

    await this.messageBus.broadcast('coordinator', 'status', {
      event: 'coordinator_stopped',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get run history
   */
  getRunHistory(): CoordinatorRunResult[] {
    return [...this.runHistory];
  }

  /**
   * Get the last run result
   */
  getLastRun(): CoordinatorRunResult | undefined {
    return this.runHistory[this.runHistory.length - 1];
  }

  /**
   * Get system status summary
   */
  getStatus(): CoordinatorStatus {
    const agents = this.registry.getAllAgents();
    return {
      state: this._state,
      agentCount: agents.length,
      agentStatuses: agents.map((a) => ({
        id: a.id,
        status: a.status,
      })),
      lastRun: this.getLastRun()?.timestamp,
      totalRuns: this.runHistory.length,
    };
  }
}

/**
 * Coordinator status summary
 */
export interface CoordinatorStatus {
  state: CoordinatorState;
  agentCount: number;
  agentStatuses: Array<{ id: AgentId; status: string }>;
  lastRun?: Date;
  totalRuns: number;
}
