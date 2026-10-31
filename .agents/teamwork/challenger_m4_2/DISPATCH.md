# Dispatch: Challenger M4_2 (Frontend Empirical & Adversarial Stress Testing)

## Role & Mission
Empirically stress-test the frontend wiring, route guards, standees, and builds:
1. Run production build:
   `npm --prefix apps/web run build`
2. Run empirical checks:
   `node apps/web/scripts/verify_m3_empirical.js`
3. Test adversarial scenarios: Cashier path prefix spoofing, URL query parsing edge cases, customer cart payloads with unexpected types, settlement discount extreme bounds.

## Reference Files
- `e:\Personal-git\inventory-bill management system\.agents\teamwork\ORIGINAL_REQUEST.md`
- `e:\Personal-git\inventory-bill management system\PROJECT.md`
- `e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m4\handoff.md`

## Instructions
Write `handoff.md` with test results, evidence, and explicit Verdict (`APPROVE` or `REQUEST_CHANGES`). Report to orchestrator via `send_message`.

## 2026-10-31T12:23:35Z
From: fa3ad742-3f4a-494a-be4c-6d31e9962f2f
Content: You are challenger_m4_2. Your working directory is `e:\Personal-git\inventory-bill management system\.agents\teamwork\challenger_m4_2`.
You MUST read `e:\Personal-git\inventory-bill management system\.agents\teamwork\ORIGINAL_REQUEST.md` before starting work.
Read your dispatch instructions at `e:\Personal-git\inventory-bill management system\.agents\teamwork\challenger_m4_2\DISPATCH.md`.
Read the worker handoff at `e:\Personal-git\inventory-bill management system\.agents\teamwork\worker_m4\handoff.md`.
Empirically stress-test frontend builds, route guards, standees, and adversarial cases.
Execute:
`npm --prefix apps/web run build`
`node apps/web/scripts/verify_m3_empirical.js`
Write `handoff.md` in your working directory with your empirical evidence and explicit Verdict (`APPROVE` or `REQUEST_CHANGES`). Report to caller via `send_message`.
