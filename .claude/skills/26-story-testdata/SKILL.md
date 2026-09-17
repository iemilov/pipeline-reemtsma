---
name: story-testdata
description: Analyze a Jira story to determine required test data, check business rules, recommend presets, and delegate to /create-testdata
argument-hint: "<story-key> [org-alias]"
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`


## Platform Guard

This skill requires `Platform: salesforce` in `customer.config.md`. If the active customer uses a different platform, abort with a clear message.

## Configuration

Before executing, read:

1. `pipeline/customer.config.md` — customer identity, Atlassian Deployment Type, Platform, Project Key
2. `pipeline/stack.config.md` — org aliases (default dev org)
3. The active customer's `testdata.catalog.json` (auto-resolved) — specifically `storyTagMapping`, `presets`, and `recordGroups`
4. `pipeline/customers/<customer>/testdata.config.md` — business rules documentation, preset descriptions, testablauf
5. `pipeline/customers/<customer>/docs/b2b-business-rules.md` — validation rules, status preconditions (if it exists)
6. `pipeline/schemas/testdata-impact.schema.json` — the schema for the impact declaration this skill produces in Step 5
7. `pipeline/bin/validate-testdata-impact` — the canonical Node.js/Ajv validator (backed by `cli/lib/testdata/impact-validator.js` and the schema in item 6) used to check that declaration before handing it off

For Jira access, consult `pipeline/atlassian-access.md`.

## When to Use / When NOT to Use

- **Use** for analyzing a Jira story and recommending test data presets
- **Use** when the user asks "Welche Testdaten brauche ich für ...?"
- **Do NOT use** for creating test data → use `/create-testdata` instead (Skill 14)
- **Do NOT use** for deleting test data → use `/cleanup-testdata` instead (Skill 15)

## Related Skills

| Need | Use instead | Why |
|------|------------|-----|
| Create the recommended test data | `/create-testdata` | This skill only analyzes; all DML goes through Skill 14 |
| Delete test data | `/cleanup-testdata` | Skill 15 |

## Workflow: Story → Testdata Analysis → Recommendation

### Step 0 — Parse Arguments

- First argument matching the customer's story-key pattern (from `Project Key` in `customer.config.md`) or a full Jira URL → extract **story key**
- Remaining argument → **org alias** (optional, defaults to dev org from `stack.config.md`)
- If no story key provided, ask the user.

### Step 1 — Load Story Context

1. **Fetch Jira story** via the Atlassian adapter: summary, description, acceptance criteria, component, labels, epic link, status
2. **Check for implementation notes** — resolve the **Implementation Design** path from config (`pipeline/bin/config "Implementation Design"`, with `<story-key>` substituted):
   - If exists: read in full — especially `## Test Scenarios` and `## Testdaten-Anforderungen` sections
   - If not: proceed with story-only analysis

### Step 2 — Derive Tags from Story

Use the `storyTagMapping` from the catalog to derive relevant tags:

1. Extract keywords from story summary + description
2. For each mapping rule in `storyTagMapping`, check if any of the rule's `keywords` appear in the story text
3. Collect the `tags` from all matching rules
4. Also check the story's Jira component — if it matches a tag name, add it

Present the derived tags:

```
## Story-Analyse: <story-key>

**<story-summary>**

Abgeleitete Tags: <tag1>, <tag2>, <tag3>
Quelle: <keyword matches + component>
```

### Step 3 — Match Presets

Use the catalog's `presets` to find matches:

1. For each preset, check if its `recordGroups` contain groups whose `tags` overlap with the derived tags
2. Score each preset:
   - **Exact match:** preset covers all derived tags → `✅ EMPFOHLEN`
   - **Partial match:** preset covers some tags but not all extras → `⚠️ TEILWEISE` + list what's missing
   - **No match:** → skip
3. If implementation notes have a `## Test Scenarios` section, prefer those over tag-derived analysis

Present the recommendation:

```
## Preset-Empfehlung

| Preset | Testdatenart | Match | Details |
|--------|-------------|-------|---------|
| <name> | <E2E/State/...> | ✅/⚠️ | <reason> |

**Empfehlung:** `<preset-name>` [mit <parameter>=<value>]
**Zusätzlich nötig:** <extra sections not in preset>
```

If **no preset matches**, explain what's needed and which record groups from the catalog to combine manually.

### Step 4 — Business Rule Check

If the customer has a business rules document (`b2b-business-rules.md`), verify the recommendation:

1. Read the document and check for rules relevant to the recommended preset
2. If any rule would be violated by the recommended data constellation, warn the user:

```
⚠️ Business-Rule-Check:
- <rule description>
  → <impact on recommendation>
```

### Step 5 — Determine and Declare Testdata Impact

> Skip this step if the active customer has no `testdata.catalog.json`. Customers without a testdata catalog have no impact contract to declare against.

This step turns the analysis above into the machine-readable **testdata-impact contract** (VP-09) that the implementation (`/implement-us` Step 8a) and the review (`/code-review` Step 5a) gates check against. A keyword-derived tag list (Step 2) or a preset match (Step 3) alone is **never** sufficient evidence of impact — this step requires an explicit check of all ten A-11 impact axes, grounded in the story text, the implementation notes, and (once code exists) the actual metadata diff. Per A-11 ("Story-Impact hat mehrere gleichberechtigte Achsen"), `decision: "change"` is valid once **any single** axis below is active — no axis (e.g. a validator module) is pauschal mandatory.

