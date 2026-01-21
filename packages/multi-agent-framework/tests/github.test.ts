import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitHubClient, PRManager } from '../src/github/github-client.js';
import type { PRInfo, PRDecision } from '../src/types.js';

describe('GitHubClient', () => {
  let client: GitHubClient;

  beforeEach(() => {
    client = new GitHubClient({
      token: 'test-token',
      owner: 'test-owner',
      repo: 'test-repo',
    });
  });

  describe('createPR', () => {
    it('should create a PR with provided options', async () => {
      const pr = await client.createPR({
        title: 'Test PR',
        body: 'Test description',
        head: 'feature-branch',
        base: 'main',
        agentId: 'test-agent',
        labels: ['enhancement'],
        autoMerge: true,
      });

      expect(pr.number).toBe(1);
      expect(pr.title).toBe('Test PR');
      expect(pr.branch).toBe('feature-branch');
      expect(pr.agentId).toBe('test-agent');
      expect(pr.autoMergeEnabled).toBe(true);
      expect(pr.status).toBe('open');
      expect(pr.ciStatus).toBe('pending');
    });

    it('should default autoMerge to false when not specified', async () => {
      const pr = await client.createPR({
        title: 'Test PR',
        body: 'Test description',
        head: 'feature-branch',
        base: 'main',
      });

      expect(pr.autoMergeEnabled).toBe(false);
    });

    it('should generate correct PR URL', async () => {
      const pr = await client.createPR({
        title: 'Test PR',
        body: 'Test description',
        head: 'feature-branch',
        base: 'main',
      });

      expect(pr.url).toBe('https://github.com/test-owner/test-repo/pull/1');
    });

    it('should set creation timestamps', async () => {
      const before = new Date();
      const pr = await client.createPR({
        title: 'Test PR',
        body: 'Test description',
        head: 'feature-branch',
        base: 'main',
      });
      const after = new Date();

      expect(pr.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(pr.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(pr.updatedAt).toEqual(pr.createdAt);
    });
  });

  describe('getPR', () => {
    it('should return null for mock implementation', async () => {
      const result = await client.getPR(1);
      expect(result).toBeNull();
    });
  });

  describe('listOpenPRs', () => {
    it('should return empty array for mock implementation', async () => {
      const result = await client.listOpenPRs();
      expect(result).toEqual([]);
    });
  });

  describe('listPRsByAgent', () => {
    it('should return empty array for mock implementation', async () => {
      const result = await client.listPRsByAgent('test-agent');
      expect(result).toEqual([]);
    });
  });

  describe('getCIStatus', () => {
    it('should return pending for mock implementation', async () => {
      const result = await client.getCIStatus(1);
      expect(result).toBe('pending');
    });
  });

  describe('allChecksPassed', () => {
    it('should return false for mock implementation', async () => {
      const result = await client.allChecksPassed(1, ['build', 'test']);
      expect(result).toBe(false);
    });
  });

  describe('mergePR', () => {
    it('should return false for mock implementation', async () => {
      const result = await client.mergePR(1);
      expect(result).toBe(false);
    });

    it('should accept merge method parameter', async () => {
      const result1 = await client.mergePR(1, 'merge');
      const result2 = await client.mergePR(1, 'squash');
      const result3 = await client.mergePR(1, 'rebase');

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });
  });

  describe('closePR', () => {
    it('should return false for mock implementation', async () => {
      const result = await client.closePR(1);
      expect(result).toBe(false);
    });

    it('should accept optional comment', async () => {
      const result = await client.closePR(1, 'Closing due to inactivity');
      expect(result).toBe(false);
    });
  });

  describe('addLabels', () => {
    it('should complete without error', async () => {
      await expect(client.addLabels(1, ['bug', 'help-wanted'])).resolves.not.toThrow();
    });
  });

  describe('removeLabels', () => {
    it('should complete without error', async () => {
      await expect(client.removeLabels(1, ['wip'])).resolves.not.toThrow();
    });
  });

  describe('addComment', () => {
    it('should complete without error', async () => {
      await expect(client.addComment(1, 'Test comment')).resolves.not.toThrow();
    });
  });

  describe('getComments', () => {
    it('should return empty array for mock implementation', async () => {
      const result = await client.getComments(1);
      expect(result).toEqual([]);
    });
  });

  describe('branchExists', () => {
    it('should return false for mock implementation', async () => {
      const result = await client.branchExists('feature-branch');
      expect(result).toBe(false);
    });
  });

  describe('createBranch', () => {
    it('should complete without error', async () => {
      await expect(client.createBranch('new-branch', 'main')).resolves.not.toThrow();
    });
  });

  describe('deleteBranch', () => {
    it('should complete without error', async () => {
      await expect(client.deleteBranch('old-branch')).resolves.not.toThrow();
    });
  });
});

describe('PRManager', () => {
  let client: GitHubClient;
  let manager: PRManager;

  beforeEach(() => {
    client = new GitHubClient({
      token: 'test-token',
      owner: 'test-owner',
      repo: 'test-repo',
    });
    manager = new PRManager(client);
  });

  describe('recordDecision', () => {
    it('should store decision for PR', () => {
      const decision: PRDecision = {
        prNumber: 1,
        action: 'merge',
        reason: 'All checks passed',
        timestamp: new Date(),
      };

      manager.recordDecision(decision);

      expect(manager.getDecision(1)).toEqual(decision);
    });

    it('should overwrite previous decision for same PR', () => {
      const decision1: PRDecision = {
        prNumber: 1,
        action: 'wait',
        reason: 'CI pending',
        timestamp: new Date(),
      };
      const decision2: PRDecision = {
        prNumber: 1,
        action: 'merge',
        reason: 'CI passed',
        timestamp: new Date(),
      };

      manager.recordDecision(decision1);
      manager.recordDecision(decision2);

      expect(manager.getDecision(1)).toEqual(decision2);
    });
  });

  describe('getDecision', () => {
    it('should return undefined for unknown PR', () => {
      expect(manager.getDecision(999)).toBeUndefined();
    });
  });

  describe('processPR', () => {
    it('should throw error when PR not found', async () => {
      await expect(manager.processPR(1)).rejects.toThrow('PR #1 not found');
    });

    it('should create merge decision when CI passes', async () => {
      // Mock getPR to return a PR
      vi.spyOn(client, 'getPR').mockResolvedValue({
        number: 1,
        title: 'Test PR',
        status: 'open',
        ciStatus: 'success',
        branch: 'feature',
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/test/test/pull/1',
        autoMergeEnabled: false,
      });
      vi.spyOn(client, 'getCIStatus').mockResolvedValue('success');

      const decision = await manager.processPR(1);

      expect(decision.action).toBe('merge');
      expect(decision.reason).toBe('All CI checks passed');
    });

    it('should create review decision when CI fails', async () => {
      vi.spyOn(client, 'getPR').mockResolvedValue({
        number: 1,
        title: 'Test PR',
        status: 'open',
        ciStatus: 'failure',
        branch: 'feature',
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/test/test/pull/1',
        autoMergeEnabled: false,
      });
      vi.spyOn(client, 'getCIStatus').mockResolvedValue('failure');

      const decision = await manager.processPR(1);

      expect(decision.action).toBe('review');
      expect(decision.reason).toContain('failure');
    });

    it('should create review decision when CI has error', async () => {
      vi.spyOn(client, 'getPR').mockResolvedValue({
        number: 1,
        title: 'Test PR',
        status: 'open',
        ciStatus: 'error',
        branch: 'feature',
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/test/test/pull/1',
        autoMergeEnabled: false,
      });
      vi.spyOn(client, 'getCIStatus').mockResolvedValue('error');

      const decision = await manager.processPR(1);

      expect(decision.action).toBe('review');
      expect(decision.reason).toContain('error');
    });

    it('should create wait decision when CI is pending', async () => {
      vi.spyOn(client, 'getPR').mockResolvedValue({
        number: 1,
        title: 'Test PR',
        status: 'open',
        ciStatus: 'pending',
        branch: 'feature',
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/test/test/pull/1',
        autoMergeEnabled: false,
      });
      vi.spyOn(client, 'getCIStatus').mockResolvedValue('pending');

      const decision = await manager.processPR(1);

      expect(decision.action).toBe('wait');
      expect(decision.waitConditions).toContain('CI checks must complete');
    });

    it('should record decision after processing', async () => {
      vi.spyOn(client, 'getPR').mockResolvedValue({
        number: 1,
        title: 'Test PR',
        status: 'open',
        ciStatus: 'success',
        branch: 'feature',
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/test/test/pull/1',
        autoMergeEnabled: false,
      });
      vi.spyOn(client, 'getCIStatus').mockResolvedValue('success');

      await manager.processPR(1);

      expect(manager.getDecision(1)).toBeDefined();
    });
  });

  describe('executeDecision', () => {
    it('should call mergePR for merge decision', async () => {
      const mergeSpy = vi.spyOn(client, 'mergePR').mockResolvedValue(true);

      const decision: PRDecision = {
        prNumber: 1,
        action: 'merge',
        reason: 'Tests passed',
        timestamp: new Date(),
      };

      await manager.executeDecision(decision);

      expect(mergeSpy).toHaveBeenCalledWith(1);
    });

    it('should call closePR for close decision', async () => {
      const closeSpy = vi.spyOn(client, 'closePR').mockResolvedValue(true);

      const decision: PRDecision = {
        prNumber: 1,
        action: 'close',
        reason: 'No longer needed',
        timestamp: new Date(),
      };

      await manager.executeDecision(decision);

      expect(closeSpy).toHaveBeenCalledWith(1, 'No longer needed');
    });

    it('should return true for wait decision without action', async () => {
      const decision: PRDecision = {
        prNumber: 1,
        action: 'wait',
        reason: 'CI pending',
        timestamp: new Date(),
      };

      const result = await manager.executeDecision(decision);

      expect(result).toBe(true);
    });

    it('should return true for review decision without action', async () => {
      const decision: PRDecision = {
        prNumber: 1,
        action: 'review',
        reason: 'Needs review',
        timestamp: new Date(),
      };

      const result = await manager.executeDecision(decision);

      expect(result).toBe(true);
    });
  });

  describe('autoMergeReady', () => {
    it('should return empty array when no PRs', async () => {
      vi.spyOn(client, 'listOpenPRs').mockResolvedValue([]);

      const decisions = await manager.autoMergeReady(['build', 'test']);

      expect(decisions).toEqual([]);
    });

    it('should merge PRs with auto-merge enabled and all checks passed', async () => {
      const mockPR: PRInfo = {
        number: 1,
        title: 'Auto-merge PR',
        status: 'open',
        ciStatus: 'success',
        branch: 'feature',
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/test/test/pull/1',
        autoMergeEnabled: true,
      };

      vi.spyOn(client, 'listOpenPRs').mockResolvedValue([mockPR]);
      vi.spyOn(client, 'allChecksPassed').mockResolvedValue(true);
      vi.spyOn(client, 'mergePR').mockResolvedValue(true);

      const decisions = await manager.autoMergeReady(['build', 'test']);

      expect(decisions).toHaveLength(1);
      expect(decisions[0].action).toBe('merge');
      expect(decisions[0].reason).toContain('Auto-merge');
    });

    it('should not merge PRs without auto-merge enabled', async () => {
      const mockPR: PRInfo = {
        number: 1,
        title: 'Manual PR',
        status: 'open',
        ciStatus: 'success',
        branch: 'feature',
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/test/test/pull/1',
        autoMergeEnabled: false,
      };

      vi.spyOn(client, 'listOpenPRs').mockResolvedValue([mockPR]);
      vi.spyOn(client, 'allChecksPassed').mockResolvedValue(true);

      const decisions = await manager.autoMergeReady(['build', 'test']);

      expect(decisions).toHaveLength(0);
    });

    it('should not merge PRs when checks not passed', async () => {
      const mockPR: PRInfo = {
        number: 1,
        title: 'Failing PR',
        status: 'open',
        ciStatus: 'failure',
        branch: 'feature',
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/test/test/pull/1',
        autoMergeEnabled: true,
      };

      vi.spyOn(client, 'listOpenPRs').mockResolvedValue([mockPR]);
      vi.spyOn(client, 'allChecksPassed').mockResolvedValue(false);

      const decisions = await manager.autoMergeReady(['build', 'test']);

      expect(decisions).toHaveLength(0);
    });

    it('should execute merge decision immediately', async () => {
      const mockPR: PRInfo = {
        number: 1,
        title: 'Auto-merge PR',
        status: 'open',
        ciStatus: 'success',
        branch: 'feature',
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/test/test/pull/1',
        autoMergeEnabled: true,
      };

      vi.spyOn(client, 'listOpenPRs').mockResolvedValue([mockPR]);
      vi.spyOn(client, 'allChecksPassed').mockResolvedValue(true);
      const mergeSpy = vi.spyOn(client, 'mergePR').mockResolvedValue(true);

      await manager.autoMergeReady(['build', 'test']);

      expect(mergeSpy).toHaveBeenCalledWith(1);
    });
  });
});
