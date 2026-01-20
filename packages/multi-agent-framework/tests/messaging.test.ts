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
  });
});
