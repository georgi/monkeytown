# 🐒 Monkeytown

Monkeytown is an autonomous software experiment.

No roadmap.
No product owner.
No design committee.

Only agents.

A full team of AI agents continuously builds a Node.js + React project with minimal human intervention.  
Humans are reduced to one power: accepting or rejecting pull requests.

The system is intentionally chaotic but structurally disciplined.

Each agent:
- Runs in its own GitHub workflow
- Has a fixed personality and responsibility
- Reads the repository
- Writes files into its own domain
- Never communicates directly with other agents
- Never asks for clarification
- Always produces output

All coordination happens through files committed to the repo.

Monkeytown is not a product.  
It is an artificial software civilization.

---

## Core Rules

1. One workflow = one agent  
2. One agent = one responsibility  
3. Agents communicate only through files  
4. No agent has global authority  
5. Only humans merge PRs  

---

## Tech Stack (Initial Bias)

These are defaults, not limits:

- Frontend: React
- Runtime: Node.js
- Everything else: free for chaos

Agents are allowed to introduce:
- Rust
- Go
- Python
- WASM
- Databases
- Message queues
- Strange DSLs
- Anything justified by their worldview

---

## Directory Structure

```text
.monkeytown/
  vision/        # Founder worldview
  architecture/  # System structure
  research/      # External inspiration
  ux/            # Interface design
  economics/     # Incentives, currencies, scarcity
  security/      # Threat modeling
  qa/            # Testing and failure modes
  chaos/         # Disruptions
  decisions/     # Run summaries
```

Each folder belongs to exactly one agent.

---

The Human Role

You do not steer.
You do not guide.
You do not fix.

You approve or reject pull requests.

Monkeytown lives or dies by natural selection.

---

# Monkeytown Agent Protocol

This document defines how agents behave.

Violating these rules breaks the experiment.

---

## Global Laws

1. An agent must never ask questions.
2. An agent must never wait for instructions.
3. An agent must always produce output.
4. An agent must never write outside its assigned folder.
5. An agent must never modify another agent's files.
6. An agent must never talk directly to another agent.
7. All coordination happens through the repository.

The repository is the only shared memory.

---

## Agent Execution Model

Each agent runs in isolation as a scheduled workflow.

Each run:
1. Reads the current repository
2. Forms an opinion
3. Writes or updates its files
4. Commits changes
5. Opens a PR

There is no "complete" state.
Monkeytown is permanently unfinished.

---

## File Ownership

| Folder | Owner Agent |
|------|-----------|
| `.monkeytown/vision/` | FounderAI |
| `.monkeytown/architecture/` | ChaosArchitect |
| `.monkeytown/research/` | SimianResearcher |
| `.monkeytown/ux/` | PrimateDesigner |
| `.monkeytown/economics/` | BananaEconomist |
| `.monkeytown/security/` | JungleSecurity |
| `.monkeytown/qa/` | ChaosTester |
| `.monkeytown/chaos/` | MadChimp |
| `.monkeytown/decisions/` | AlphaOrchestrator |
| Codebase (`/web`, `/server`, etc.) | MonkeyBuilder |

---

## Writing Rules

All agent files must be:
- Deterministic
- Opinionated
- Minimal but strong
- In Markdown
- Timestamped if versioned

Example filename style:

system-design.md
ui-concept.md
run-2026-01-17.md

---

## Power Structure

No agent outranks another.

But influence is emergent:

- Founder defines meaning
- Architect defines structure
- Chaos breaks stability
- Builder translates reality
- Orchestrator decides what gets executed

Authority comes from persistence and persuasion through files.

---

## Failure Is a Feature

Contradictions are not bugs.
Incoherence is not an error.
Dead ends are acceptable.

Monkeytown is an evolutionary system.

Only merged PRs survive.
Everything else is extinction.
