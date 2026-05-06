# AGENTS.md

## Project purpose

This repository is an internal launch decision system for a single livestream business scenario.
The system predicts:
- current ready-to-launch quantity
- short-term incremental ready-to-launch quantity
- product status

The system is not a generic admin dashboard.
It must follow the repo's business role boundaries and operation architecture.

---

## Before doing any work

Before making changes, always do the following:

1. Read the relevant project docs first if they exist:
   - 01_SPEC.md
   - 02_INFORMATION_ARCHITECTURE.md
   - 03_WORKFLOW.md
   - 04_DATA_MODEL.md
   - 05_RULES.md
   - 06_PAGES.md
   - 07_ACCEPTANCE.md
2. Summarize the task understanding first.
3. Output a short execution plan before editing code.
4. Do not start broad refactors unless explicitly requested.

If the request is ambiguous, ask for clarification or stop and explain the ambiguity before coding.

---

## Start / run / verify

Use the existing project commands first.
Do not replace the stack or restructure the project unless explicitly requested.

When making changes:
1. run the app locally
2. verify the affected page or API
3. report what was verified

If a task is bug fixing, prefer minimal, high-confidence changes.

---

## Role and workspace boundaries

### Purchaser workspace
Purchaser manages only material follow-up records.
Purchaser can update:
- order status
- production status
- expected ship date
- transit status / transit timing
- expected arrival date
- actual arrival confirmation
- arrival quantity

Purchaser must NOT:
- edit BOM
- allocate shared materials
- change production batch status
- edit launch decision results directly

### Admin workspace
Admin handles:
- product master data
- BOM management
- shared material allocation
- production batch status adjustment
- actual result backfill
- critical data correction

Admin is the only role allowed to do dispatching logic.

### Operator workspace
Operator is read-only.
Operator only views:
- product launch result list
- product detail with key reasons

Operator must not edit underlying process data.

---

## Architecture constraints

Keep these boundaries strict:

1. Product result pages are for viewing decision results.
2. Purchaser workspace is for process tracking records, not batch dispatching.
3. BOM belongs to product management, not the daily operation homepage.
4. Actual result backfill belongs to batch detail, not a standalone generic form.
5. Shared materials must be allocated to pending production batches by admin before entering prediction.
6. Unallocated shared material receipts must not participate in prediction.
7. Non-shared materials can auto-belong to the related product/batch according to rules.
8. The system predicts by production batches, while top-level output is product-level.

If a requested change conflicts with these boundaries, stop and explain before coding.

---

## Do not do these unless explicitly requested

- Do not redesign navigation
- Do not merge multiple workspaces into one generic page
- Do not introduce new business logic silently
- Do not replace production-batch-based prediction with a simpler shortcut
- Do not add notification systems
- Do not add activity/campaign modules
- Do not add import/export flows
- Do not add multi-channel allocation logic
- Do not do broad refactors for style only

---

## Bug-fix mode rules

When the task is a bug fix:

1. Fix only one bug at a time.
2. Do not "also optimize" nearby pages.
3. Keep the diff minimal.
4. Preserve existing business boundaries.
5. If the bug is actually caused by wrong information architecture or wrong data model, explain that first instead of patching blindly.

---

## Definition of done

A task is only considered done if:

1. the requested behavior matches the expected business behavior
2. affected pages / APIs are verified locally
3. no unrelated page or role boundary was broken
4. the response includes:
   - files changed
   - why they were changed
   - how it was verified
   - any remaining risks or assumptions

---

## When repeated mistakes happen

If the same mistake happens again, do not just patch code.
First explain:
1. what assumption was wrong
2. what durable rule should be added to AGENTS.md
3. then update AGENTS.md if requested