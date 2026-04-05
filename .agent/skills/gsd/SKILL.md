---
name: gsd
description: Get Shit Done (GSD) - A spec-driven development system for high-velocity software engineering.
---
# Get Shit Done (GSD)

GSD is a meta-prompting, context engineering, and spec-driven development system designed for high-velocity software engineering. It adds a specialized "agentic loop" to the Gemini CLI.

## Available Workflows

GSD provides several specialized workflows to handle complex development tasks:

| Command | Description |
|---------|-------------|
| `/gsd:new-project` | Researches domain and initializes a new project roadmap. |
| `/gsd:plan-phase` | Researches and creates a detailed implementation plan for a phase. |
| `/gsd:execute-plan` | Autonomously executes a phase plan with atomic commits and verification. |
| `/gsd:debug` | Systematically investigates and fixes bugs using a scientific method. |
| `/gsd:health` | Runs a project health check across all active workstreams. |

## How to Use

### 1. Planning a Phase
To plan a new feature or fix, start by researching the phase:
```bash
/gsd:plan-phase <phase_number>
```
This will produce `PLAN.md` files in `.planning/phases/`.

### 2. Executing a Plan
Once a plan is approved, execute it autonomously:
```bash
/gsd:execute-plan <phase_number>
```
The executor will work through tasks, run tests, and commit changes automatically.

### 3. Debugging
If you encounter a bug, use the systematic debugger:
```bash
/gsd:debug "The symptom of the bug"
```

## Agent Specialized Roles

GSD uses a team of specialized sub-agents:
- **gsd-roadmapper**: Architecture and milestone planning.
- **gsd-planner**: Decomposes phases into executable tasks.
- **gsd-executor**: Implements code changes with atomic commits.
- **gsd-debugger**: Scientific root-cause analysis and fixing.
- **gsd-verifier**: Goal-backward verification of phase completion.
- **gsd-security-auditor**: ASVS-aligned security reviews.

## Configuration

Configuration is stored in `.agent/skills/gsd/get-shit-done/templates/config.json` and session state in `.planning/STATE.md`.
