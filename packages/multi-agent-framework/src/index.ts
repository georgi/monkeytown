/**
 * @monkeytown/multi-agent-framework
 *
 * A TypeScript framework for coordinating autonomous AI agents with GitHub integration.
 *
 * This framework provides:
 * - Agent lifecycle management with domain ownership
 * - File-based inter-agent communication
 * - GitHub PR monitoring and auto-merge capabilities
 * - Coordinator for orchestrating agent runs
 *
 * @example
 * ```typescript
 * import {
 *   Coordinator,
 *   loadConfig,
 *   AgentRegistry,
 *   AgentTemplates,
 * } from '@monkeytown/multi-agent-framework';
 *
 * // Create configuration
 * const config = loadConfig({
 *   owner: 'my-org',
 *   repo: 'my-repo',
 *   agents: [
 *     AgentTemplates.founder('founder', '.agents/vision/**'),
 *     AgentTemplates.builder('builder', ['src/**', 'packages/**']),
 *   ],
 * });
 *
 * // Create and run coordinator
 * const coordinator = new Coordinator(config, {
 *   githubToken: process.env.GITHUB_TOKEN!,
 * });
 *
 * await coordinator.initialize();
 * const result = await coordinator.run();
 * ```
 *
 * @packageDocumentation
 */

// Core types
export * from './types.js';

// Agents
export { BaseAgent, AgentRegistry } from './agents/index.js';
export type { AgentContext, AgentFactory } from './agents/index.js';

// Coordinator
export { Coordinator } from './coordinator/index.js';
export type {
  CoordinatorState,
  CoordinatorRunOptions,
  CoordinatorRunResult,
  CoordinatorStatus,
} from './coordinator/index.js';

// Messaging
export { MessageBus, SignalTypes } from './messaging/index.js';
export type { MessageHandler, SignalType } from './messaging/index.js';

// GitHub integration
export { GitHubClient, PRManager } from './github/index.js';
export type {
  GitHubClientOptions,
  CreatePROptions,
  PRComment,
} from './github/index.js';

// Configuration
export {
  loadConfig,
  validateConfig,
  validateAgentConfig,
  createAgentConfig,
  defaultSystemConfig,
  AgentTemplates,
} from './config/index.js';
export type { ValidationResult } from './config/index.js';
