---
name: story-testdata
description: Analyze a story to determine the test data it needs — from its FINAL implementation notes when they exist, else from Jira — map the affected objects to the record groups and presets in testdata.config.md, check business rules, write a test data plan next to the notes, and delegate creation to /create-testdata after confirmation
argument-hint: "<story-key> [org-alias]"
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

> **Platform Guard:** This skill requires `Platform = salesforce` in `customer.config.md`. On any other platform, inform the user and abort.

## Configuration

Read before executing:

- `pipeline/customer.config.md` — `Platform`, `Short Name`, `Project Key`, Cloud ID, `## Folder Paths > Implementation Design`
- `pipeline/stack.config.md` — `## Org Configuration > Sandboxes`
- `pipeline/customers/<customer>/testdata.config.md` — `## Record Groups`, `## Presets`, `## Testing Scenarios Enabled by These Records`
- `pipeline/customer.domain.md` — business rules and field pitfalls that decide which record values are valid for a scenario

Inputs: the story key (mandatory), an optional org alias (default: the preset's org from `testdata.config.md`, else the first alias whose purpose contains "User Acceptance"; never a Production alias).

`<notes-dir>` = the Implementation Design path with `<story-key>` replaced, relative to the main repository root (e.g. `implementation-design/AP2-1583/`).

## When to Use / When NOT to Use

- Use before testing a story, to know which preset to load and which extra records the story needs.
- Do NOT use to create the data directly — this skill delegates to `/create-testdata`.

## Workflow

### Step 0: Parse arguments

Story key and org alias as above. Abort if the alias's purpose contains "Production".

### Step 1: Load the story context — notes first

1. If `<notes-dir>/implementation-notes.md` exists and is FINAL: read `## Requirements`, `## Affected Objects & Fields`, `## Acceptance Criteria Mapping`, `## Test Scenarios` and `### Test Data Requirements`. **Skip the Jira fetch** and say so.
2. Otherwise fetch the story with `getJiraIssue` (Cloud ID from config) and extract requirements, acceptance criteria and mentioned objects. If DRAFT notes exist, read their `## Test Scenarios (DRAFT)` as a starting point.
3. If neither is available, abort with the error.

### Step 2: Derive the test data needs

From the scenarios and affected objects, list per scenario: sObjects involved, the record state required (e.g. person account with double opt-in confirmed, loyalty member tier at 700 points, campaign of mechanic M24), and whether the scenario is happy path, negative or edge case.

Print a short analysis block:

```
## Story analysis: <story-key>
Affected objects: ...
Scenarios: T1 ... / T2 ... / T3 ...
Record states needed: ...
```

### Step 3: Match record groups and presets

Map every needed record state to `testdata.config.md`:

| Scenario | Needed record | Record group / record in config | Preset covering it | Gap |
|---|---|---|---|---|

- A state fully covered by an existing record → name group and record number.
- A state covered with a changed field value → name the record and the override (e.g. `TotalBonusPoints__c = 700`).
- A state not covered → **gap**: describe the record to add, in the config's table format.

Recommend the smallest preset that covers the most scenarios, plus the overrides and gaps. Use the preset names exactly as they appear in `## Presets`.

### Step 4: Business rule check

Cross-check every needed record against `customer.domain.md`: status codes, consent fields, brand names, mechanic codes, retention rules. Flag records whose values would be rejected by validation rules or would not trigger the automation under test (e.g. a brand without a loyalty programme, an account without double opt-in). Fix the plan accordingly.

### Step 5: Write the test data plan

`<notes-dir>/testdata-plan.md`:

```markdown
# Test Data Plan: <story-key>

**Org:** <alias>  **Preset:** <preset>  **Created:** <YYYY-MM-DD>

## Scenarios and records
| Scenario | Record | Source (group/record or NEW) | Overrides |
|---|---|---|---|

## Gaps — records to add to testdata.config.md
<field tables in the config's format, or "None">

## Business rule notes
<from Step 4, or "None">

## Execution
/create-testdata <alias> <preset>   # then apply the overrides listed above
```

Also append the gaps to the notes' `### Test Data Requirements` table if the notes exist and the rows are not there yet.

### Step 6: Confirm and delegate

Ask via `AskUserQuestion`: **create now** (run `/create-testdata <alias> <preset>` and then apply the overrides and gap records as additional single-record creates, referencing the run manifest), **plan only**, **adjust** (free text). Never create anything without this confirmation.

### Step 7: Summary and log

Present: preset, scenarios covered, overrides, gaps, plan path, and whether creation ran (with the manifest path).

Create `<YYYY-MM-DD>-<customer-short-name>-<story-key>-story-testdata.json` in `.claude/skills/26-story-testdata/logs/` per the CLAUDE.md JSON schema.

## Important Rules

- FINAL implementation notes are the story source; no Jira fetch when they exist.
- Preset names and record numbers come from `testdata.config.md`; never invent presets.
- Every needed record is checked against the domain rules before it is proposed.
- Creation only through `/create-testdata`, only after confirmation, never on production.
- Gaps are written into the config's table format so they can be pasted into `testdata.config.md`.

## Error Handling

- Story not readable and no notes: abort with the error.
- No preset covers any scenario: propose the record groups individually and mark the story as needing new config records.
- Org alias unknown or production: abort with the allowed aliases.
