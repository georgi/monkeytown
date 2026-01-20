import type {
  AgentConfig,
  AgentId,
  AgentRunResult,
  AgentStatus,
  AgentMessage,
} from '../types.js';

/**
 * Abstract base class for all agents in the system.
 * Provides common functionality for domain enforcement,
 * file access control, and message handling.
 */
export abstract class BaseAgent {
  readonly id: AgentId;
  readonly config: AgentConfig;
  private _status: AgentStatus = 'idle';

  constructor(config: AgentConfig) {
    this.id = config.id;
    this.config = config;
  }

  /**
   * Current agent status
   */
  get status(): AgentStatus {
    return this._status;
  }

  /**
   * Set agent status
   */
  protected setStatus(status: AgentStatus): void {
    this._status = status;
  }

  /**
   * Check if a path is within this agent's write domain
   */
  canWrite(path: string): boolean {
    return this.config.domain.writePaths.some((pattern) =>
      this.matchPath(path, pattern)
    );
  }

  /**
   * Check if a path is within this agent's read domain
   */
  canRead(path: string): boolean {
    const readPaths = this.config.domain.readPaths;
    // If no read paths specified, can read everything
    if (!readPaths || readPaths.length === 0) {
      return true;
    }
    return readPaths.some((pattern) => this.matchPath(path, pattern));
  }

  /**
   * Simple glob pattern matching
   */
  private matchPath(path: string, pattern: string): boolean {
    // Convert glob to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '§§') // Placeholder for **
      .replace(/\*/g, '[^/]*') // * matches anything except /
      .replace(/§§/g, '.*') // ** matches anything
      .replace(/\?/g, '.'); // ? matches single char

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Generate the agent's prompt based on current context
   */
  abstract generatePrompt(context: AgentContext): Promise<string>;

  /**
   * Execute the agent's main task
   */
  abstract execute(context: AgentContext): Promise<AgentRunResult>;

  /**
   * Process an incoming message
   */
  abstract handleMessage(message: AgentMessage): Promise<void>;

  /**
   * Get files this agent should read before execution
   */
  getContextFiles(): string[] {
    return this.config.domain.readPaths ?? ['**/*'];
  }
}

/**
 * Context provided to an agent during execution
 */
export interface AgentContext {
  /** Current repository state (file listing) */
  repositoryFiles: string[];
  /** Content of relevant files */
  fileContents: Map<string, string>;
  /** Recent messages for this agent */
  messages: AgentMessage[];
  /** Current timestamp */
  timestamp: Date;
  /** Previous run result (if any) */
  previousRun?: AgentRunResult;
}

/**
 * Factory function type for creating agents
 */
export type AgentFactory = (config: AgentConfig) => BaseAgent;

/**
 * Registry of agent factories by type
 */
export class AgentRegistry {
  private factories = new Map<string, AgentFactory>();
  private agents = new Map<AgentId, BaseAgent>();

  /**
   * Register an agent factory
   */
  register(type: string, factory: AgentFactory): void {
    this.factories.set(type, factory);
  }

  /**
   * Create and register an agent instance
   */
  createAgent(type: string, config: AgentConfig): BaseAgent {
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`Unknown agent type: ${type}`);
    }

    const agent = factory(config);
    this.agents.set(config.id, agent);
    return agent;
  }

  /**
   * Get an agent by ID
   */
  getAgent(id: AgentId): BaseAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Remove an agent from the registry
   */
  removeAgent(id: AgentId): boolean {
    return this.agents.delete(id);
  }
}


