/**
 * Core types for the multi-agent framework
 */

/**
 * Unique identifier for an agent
 */
export type AgentId = string;

/**
 * Agent status within the system
 */
export type AgentStatus = 'idle' | 'running' | 'waiting' | 'error' | 'completed';

/**
 * Priority levels for agent tasks
 */
export type Priority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Defines an agent's domain - the files/folders it owns
 */
export interface AgentDomain {
  /** Paths the agent can write to (glob patterns) */
  writePaths: string[];
  /** Paths the agent can read from (glob patterns, defaults to all) */
  readPaths?: string[];
}

/**
 * Agent persona defining its behavior and voice
 */
export interface AgentPersona {
  /** Agent's name/identity */
  name: string;
  /** Role description */
  role: string;
  /** Personality traits */
  traits: string[];
  /** Communication style */
  voice: string;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Unique identifier */
  id: AgentId;
  /** Agent persona */
  persona: AgentPersona;
  /** Domain ownership */
  domain: AgentDomain;
  /** Schedule for automatic runs (cron expression) */
  schedule?: string;
  /** Model to use for this agent */
  model?: string;
  /** Custom prompt template */
  promptTemplate?: string;
  /** Agent-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of an agent run
 */
export interface AgentRunResult {
  /** Agent ID */
  agentId: AgentId;
  /** Run status */
  status: 'success' | 'failure' | 'partial';
  /** Files created or modified */
  filesChanged: string[];
  /** Error message if failed */
  error?: string;
  /** Run timestamp */
  timestamp: Date;
  /** Duration in milliseconds */
  durationMs: number;
  /** Optional output/summary */
  output?: string;
}

/**
 * Message passed between agents via file-based bus
 */
export interface AgentMessage {
  /** Unique message ID */
  id: string;
  /** Sending agent (or 'coordinator') */
  from: AgentId | 'coordinator';
  /** Target agent or 'broadcast' */
  to: AgentId | 'broadcast';
  /** Message type */
  type: 'signal' | 'decision' | 'request' | 'status';
  /** Message payload */
  payload: Record<string, unknown>;
  /** Timestamp */
  timestamp: Date;
  /** Reference to related files */
  relatedFiles?: string[];
}

/**
 * PR status from GitHub
 */
export type PRStatus = 'open' | 'closed' | 'merged';

/**
 * CI check status
 */
export type CIStatus = 'pending' | 'success' | 'failure' | 'error' | 'cancelled';

/**
 * Pull request information
 */
export interface PRInfo {
  /** PR number */
  number: number;
  /** PR title */
  title: string;
  /** PR status */
  status: PRStatus;
  /** CI check status */
  ciStatus: CIStatus;
  /** Branch name */
  branch: string;
  /** Creating agent ID */
  agentId?: AgentId;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
  /** PR URL */
  url: string;
  /** Whether auto-merge is enabled */
  autoMergeEnabled: boolean;
}

/**
 * Coordinator decision for PR handling
 */
export interface PRDecision {
  /** PR number */
  prNumber: number;
  /** Decision action */
  action: 'merge' | 'close' | 'wait' | 'review';
  /** Reason for decision */
  reason: string;
  /** Decision timestamp */
  timestamp: Date;
  /** Conditions that must be met (if action is 'wait') */
  waitConditions?: string[];
}

/**
 * System-wide configuration
 */
export interface SystemConfig {
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Default branch */
  defaultBranch: string;
  /** Path for inter-agent messages */
  messagingPath: string;
  /** Path for decision logs */
  decisionsPath: string;
  /** Auto-merge configuration */
  autoMerge: {
    /** Enable auto-merge */
    enabled: boolean;
    /** Required CI checks to pass */
    requiredChecks: string[];
    /** Delay before merge (ms) */
    mergeDelay: number;
    /** Labels that block auto-merge */
    blockingLabels: string[];
  };
  /** Agents in the system */
  agents: AgentConfig[];
}
