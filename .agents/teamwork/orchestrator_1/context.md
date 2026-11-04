# Context Log

## Dispatch Context
- Task: Restrict business persona toggle (Retail, Cafe, Hybrid) exclusively to Super Admin users, completely removing it from regular tenant store settings.
- Audit and fix Café persona wiring across components, templates, routes, printing chits, standees, and schemas.
- Integrity mode: development.

## Operating Boundaries & Rules
- Dispatch-only orchestrator: Never edit source code, never run build/test commands, never directly investigate code.
- Always delegate to subagents (Explorers, Workers, Reviewers, Challengers, Auditors).
- State files reside in `.agents/teamwork/orchestrator_1/`.
- Project specification file: `PROJECT.md`.
