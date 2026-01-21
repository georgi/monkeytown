import { randomUUID } from 'crypto';
import type { AgentId, AgentMessage } from '../types.js';

/**
 * File-based message bus for inter-agent communication.
 * Messages are persisted as files in the messaging directory,
 * enabling asynchronous communication without direct agent contact.
 */
export class MessageBus {
  private readonly basePath: string;
  private messageHandlers = new Map<AgentId, MessageHandler[]>();

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * Create a new message
   */
  createMessage(
    from: AgentId | 'coordinator',
    to: AgentId | 'broadcast',
    type: AgentMessage['type'],
    payload: Record<string, unknown>,
    relatedFiles?: string[]
  ): AgentMessage {
    return {
      id: randomUUID(),
      from,
      to,
      type,
      payload,
      timestamp: new Date(),
      relatedFiles,
    };
  }

  /**
   * Publish a message to the bus
   */
  async publish(message: AgentMessage): Promise<void> {
    // In a real implementation, this would write to the file system
    // For now, we just trigger handlers synchronously
    await this.deliverMessage(message);
  }

  /**
   * Broadcast a message to all agents
   */
  async broadcast(
    from: AgentId | 'coordinator',
    type: AgentMessage['type'],
    payload: Record<string, unknown>
  ): Promise<void> {
    const message = this.createMessage(from, 'broadcast', type, payload);
    await this.publish(message);
  }

  /**
   * Subscribe to messages for a specific agent
   */
  subscribe(agentId: AgentId, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(agentId) ?? [];
    handlers.push(handler);
    this.messageHandlers.set(agentId, handlers);
  }

  /**
   * Unsubscribe a handler
   */
  unsubscribe(agentId: AgentId, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(agentId) ?? [];
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Deliver a message to handlers
   */
  private async deliverMessage(message: AgentMessage): Promise<void> {
    const targetHandlers: MessageHandler[] = [];

    if (message.to === 'broadcast') {
      // Deliver to all handlers except the sender
      for (const [agentId, handlers] of this.messageHandlers) {
        if (agentId !== message.from) {
          targetHandlers.push(...handlers);
        }
      }
    } else {
      // Deliver to specific agent
      const handlers = this.messageHandlers.get(message.to) ?? [];
      targetHandlers.push(...handlers);
    }

    await Promise.all(targetHandlers.map((handler) => handler(message)));
  }

  /**
   * Get messages for an agent from the file system
   * In production, this reads from the messaging directory
   */
  async getMessagesForAgent(_agentId: AgentId): Promise<AgentMessage[]> {
    // This would read from the file system
    // For now, return empty array
    return [];
  }

  /**
   * Get all unread messages
   */
  async getUnreadMessages(): Promise<AgentMessage[]> {
    return [];
  }

  /**
   * Get the file path for storing a message
   */
  getMessagePath(message: AgentMessage): string {
    const dateStr = message.timestamp.toISOString().split('T')[0];
    return `${this.basePath}/${dateStr}/${message.id}.json`;
  }

  /**
   * Serialize a message to JSON
   */
  serializeMessage(message: AgentMessage): string {
    return JSON.stringify(message, null, 2);
  }

  /**
   * Parse a message from JSON
   */
  parseMessage(json: string): AgentMessage {
    const data = JSON.parse(json);
    return {
      ...data,
      timestamp: new Date(data.timestamp),
    };
  }
}

/**
 * Message handler function type
 */
export type MessageHandler = (message: AgentMessage) => Promise<void>;

/**
 * Signal types for common inter-agent communications
 */
export const SignalTypes = {
  /** Agent completed a task */
  TASK_COMPLETED: 'task_completed',
  /** Agent needs input from another domain */
  INPUT_NEEDED: 'input_needed',
  /** Agent detected a conflict */
  CONFLICT_DETECTED: 'conflict_detected',
  /** Agent suggests a priority change */
  PRIORITY_SUGGESTION: 'priority_suggestion',
  /** Status update */
  STATUS_UPDATE: 'status_update',
} as const;

export type SignalType = (typeof SignalTypes)[keyof typeof SignalTypes];
