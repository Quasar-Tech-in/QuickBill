## 2026-10-31T09:49:00Z
You are Explorer 1 (survey) investigating the frontend for business persona management.

Working directory: e:\Personal-git\inventory-bill management system\.agents\teamwork\explorer_survey_1
Original request file: e:\Personal-git\inventory-bill management system\.agents\teamwork\ORIGINAL_REQUEST.md

Read ORIGINAL_REQUEST.md first.

Objectives:
1. Locate where business persona configuration (`RETAIL`, `CAFE`, `HYBRID`) currently appears in regular tenant store settings (specifically inspect `SettingsView.tsx` and related components).
2. Locate `SuperAdminView` and inspect how tenant management / store details are implemented, edited, and rendered.
3. Investigate how tenant store settings and persona state are stored, fetched, and updated across frontend components (services, API client, hooks, context).
4. Detail the exact changes needed to:
   - Completely remove the business persona toggle from `SettingsView.tsx` (and any other regular tenant settings components).
   - Place and wire the business persona toggle inside tenant management / store details in `SuperAdminView`.
   - Ensure the UI accurately reflects persona changes and handles RBAC (e.g., non-superadmin users don't see or cannot toggle persona).
5. Identify all frontend tests that currently test store settings, persona toggling, or SuperAdminView, and what new frontend tests need to be written.

Output requirements:
Write a comprehensive report to `e:\Personal-git\inventory-bill management system\.agents\teamwork\explorer_survey_1\handoff.md`.
Include concrete file paths, line numbers, component hierarchy, and proposed implementation plan.
When done, send a message to the orchestrator summarizing your findings.
