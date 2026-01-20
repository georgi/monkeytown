# @monkeytown/multi-agent-framework

A TypeScript framework for coordinating autonomous AI agents with GitHub integration.

Extracted from the [Monkeytown](https://github.com/georgi/monkeytown) experiment - an autonomous software civilization where AI agents collaborate through files.

## Features

- **Agent Lifecycle Management**: Define agents with personas, domain ownership, and execution rules
- **Domain Enforcement**: Agents can only write to their assigned paths
- **File-Based Messaging**: Inter-agent communication through a message bus (no direct contact)
- **GitHub Integration**: PR creation, CI monitoring, and auto-merge capabilities
- **Coordinator**: Central orchestrator that runs agents and processes PRs

## Installation

```bash
npm install @monkeytown/multi-agent-framework
```

## Quick Start

```typescript
import {
  Coordinator,
  loadConfig,
  AgentTemplates,
} from '@monkeytown/multi-agent-framework';

// Define your system configuration
const config = loadConfig({
  owner: 'my-org',
  repo: 'my-repo',
  autoMerge: {
    enabled: true,
    requiredChecks: ['build', 'test'],
    mergeDelay: 60000,
    blockingLabels: ['wip', 'do-not-merge'],
  },
  agents: [
    AgentTemplates.founder('founder', '.agents/vision/**'),
    AgentTemplates.architect('architect', '.agents/architecture/**'),
    AgentTemplates.builder('builder', ['src/**', 'packages/**']),
    AgentTemplates.orchestrator('orchestrator', '.agents/decisions/**'),
  ],
});

// Create the coordinator
const coordinator = new Coordinator(config, {
  githubToken: process.env.GITHUB_TOKEN!,
});

// Initialize and run
await coordinator.initialize();
const result = await coordinator.run();

console.log(`Run completed: ${result.status}`);
console.log(`Agents run: ${result.agentResults.length}`);
console.log(`PRs processed: ${result.prDecisions.length}`);
```

## Core Concepts

### Agents

Agents are autonomous units with:
- **Persona**: Name, role, traits, and voice
- **Domain**: File paths they can read/write
- **Schedule**: Optional cron expression for automatic runs

```typescript
const myAgent: AgentConfig = {
  id: 'my-agent',
  persona: {
    name: 'My Agent',
    role: 'Custom role description',
    traits: ['focused', 'precise'],
    voice: 'professional',
  },
  domain: {
    writePaths: ['.agents/my-domain/**'],
    readPaths: ['**/*'], // Optional, defaults to all
  },
  schedule: '0 */6 * * *', // Every 6 hours
};
```

### Message Bus

Agents communicate through file-based messages without direct contact:

```typescript
const messageBus = coordinator.getMessageBus();

// Publish a signal
await messageBus.publish({
  id: 'msg-123',
  from: 'agent-a',
  to: 'broadcast',
  type: 'signal',
  payload: { event: 'task_completed' },
  timestamp: new Date(),
});
```

### PR Auto-Merge

The coordinator monitors PRs and auto-merges when:
1. All required CI checks pass
2. No blocking labels are present
3. Auto-merge is enabled for the PR

```typescript
const prManager = coordinator.getPRManager();
const decisions = await prManager.autoMergeReady(['build', 'test']);
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Coordinator                           │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Agent     │  │   Agent     │  │      Agent          │ │
│  │  Registry   │  │   Context   │  │      Runs           │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┤
│  │                    Message Bus                          │
│  │            (File-based communication)                   │
│  └─────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┤
│  │                 GitHub Integration                      │
│  │     (PR creation, CI monitoring, auto-merge)            │
│  └─────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────┘
```

## Agent Templates

Pre-built templates based on Monkeytown patterns:

- `AgentTemplates.founder`: Vision and direction setting
- `AgentTemplates.architect`: System structure design
- `AgentTemplates.builder`: Code implementation
- `AgentTemplates.orchestrator`: Meta-coordination and decisions

## Configuration

```typescript
const config: SystemConfig = {
  owner: 'org-name',
  repo: 'repo-name',
  defaultBranch: 'main',
  messagingPath: '.agents/messages',
  decisionsPath: '.agents/decisions',
  autoMerge: {
    enabled: true,
    requiredChecks: ['build', 'test', 'lint'],
    mergeDelay: 60000,
    blockingLabels: ['wip', 'do-not-merge', 'blocked'],
  },
  agents: [/* agent configs */],
};
```

## License

MIT
