import { describe, it, expect, beforeEach } from 'vitest';
import { MessageBus, SignalTypes } from '../src/messaging/message-bus.js';
import type { AgentMessage } from '../src/types.js';

describe('MessageBus', () => {
  let messageBus: MessageBus;

  beforeEach(() => {
    messageBus = new MessageBus('.agents/messages');
  });

  describe('createMessage', () => {
    it('should create a message with all fields', () => {
      const message = messageBus.createMessage(
        'agent-a',
        'agent-b',
        'signal',
        { event: 'test' },
        ['file1.md']
      );

      expect(message.id).toBeDefined();
      expect(message.from).toBe('agent-a');
      expect(message.to).toBe('agent-b');
      expect(message.type).toBe('signal');
      expect(message.payload).toEqual({ event: 'test' });
      expect(message.relatedFiles).toEqual(['file1.md']);
      expect(message.timestamp).toBeInstanceOf(Date);
    });

    it('should create broadcast messages', () => {
      const message = messageBus.createMessage(
        'coordinator',
        'broadcast',
        'status',
        { status: 'running' }
      );

      expect(message.to).toBe('broadcast');
    });
  });

  describe('subscribe and publish', () => {
    it('should deliver messages to subscribers', async () => {
      const receivedMessages: AgentMessage[] = [];

      messageBus.subscribe('agent-b', async (message) => {
        receivedMessages.push(message);
      });

      const message = messageBus.createMessage(
        'agent-a',
        'agent-b',
        'signal',
        { test: true }
      );

      await messageBus.publish(message);

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].from).toBe('agent-a');
    });

    it('should broadcast to all subscribers except sender', async () => {
      const receivedByB: AgentMessage[] = [];
      const receivedByC: AgentMessage[] = [];

      messageBus.subscribe('agent-b', async (message) => {
        receivedByB.push(message);
      });

      messageBus.subscribe('agent-c', async (message) => {
        receivedByC.push(message);
      });

      await messageBus.broadcast('agent-a', 'signal', { broadcast: true });

      expect(receivedByB).toHaveLength(1);
      expect(receivedByC).toHaveLength(1);
    });
  });

  describe('message serialization', () => {
    it('should serialize and parse messages', () => {
      const original = messageBus.createMessage(
        'agent-a',
        'agent-b',
        'decision',
        { priority: 'high' }
      );

      const serialized = messageBus.serializeMessage(original);
      const parsed = messageBus.parseMessage(serialized);

      expect(parsed.id).toBe(original.id);
      expect(parsed.from).toBe(original.from);
      expect(parsed.to).toBe(original.to);
      expect(parsed.type).toBe(original.type);
      expect(parsed.payload).toEqual(original.payload);
      expect(parsed.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('getMessagePath', () => {
    it('should generate correct file path', () => {
      const message = messageBus.createMessage(
        'agent-a',
        'agent-b',
        'signal',
        {}
      );

      const path = messageBus.getMessagePath(message);

      expect(path).toContain('.agents/messages');
      expect(path).toContain(message.id);
      expect(path).toMatch(/\.json$/);
    });
  });

  describe('SignalTypes', () => {
    it('should have common signal types defined', () => {
      expect(SignalTypes.TASK_COMPLETED).toBe('task_completed');
      expect(SignalTypes.INPUT_NEEDED).toBe('input_needed');
      expect(SignalTypes.CONFLICT_DETECTED).toBe('conflict_detected');
    });

    it('should have all expected signal types', () => {
      expect(SignalTypes.PRIORITY_SUGGESTION).toBe('priority_suggestion');
      expect(SignalTypes.STATUS_UPDATE).toBe('status_update');
    });
  });

  describe('unsubscribe', () => {
    it('should stop delivering messages after unsubscribe', async () => {
      const receivedMessages: AgentMessage[] = [];
      const handler = async (message: AgentMessage) => {
        receivedMessages.push(message);
      };

      messageBus.subscribe('agent-x', handler);

      // First message should be received
      const msg1 = messageBus.createMessage('sender', 'agent-x', 'signal', { num: 1 });
      await messageBus.publish(msg1);
      expect(receivedMessages).toHaveLength(1);

      // Unsubscribe
      messageBus.unsubscribe('agent-x', handler);

      // Second message should not be received
      const msg2 = messageBus.createMessage('sender', 'agent-x', 'signal', { num: 2 });
      await messageBus.publish(msg2);
      expect(receivedMessages).toHaveLength(1);
    });

    it('should handle unsubscribing non-existent handler gracefully', () => {
      const handler = async (_message: AgentMessage) => {};
      // Should not throw
      expect(() => messageBus.unsubscribe('non-existent', handler)).not.toThrow();
    });
  });

  describe('getMessagesForAgent', () => {
    it('should return empty array (mock implementation)', async () => {
      const messages = await messageBus.getMessagesForAgent('any-agent');
      expect(messages).toEqual([]);
    });
  });

  describe('getUnreadMessages', () => {
    it('should return empty array (mock implementation)', async () => {
      const messages = await messageBus.getUnreadMessages();
      expect(messages).toEqual([]);
    });
  });

  describe('message types', () => {
    it('should support all message types', () => {
      const signalMsg = messageBus.createMessage('a', 'b', 'signal', {});
      const decisionMsg = messageBus.createMessage('a', 'b', 'decision', {});
      const requestMsg = messageBus.createMessage('a', 'b', 'request', {});
      const statusMsg = messageBus.createMessage('a', 'b', 'status', {});

      expect(signalMsg.type).toBe('signal');
      expect(decisionMsg.type).toBe('decision');
      expect(requestMsg.type).toBe('request');
      expect(statusMsg.type).toBe('status');
    });
  });

  describe('multiple subscribers', () => {
    it('should deliver to multiple handlers for same agent', async () => {
      const received1: AgentMessage[] = [];
      const received2: AgentMessage[] = [];

      messageBus.subscribe('agent-multi', async (msg) => received1.push(msg));
      messageBus.subscribe('agent-multi', async (msg) => received2.push(msg));

      const message = messageBus.createMessage('sender', 'agent-multi', 'signal', {});
      await messageBus.publish(message);

      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
    });
  });

  describe('message path format', () => {
    it('should include date in message path', () => {
      const message = messageBus.createMessage('a', 'b', 'signal', {});
      const path = messageBus.getMessagePath(message);
      const dateStr = message.timestamp.toISOString().split('T')[0];

      expect(path).toContain(dateStr);
    });
  });
});
