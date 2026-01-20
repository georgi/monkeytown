/**
 * Example: Setting up a multi-agent system
 *
 * This example shows how to configure and run a multi-agent
 * system similar to Monkeytown using this framework.
 */

import {
  Coordinator,
  loadConfig,
  AgentTemplates,
  BaseAgent,
  AgentRegistry,
  type AgentConfig,
  type AgentContext,
  type AgentRunResult,
  type AgentMessage,
} from '../src/index.js';

/**
 * Custom agent implementation example
 */
class CustomAgent extends BaseAgent {
  async generatePrompt(context: AgentContext): Promise<string> {
    const relevantFiles = context.repositoryFiles
      .filter((f) => this.canRead(f))
      .slice(0, 10);

    return `
You are ${this.config.persona.name}, ${this.config.persona.role}.

Your traits: ${this.config.persona.traits.join(', ')}
Your voice: ${this.config.persona.voice}

${this.config.promptTemplate ?? ''}

Recent repository activity:
${relevantFiles.map((f) => `- ${f}`).join('\n')}

Messages for you:
${context.messages.map((m) => `- ${m.type} from ${m.from}: ${JSON.stringify(m.payload)}`).join('\n')}

Produce your output now. Remember:
- Never ask questions
- Always produce output
- Write only in your domain: ${this.config.domain.writePaths.join(', ')}
`;
  }

  async execute(context: AgentContext): Promise<AgentRunResult> {
    const startTime = Date.now();
    this.setStatus('running');

    try {
      // Generate prompt (would be sent to LLM in production)
      const prompt = await this.generatePrompt(context);
      console.log(`Agent ${this.id} prompt generated (${prompt.length} chars)`);

      // Simulate work
      const filesChanged: string[] = [];

      // In production, this would:
      // 1. Send prompt to LLM
      // 2. Parse LLM response for file changes
      // 3. Apply changes within allowed domain
      // 4. Commit and create PR

      this.setStatus('completed');

      return {
        agentId: this.id,
        status: 'success',
        filesChanged,
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
        output: `Agent ${this.id} completed successfully`,
      };
    } catch (error) {
      this.setStatus('error');
      return {
        agentId: this.id,
        status: 'failure',
        filesChanged: [],
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
      };
    }
  }

  async handleMessage(message: AgentMessage): Promise<void> {
    console.log(`Agent ${this.id} received message:`, message.type);
    // Process message - could influence next run
  }
}

/**
 * Main example function
 */
async function main() {
  // 1. Create system configuration
  const config = loadConfig({
    owner: 'my-org',
    repo: 'my-repo',
    defaultBranch: 'main',
    messagingPath: '.agents/messages',
    decisionsPath: '.agents/decisions',
    autoMerge: {
      enabled: true,
      requiredChecks: ['build', 'test', 'lint'],
      mergeDelay: 60000,
      blockingLabels: ['wip', 'do-not-merge'],
    },
    agents: [
      // Use built-in templates
      AgentTemplates.founder('founder', '.agents/vision/**'),
      AgentTemplates.architect('architect', '.agents/architecture/**'),
      AgentTemplates.orchestrator('orchestrator', '.agents/decisions/**'),

      // Or define custom agents
      {
        id: 'builder',
        persona: {
          name: 'MonkeyBuilder',
          role: 'Code implementation specialist',
          traits: ['pragmatic', 'skilled', 'quality-focused'],
          voice: 'code speaks louder than words',
        },
        domain: {
          writePaths: ['src/**', 'packages/**', 'web/**', 'server/**'],
          readPaths: ['**/*'], // Can read everything
        },
        schedule: '0 */6 * * *', // Every 6 hours
        promptTemplate: `
You translate vision into working software.
Read all agent outputs in .agents/** to understand what to build.
Write clean, tested, maintainable code.
`,
      },
    ],
  });

  // 2. Set up agent registry with factory
  const registry = new AgentRegistry();
  registry.register('custom', (agentConfig: AgentConfig) => new CustomAgent(agentConfig));

  // 3. Create agents from config
  for (const agentConfig of config.agents) {
    registry.createAgent('custom', agentConfig);
  }

  // 4. Create coordinator
  const coordinator = new Coordinator(config, {
    githubToken: process.env.GITHUB_TOKEN ?? 'test-token',
    registry,
  });

  // 5. Initialize and run
  await coordinator.initialize();

  console.log('Coordinator status:', coordinator.getStatus());

  // Run all agents
  const result = await coordinator.run({
    dryRun: true, // Set to false in production
  });

  console.log('\n--- Run Result ---');
  console.log('Status:', result.status);
  console.log('Agents run:', result.agentResults.length);
  console.log('PR decisions:', result.prDecisions.length);
  console.log('Duration:', result.durationMs, 'ms');

  if (result.errors.length > 0) {
    console.log('Errors:', result.errors);
  }

  // 6. Stop coordinator
  await coordinator.stop();
}

// Run example
main().catch(console.error);