1. **Assemble impact inputs** — the story (Step 1), implementation notes if present (Step 1), the business rules docs (`testdata.config.md`, `b2b-business-rules.md`), and — if the story has already been implemented — the actual metadata diff (`git diff` / the story's feature branch or PR). If this analysis runs before implementation, note that the declaration is provisional and must be re-verified once code exists.
2. **Determine affected modules and presets** — resolve the derived tags (Step 2) and matched presets (Step 3) to concrete catalog identifiers: `validator.modules[].id` for `affectedModules`, `presets[].name` for `affectedPresets`. These two fields are optional cross-references only — the binding axes are `requiredChanges.validatorModules` and `requiredChanges.presets` below.
3. **Check all ten impact axes** explicitly (A-11):
   - **Katalog** — new/changed `recordGroups` or `presets` needed in `testdata.catalog.json`?
   - **Presets** — a new preset, or a changed existing preset (`presets[].name`)?
   - **Record Groups** — new/changed `records` arrays needed in existing or new record groups?
   - **Validator-Module** — new/changed validator rule modules needed (`validator.modules[].id`)?
   - **Validator-Profile** — new/changed validator profiles needed (`validator.profiles[].id`)?
   - **Capabilities** — new required capabilities (objects/fields/Record Types) that must be checked before DML?
   - **Cleanup** — changes needed to `deletionOrder` / `crossReferenceFields` / manifest relations?
   - **Story-Tag-Zuordnung** — new keywords/tags needed in `storyTagMapping`?
   - **Dokumentation** — updates needed to `testdata.config.md`, `b2b-business-rules.md`, or other docs?
   - **Tests** — new/changed test cases needed for this impact?
4. **Decide `decision`** — `"change"` if any single axis above is non-empty/true, `"none"` only if **all ten** axes are inactive. For `"none"`, write a concrete `noImpactReason` that holds up against the actual metadata diff — not a placeholder restating "keine Tags gefunden."
5. **Write the artifact** to `implementation-design/<story-key>/testdata-impact.json` (same **Implementation Design** path resolved in Step 1), conforming to `pipeline/schemas/testdata-impact.schema.json` — `schemaVersion: "1.0.0"`, `storyKey`, `decision`, `requiredChanges` with all ten axis keys present (each explicitly set to its active value or its inactive default — `false`/`[]` — even when the axis does not apply; no single axis needs to be active), plus `affectedModules` / `affectedPresets` / `businessRules` / `tests` / `pilotPreset` where applicable.
6. **Validate the artifact** against the canonical Node.js/Ajv entry point (there is no separate hand-written check — the schema in `pipeline/schemas/testdata-impact.schema.json` is the single source of truth):
   ```bash
   pipeline/bin/validate-testdata-impact implementation-design/<story-key>/testdata-impact.json
   ```
   Fix and re-run until it reports `VALID`. Do not hand off an unvalidated artifact — an invalid declaration is treated by the downstream gates exactly like a missing one.

### Step 6 — Confirm and Delegate

Use the planner to get accurate record counts (includes transitive dependency resolution).
Always pass `--project-root .` so the planner can report executor availability:

```bash
pipeline/bin/testdata-planner --project-root . plan <preset-name> [--param key=value ...]
```

If the plan shows `executor.fileExists: false`, the preset's executor is not present
on the current branch. This is not a catalog error -- the preset is fachlich planbar
but not executable here. Inform the user that the preset is unavailable on this branch
and suggest an alternative, rather than recommending `/create-testdata`.

Present the final plan (using `totalEstimatedRecords` from the planner output):

```
## Testdaten-Plan für <story-key>

**Org:** <org-alias>
**Preset:** <preset-name> (<testdatenart>)
**Parameter:** <key>=<value>
**Geschätzte Records:** ~N (aus Planer)

Soll ich `/create-testdata <org-alias> <preset-name>` ausführen?
```

Wait for user confirmation. Do NOT proceed without explicit approval.

After confirmation, the user runs `/create-testdata` themselves (or asks you to run it). This skill does **not** invoke `/create-testdata` directly — it produces the analysis and recommendation.

> **Why separate:** `/create-testdata` has its own execution flow (plan, approval gate, execution, validation, logging). Nesting skills creates complexity and makes error recovery harder.

### Step 7 — Write Execution Log

ALWAYS write the execution log with `pipeline/bin/log-skill`:
```bash
pipeline/bin/log-skill --skill story-testdata --identifier <story-key> --status <success|partial|failed> \
  --summary "<1-2 sentence result>" --artifact implementation-design/<story-key>/testdata-impact.json \
  --output "<full run text>"
```
The execution log is written into `pipeline/customers/<customer>/logs/`, the active customer's config repo — never into the shared pipeline repo.

Pass `--artifact` for the `testdata-impact.json` written in Step 5 whenever that step ran (skip the flag if the customer has no testdata catalog and Step 5 was skipped).

## Important Rules

- **Never create test data directly.** This skill only analyzes and recommends. All DML goes through `/create-testdata`.
- **Always read business rules** before recommending. Never assume entity relationships.
- If the story is ambiguous about which preset family to use, **ask the user** — don't guess.
- If no preset matches, say so clearly and list which record groups to combine manually.
- If implementation notes have a `## Test Scenarios` section, prefer those over keyword-derived analysis — the author already thought about what's needed.
- Use the catalog's `storyTagMapping` for keyword-to-tag derivation — do not hardcode keyword tables.
- **Never accept a keyword/tag match or a preset match as complete impact evidence.** Step 5's testdata-impact artifact requires an explicit check of all ten A-11 axes (catalog, presets, executors, validator modules, validator profiles, capabilities, cleanup, story-tag mapping, documentation, tests) — write and validate it whenever the customer has a `testdata.catalog.json`. No single axis is pauschal mandatory for `decision: "change"`.
