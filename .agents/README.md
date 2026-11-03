# .agents/README.md — Agent Operating Manual

This directory is the persistent engineering harness for **goWild**. Every agent session must follow the `inspect -> plan -> implement -> verify -> document` cycle defined in [`LOOP.md`](./LOOP.md).

## Document Index
| File | Purpose | When to Update |
| :--- | :--- | :--- |
| [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) | Product mission, journeys, stack, and non-negotiable constraints | Scope or dependency changes |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Client/BFF boundaries, state ownership, navigation, DB schema | Structural or module changes |
| [`API_CONTRACTS.md`](./API_CONTRACTS.md) | Domain models, `HotelProvider` interface, BFF REST endpoints | Adding/modifying endpoints or DTOs |
| [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) | Grand Hotel Figma tokens + goWild brand lockup & UI primitives | Adding/modifying tokens or UI primitives |
| [`ROADMAP.md`](./ROADMAP.md) | Phases 0–6 deliverables and acceptance criteria | Phase transitions |
| [`TASKS.md`](./TASKS.md) | Granular vertical-slice tasks with dependencies and status | Before and after each task |
| [`PROGRESS.md`](./PROGRESS.md) | Completed, active, blocked, and next items with evidence | End of every milestone/session |
| [`DECISIONS.md`](./DECISIONS.md) | Numbered Architecture Decision Records (ADRs) | Any non-trivial technical choice |
| [`TESTING.md`](./TESTING.md) | Exact verification commands, test suites, and coverage targets | New test suites or tooling updates |
| [`ISSUES.md`](./ISSUES.md) | Observed failures, environment blockers, and root-cause fixes | Whenever an error/blocker occurs |
| [`LOOP.md`](./LOOP.md) | Step-by-step execution protocol and stop conditions | Process updates only |

