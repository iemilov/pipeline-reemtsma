---
name: design-us
description: Create implementation notes for a user story based on customer-specific configuration and codebase analysis. Supports Jira or local Markdown stories (see config)
argument-hint: [story-key]
preferred-runtime: claude-code
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`


> **Runtime hint:** This skill prefers `claude-code` (concept synthesis). If the active `Agent Runtime` (from `customer.config.md`) differs after applying any `## Skill Runtime Overrides`, print the standardized warning from `pipeline/agent-runtime-access.md` §1a and proceed. Record `active_runtime`, `preferred_runtime`, and `runtime_match` in the execution log.

## Configuration

Before executing, read the following customer-specific configuration files:
- `pipeline/customer.config.md` — Atlassian credentials (including `Deployment Type`), locale (including **UI Language** — the language the end-user-facing UI is built in), folder paths, CI/CD settings, **Story Backend**, **Stories Path**, **Story Key Prefix**
- `pipeline/atlassian-access.md` — Atlassian adapter: resolves Jira/Confluence calls to either the Cloud MCP tool or the Data Center curl recipe based on `Deployment Type` *(only needed if `Story Backend` is `jira`)*
- `pipeline/stack.config.md` — Tech stack details (naming prefixes, API version, org aliases, functional domains, code quality rules)
- `pipeline/customer.domain.md` — Business logic, glossary, field name pitfalls, linked topic documentation files
- `pipeline/customers/<customer>/testdata.config.md` — Test data templates and record structures (resolve the active customer from the symlink in `pipeline/customer.config.md`)
- `pipeline/platforms/<Platform>/best-practices.md` — Platform-wide coding best practices (resolve `<Platform>` via `pipeline/bin/config "Platform"`)
- `pipeline/coding-conventions.md` — Customer-specific coding conventions

## Platform Adaptation

This skill contains Salesforce-specific references (sObjects, Flows, Apex, LWC, Trigger Actions, `force-app/`). Read `Platform` from `customer.config.md` (`pipeline/bin/config "Platform"`):
- **If `salesforce`:** Follow all steps as written.
- **If not `salesforce`:** Adapt all steps to the project's tech stack as described in `stack.config.md`. Replace Salesforce-specific tooling recommendations (Flows, Apex, LWC, Validation Rules) with the equivalent patterns and frameworks from the stack configuration. Analyze the project's actual source structure instead of `force-app/`.

## Story Backend Adaptation

Read `Story Backend` from `customer.config.md`:
- **If `jira` (default):** Stories are fetched from Jira via the Atlassian adapter.
- **If `markdown`:** Stories are read from local Markdown files at `<Stories Path>/<story-key>.md` (e.g., `stories/RH-1.md`). The file has YAML frontmatter with `key`, `title`, `status`, `component`, `epic`, `priority`, `created`, `dependencies`. All Jira API calls are replaced with file reads.

## Workflow: User Story → Implementation Notes

Generate implementation notes for Jira story **$ARGUMENTS**:

### Step 1: Read User Story

#### If `Story Backend` is `jira`:
1. Fetch the story details from Jira via the Atlassian adapter's `getJiraIssue` operation (see `pipeline/atlassian-access.md` §3 — branch on `Deployment Type` from `customer.config.md`) with key `$ARGUMENTS`
2. Extract all requirements, acceptance criteria, technical details, and dependencies from the description
3. Identify the parent Epic key from the `parent` or **epic link field** from config
4. **Check story dependencies** — read the `issuelinks` field. If the story has "is blocked by" links, note them for the Dependencies section

#### If `Story Backend` is `markdown`:
1. **Read the story file** at `<Stories Path>/$ARGUMENTS.md` (e.g., `stories/RH-1.md`)
   - If the file does not exist, list available stories in the Stories Path and ask the user which one to use
2. Parse the YAML frontmatter for `key`, `title`, `status`, `component`, `epic`, `priority`, `dependencies`
3. Extract all requirements, acceptance criteria, technical details, and dependencies from the body
4. **Check story dependencies** — if the `dependencies` list in the frontmatter is non-empty, check if those story files exist and note their status

#### Both backends:
5. Check if the implementation notes already exist at `<notes-dir>/implementation-notes.md` — resolve `<notes-dir>` from the **Implementation Design** config path (`pipeline/bin/config "Implementation Design"`, with `<story-key>` → `$ARGUMENTS`; this lives in the customer **config** repo, NOT the repo-root `implementation-design/`; see Step 5). If that config key is empty, fall back to `implementation-design/$ARGUMENTS/`:
   - **If it exists with DRAFT marker** (`<!-- STATUS: DRAFT -->` or `**Status:** DRAFT`): inform the user that a placeholder from story creation exists and will be replaced with the full design. Proceed without asking — overwriting DRAFT notes is the expected workflow. **Before overwriting, extract the `## Resolved Questions` table (if present) — these are scope questions already answered by the user during story creation. Carry them forward into Step 3 so they are not re-asked. Also read the `## Test Scenarios (DRAFT)` section as a starting point for the final test scenarios.**
   - **If it exists without DRAFT marker** (i.e., finalized notes): inform the user and ask whether to overwrite or abort.
   - **If it does not exist**: proceed normally.

#### Concept-linked notes (both backends)

Before overwriting notes, extract `**Concept:** <slug>`, `**Concept Story ID:**`
and `**Concept Revision:**` if present. Preserve these fields in FINAL notes.
Read `pipeline/.claude/skills/00-analyze/references/concept-contract.md`, resolve
`<concept-dir>` using `pipeline/bin/concept-path <slug>` and read the dossier.
Verify stable story mapping and review binding; compare the current backend
story scope and requirements against the linked concept revision. Missing or
mismatched concept evidence must not silently enable narrowed exploration.

Apply the shared Freshness before consumption rules: compare repository commits,
relevant dirty content, requirements/domain/config versions, dependencies and
necessary time-sensitive system facts against the baseline. Re-query facts that
this design relies on against the correct target. Record why unrelated commits
do not affect reuse. For relevant drift investigate affected areas/dependencies;
if the baseline or impact boundary is unclear perform broad exploration. Missing
mandatory evidence blocks a design completion that depends on it.

Only after this check may Step 2 reuse broad analysis and concentrate on the
story's components **and dependencies**. Step 2's test-pattern, domain and
knowledge-impact checks still apply. Carry valid resolved Q&A and assigned
design-deferred questions forward. Concept-level content changes require a new
revision and `/analyze` Steps 6–7; story-only refinements stay in this design's
review. Record the freshness result, concept revision and new evidence in
Implementation Guidance. Do not copy a stale analysis as current evidence.

### Step 2: Explore Codebase

Analyze the existing codebase to inform the implementation approach:

1. **Naming conventions** — verify the correct **naming prefixes** from config (B2C vs B2B component)
2. **Existing similar implementations** — search for patterns matching the story's requirements (similar Flows, Apex classes, LWC, Validation Rules)
3. **Affected sObjects** — for each object mentioned in the story:
   - List existing custom fields, validation rules, flows, and trigger actions
   - Identify potential conflicts or order-of-execution concerns
4. **Existing metadata** — check what already exists that the implementation can build on or must integrate with
5. **Test patterns** — if Apex is likely needed, check the **test data factory** class from config for existing test data methods
6. **Test data templates** — analyze `testdata.config.md` presets and record sections relevant to this story's affected objects. Identify which existing presets/sections can be reused for testing, and which custom records would need to be added
7. **Domain knowledge** — cross-reference `pipeline/customer.domain.md` for business logic rules, field name pitfalls, and glossary terms relevant to this story
8. **Knowledge-base impact** — map the components this story will touch (objects, fields, classes, flows identified in points 2–4) against the customer's knowledge base with the canonical mapper (single source of truth — do not re-derive a grep strategy):
   ```bash
   mkdir -p /tmp/$ARGUMENTS
   pipeline/bin/knowledge-impact <component names or paths> \
     | tee /tmp/$ARGUMENTS/knowledge-impact.txt
   ```
   Every `IMPACT` line names a topic doc that already documents one of these components: **read those docs before designing** — they carry business rules, configuration and known issues the design must respect — and list them in the notes under `## Implementation Guidance` as *expected documentation impact* (they are the docs the implementation run will re-check and hand to the knowledge workflow for updating). `impact=0` (including customers without a knowledge base) means nothing to read or declare — the point no-ops.

   Keep the report file: its `docs=` / `tokens=` / `impact=` counters are the run's **knowledge dose** — how large a knowledge base this design actually had, and how much of it turned out to be relevant. Pass the path to `pipeline/bin/log-skill --knowledge-impact-file` in the logging step so the numbers land in the execution log; without them "does more documentation produce better designs?" is not answerable from the log history, only guessable.

### Step 3: Resolve Open Questions (Interactive)

Before determining the implementation approach, identify and resolve ambiguities. Collect **all** open questions that emerged from Steps 1-2 — do not guess or assume when the answer materially affects the implementation.

**Pre-resolved questions:** If DRAFT notes from story creation contained a `## Resolved Questions` table, those answers are already known. Do not re-ask questions whose substance was already covered. Instead, verify the answers still hold given the codebase analysis — if they do, carry them forward directly into the final Resolved Questions table. If codebase analysis contradicts a pre-resolved answer, flag it to the user as a conflict rather than a new open question.

**When to ask the user:**
- The story is ambiguous about scope, behavior, or edge cases
- Multiple valid implementation approaches exist and the trade-offs are significant
- Field types, lengths, or labels are not specified in the story
- It is unclear which object, record type, or page layout is affected
- The naming prefix (B2C `STLG_` vs B2B `STLGS_`) cannot be determined from the story's component
- Dependencies on other stories or existing metadata are unclear
- Business rules from `customer.domain.md` conflict with or are not addressed by the story
- Acceptance criteria are missing, incomplete, or contradictory
- An assumption the design would otherwise have to make silently — confirm it here so it becomes a resolved question instead of an open one at the implement gate

**How to ask:**
1. **Batch related questions** — group questions by topic and present them together using `AskUserQuestion` (up to 4 questions per call). Do not ask one question at a time when multiple are independent.
2. **Provide context and options** — for each question, explain why it matters and offer concrete options where possible (e.g., "Long Text Area (32,000 chars) or Rich Text Area?"). Put the recommended option first.
3. **Iterate if needed** — if an answer raises follow-up questions, ask those before proceeding. Quality of the design document is more important than speed.

**What NOT to ask:**
- Questions answerable from the Jira story, config files, domain knowledge, or codebase exploration
- Pure implementation details that can be decided during implementation (e.g., exact Flow node structure, SOQL query syntax)
- Questions where there is a clear best practice or convention in the existing codebase

**Record all Q&A** — every question asked and the user's answer will be documented in the "Resolved Questions" section of the implementation notes (Step 4).

### Step 4: Determine Implementation Approach

Based on the requirements, codebase analysis, and resolved questions, decide the optimal approach:

#### Declarative (preferred when feasible)
- Flows (Record-Triggered, Screen, Scheduled, Autolaunched)
- Validation Rules
- Formula Fields / Roll-Up Summary Fields
- Permission Sets / Permission Set Groups
- Sharing Rules
- Page Layouts / Record Types / Flexipages
- Custom Metadata Types / Custom Settings
- List Views / Reports & Dashboards

#### Programmatic (when declarative is insufficient)
- Apex Trigger Actions (Trigger Action Framework)
- Batch Apex + Schedulable
- Apex REST/SOAP Services
- Invocable Apex (callable from Flows)
- Lightning Web Components
- Aura Components (only for extending existing Aura)

**Decision criteria:** Prefer declarative unless the requirement involves complex logic, bulk operations, external integrations, or cross-object processing that exceeds Flow capabilities.

### Step 5: Generate Implementation Notes

**Notes location (resolve from config — do NOT hardcode):** resolve the base folder from the **Implementation Design** path via `pipeline/bin/config "Implementation Design"`, substituting `<story-key>` with `$ARGUMENTS` (e.g. `pipeline/customers/<customer>/implementation-design/$ARGUMENTS/`). This keeps internal design notes in the customer **config** repo (no customer access) instead of the customer-readable main project repo. Only if the config key is empty, fall back to `implementation-design/$ARGUMENTS/`. This resolved folder is referred to as `<notes-dir>` below.

1. **Create the folder** `<notes-dir>`

2. **Create the file** `<notes-dir>/implementation-notes.md` with the following structure:

```markdown
# Implementation Notes: <Story-Key> — <Story Title>

**Epic:** <Epic-Key>
**Story:** <Story-Key>
**Created:** <YYYY-MM-DD>
**Status:** FINAL
**Language:** <Story Language from config> (Business), English (Technical), <UI Language from config> (UI labels/strings)

## Summary

<Brief 2-3 sentence summary of what this story implements>

## Requirements

<Key functional requirements extracted from the Jira story, as bullet points>

## Proposed Implementation Approach

### Salesforce Tools
<List which Salesforce tools/features will be used and why>

### Declarative vs Programmatic
| Component | Type | Rationale |
|-----------|------|-----------|
| <component name> | Flow / Apex / Validation Rule / LWC / ... | <why this approach> |

## Affected Objects & Fields

| Object | Field / Component | Action (New/Modify/Read) | Details |
|--------|-------------------|--------------------------|---------|
| <Object API Name> | <Field or component> | New / Modify / Read | <description> |

## Dependencies

<List dependencies on other stories, existing metadata, or external systems>

## Acceptance Criteria Mapping

| # | Acceptance Criterion | Implementation Component |
|---|---------------------|--------------------------|
| 1 | <criterion from story> | <which component fulfills it> |

## Test Scenarios

Aus den Akzeptanzkriterien abgeleitete Testfälle mit konkreten Testdaten-Anforderungen.

| # | Szenario | Typ | Testdaten | Erwartetes Ergebnis |
|---|----------|-----|-----------|---------------------|
| T1 | <Testfall-Beschreibung> | Happy Path / Negativ / Edge Case | <Preset oder Custom-Records aus testdata.config.md> | <Was nach Ausführung verifiziert werden soll> |

### Testdaten-Anforderungen

<Falls Custom-Records nötig sind die nicht in testdata.config.md existieren:>

| Record | sObject | Besonderheit | Config-Sektion |
|--------|---------|--------------|----------------|
| <Name> | <sObject> | <Was ist anders als Standard> | <existierende Sektion oder "NEU"> |

## Resolved Questions

| # | Question | Answer | Impact on Design |
|---|----------|--------|------------------|
| 1 | <question asked during design> | <user's answer> | <how this affected the implementation approach> |

## Open Questions / Assumptions

<Only items that still need a DECISION by the user or the implementer. Assumptions the design relies on were confirmed in Step 3 and live in `## Resolved Questions` (Answer: "Annahme, bestätigt"); observations, verified findings and known platform limits live in `## Implementation Guidance`. `pipeline/bin/story-gate --phase implement` treats every non-empty line here as an open question and blocks the implementation — write "Keine" when nothing is open>

## Implementation Guidance

<Specific technical hints for the implementation:>
1. <Detailed instruction with API names, field types, character limits, etc.>
2. <Step-by-step guidance for each component to create/modify>
3. <References to existing patterns found in codebase>
4. <Test data considerations from testdata.config.md>
5. <Domain-specific pitfalls from customer.domain.md>
```

3. **Content guidelines:**
   - Use the **story language** from config for business-facing sections (Summary, Requirements), English for technical sections
   - Be specific about Salesforce API names, not just labels
   - Reference existing codebase patterns discovered during analysis
   - Include enough detail to generate implementation code without re-reading the Jira story
   - For each new field: specify Type, Length, Label, API Name, Description, Help Text
   - For each new component: specify the exact metadata type and configuration
   - Reference relevant entries from `testdata.config.md` if the story involves objects with test data templates
   - Flag any field name pitfalls from `customer.domain.md`
   - **Test Scenarios (MANDATORY):** The `## Test Scenarios` section MUST be populated — it is not optional. Derive at least one test case per acceptance criterion. The table must contain at minimum:
     - At least one **Happy Path** scenario
     - At least one **Negativ** scenario (what should NOT happen, or invalid input)
     - At least one **Edge Case** if the story involves conditional logic, thresholds, or multi-object relationships
     Reference existing `testdata.config.md` presets by name (e.g., `uebernahme-np`). If the story requires records that don't exist in the config, describe them in the `### Testdaten-Anforderungen` table. If DRAFT notes from story creation contained preliminary test scenarios, use them as a starting point — refine, expand, and add the Testdaten column with concrete preset references. Do not simply copy DRAFT scenarios verbatim; they lack codebase context.

### Step 5.5: Validate Implementation Notes Completeness

Before writing the file, verify:
- [ ] `## Test Scenarios` table has at least one row per acceptance criterion
- [ ] At least one Happy Path, one Negativ, and (if applicable) one Edge Case scenario
- [ ] `### Testdaten-Anforderungen` is present if any test scenario references records not in `testdata.config.md`
- [ ] `## Resolved Questions` includes all Q&A from Step 3 AND any pre-resolved questions carried forward from DRAFT notes
- [ ] `## Open Questions / Assumptions` contains only items that still need a decision (write "Keine" if none). Confirmed assumptions were moved to `## Resolved Questions`, observations and known limits to `## Implementation Guidance` — the implement gate blocks on every non-empty line here, and an override at implementation time is logged as `story-gate:fail`

If any check fails, fix the content before writing the file.

After writing the file, run the **mechanical half** of this validation — never re-derive it by re-reading the file:

```bash
pipeline/bin/story-gate --notes <notes-dir>/implementation-notes.md --phase design
```

- **`decision=pass`** → proceed to Step 5.6.
- **`decision=block`** → fix every `finding=` line (missing section, placeholder residue, empty Test Scenarios table, leftover DRAFT marker) in the written file and re-run until it passes. This gate runs BEFORE the Step 5.6 review loop on purpose: a reviewer round spent on template residue is a round wasted. Never present the notes as FINAL, and never enter Step 5.6, with this gate open.

The checklist above remains yours to verify — per-criterion test coverage and Q&A completeness are semantic judgements the gate cannot make; the gate owns the mechanical half (structure, markers, residue).

### Step 5.6: Design Review (Cross-Runtime, gated loop)

After writing `<notes-dir>/implementation-notes.md`, dispatch an independent review of the design document, incorporate its findings, and **re-review until the quality gate decides the loop may exit**. This mirrors `/implement-us` Step 6 — the same reviewer-dispatch rules (consult `pipeline/agent-runtime-access.md` §2a) and the same deterministic exit condition (`pipeline/bin/quality-gate`), applied to the design document instead of to code. Catching a Blocker here costs a paragraph; catching it after Step 6 costs an implementation.

1. **Resolve the reviewer runtime** with the shared helper (never re-derive the rules):
   ```bash
   pipeline/bin/review-runtime           # resolved reviewer runtime
   pipeline/bin/review-runtime --check   # exit 0 = usable, 1 = configured reviewer CLI missing
   ```
   - No `Review Runtime` override in `customer.config.md` → review under the **same** runtime via the host's native subagent primitive (§2).
   - If `--check` fails, apply the §2a graceful degradation: warn the user, fall back to the same-runtime subagent review, and record the reviewer actually used in the execution log. Never silently skip the review.

2. **Dispatch the reviewer read-only in the background** (e.g., `codex exec --sandbox read-only -c model_reasoning_summary=detailed -- "$(cat review-prompt.txt)" < /dev/null` when the reviewer is `openai-codex` — see the §2a dispatch table for other runtimes). Follow the §2a **Background dispatch contract**: write the prompt to a file, launch detached with output to a log file (under Claude Code: Bash `run_in_background: true`), arm the §2a progress feed (`pipeline/bin/review-progress review-out.log` — under Claude Code as a Monitor, so every reasoning headline and command of the reviewer lands in the session while it works), and wait for the exit marker with liveness checks — never foreground with a fixed timeout, since thorough reviews legitimately exceed the host's 10-minute foreground cap. This is a **design-document review, not a code review** — no code exists yet.

   **Compose `review-prompt.txt` from the versioned brief `pipeline/briefs/design-review-brief.md`** — fill its placeholders (`{notes_path}`, `{platform}`, `{round}`) and append the run-specific context; do not re-author the reviewer instructions ad hoc. The brief carries the five review dimensions, the read-only rule, the honesty rules, the `Status:` return contract, the ~4KB cap, and the structured return format: findings plus a fenced JSON block valid against `pipeline/schemas/review-findings.schema.json` (findings with severity/category/location, and a per-category `coverage` array — a dimension the reviewer did not assess is `"reviewed": false`, never silently omitted).

3. **Save the review artifacts** (the reviewer is read-only; the host writes the files):
   - the raw review output to `<notes-dir>/design-review-<reviewer-runtime>.md`; from round 2 on, `<notes-dir>/design-review-<reviewer-runtime>-round<n>.md`, so the history of the loop stays inspectable;
   - the reviewer's JSON block, updated with this round's dispositions from sub-step 5, to `<notes-dir>/design-review-round-<n>.findings.json` — **the last round's file is the canonical published artifact**: the logged `final_score` and the gate counts must be exactly reproducible from it with `bin/score-rubric`.

4. **Score the design with `pipeline/bin/score-rubric`** — the arithmetic is computed, never summed in prose. **Execution order within a round:** save the raw review (sub-step 3, first bullet) → triage every finding (sub-step 5) → write the dispositioned findings file (sub-step 3, second bullet) → score it (this sub-step) → gate (sub-step 6). **Exactly one scorer run per round, always over the post-triage file** — scoring the pre-disposition findings would make the logged score irreproducible from the published artifact:
   ```bash
   pipeline/bin/score-rubric --rubric design-review \
     --findings <notes-dir>/design-review-round-<n>.findings.json \
     --out <notes-dir>/design-review-round-<n>.score.txt
   ```
   The canonical rubric is `pipeline/rubrics/design-review.rubric.json`; for readability, its weights (deductions per open Blocker/Major):

   | Category | Weight | Deduction guide |
   |----------|:------:|-----------------|
   | Faktentreue (factual correctness) | 30 | −15 per Blocker, −5 per Major |
   | Design-Tragfähigkeit (design soundness) | 25 | −12 per Blocker, −4 per Major |
   | Vollständigkeit (completeness) | 20 | −10 per Blocker, −4 per Major |
   | Innere Konsistenz (internal consistency) | 15 | −5 per contradiction |
   | Konventionstreue (convention compliance) | 10 | −2 per violation |

   The JSON is canonical — on any divergence the JSON wins. Bands: 🟢 ≥90 (tragfähig) · 🟡 70–89 (überarbeiten) · 🔴 <70 (nicht implementierbar). The scorer emits `score=`, `band=`, per-axis `axis.<slug>=` lines, `blockers=`/`majors=` (the open-or-deferred counts for sub-step 6), and `verdict=complete|incomplete` — an axis with no findings and no `reviewed: true` coverage entry is `null`, and any null axis makes the whole score `unknown` (axis-level "unchecked is not a pass").

   Unlike the code rubric in `06-code-review`, this one needs **no scoping mode** — a design document is a fixed, small artifact, so the weights apply unchanged at every story size. The score complements the findings; it never replaces or overrides them.

5. **Triage every finding (mandatory — findings must not be ignored)** into one of three dispositions:
   - **Accepted** — apply the fix to `implementation-notes.md` now.
   - **Rejected** — only valid with a **citable evidence anchor**: a concrete `file:line` in the repository, or a named section of `customer.domain.md` / `stack.config.md` / `coding-conventions.md` / the story itself that contradicts the finding (typical reason: the finding contradicts live-org or business facts the reviewer could not see). A rejection without such an anchor does **not** close the finding.
   - **Deferred** — move into `## Open Questions / Assumptions` for the implementation phase.

   **Deriving the gate counts (mechanical, never an estimate):** after triage, write the dispositions into this round's `design-review-round-<n>.findings.json` and take `--blockers` / `--majors` from the `blockers=` / `majors=` lines of the sub-step 4 scorer run over that file. The scorer implements exactly the closure rules: a finding is closed only when it was *Accepted and applied* or *Rejected with an evidence anchor* (a rejection without evidence stays open); **Deferred counts as open** — moving a Blocker or Major into the open-questions section postpones it, it does not resolve it. Minor and Info are never passed to the gate. Anyone holding the findings file can recompute both numbers and reach the same verdict.

6. **Evaluate the quality gate.** After **every** review round, let the gate decide whether the loop may exit. Do not re-derive the exit condition and do not judge "good enough" yourself — that decision has to be identical under Claude, Codex, and a small local model:
   ```bash
   pipeline/bin/quality-gate --check                    # optional: what is the gate here?
   pipeline/bin/quality-gate --round <n> --blockers <b> --majors <m> \
     --score <design rubric total> [--prev-score <previous round's total>]
   ```
   - Pass the counts from sub-step 5 and the rubric total from sub-step 4 of **this** round; from round 2 on, pass the previous round's total as `--prev-score` so the helper can stop a loop that has stopped converging.
   - **If the scorer answered `verdict=incomplete`** (`score=unknown`): **omit `--score`** — an unmeasured total is not a number. Under a configured threshold the gate then answers `score-unmeasured`; under the threshold-off default it answers `clean`, and the skill **logs `--exit-reason score-unmeasured` regardless** — the gate's *decision* stands, but `clean` must not overclaim a measurement that did not happen (`loop.unscored_axes` names what was missing). Note also: without numeric scores on both rounds the no-progress brake cannot fire, so an incomplete-verdict loop stops only on the round cap.
   - Branch on the `decision=` line:
     - **`pass`** — the design is reviewed clean; continue to Step 6.
     - **`continue`** — apply the accepted fixes and re-dispatch the reviewer against the **updated** notes as round `n+1` (back to sub-step 2).
     - **`stop`** — the loop ends with the gate still **open** (`exit_reason` = `budget-exhausted` or `no-progress`). **Do not present the design as reviewed clean.** Name the remaining Blocker/Major findings, state plainly that the gate did not pass and why, and ask the user whether to keep iterating or to proceed with the gap documented in `## Open Questions / Assumptions`. Accepting an open design gate is the **user's** decision, never the skill's.
   - The gate reads `Quality Gate Score` and `Review Max Rounds` from `customer.config.md > ## Quality Gate` — the same configuration `/implement-us` and `/code-review` use, so a design gate and a code gate are calibrated identically.
   - **The severity gate is not negotiable and not configurable:** open Blocker/Major findings always block, whatever the score. A configured score threshold only ever makes the gate stricter.

7. **Record the review** — append a `## Design Review` section to `implementation-notes.md` containing: reviewer runtime, review date, **rounds run**, the rubric score per round plus the **final score and band**, the **gate verdict and `exit_reason`**, finding counts by severity, and a disposition table (`# | Severity | Finding | Disposition | Evidence / Rationale`). Even when the gate passed, surface a final score in the 🔴 red band (<70) prominently to the user.

8. **If the review itself errors** (CLI crash, timeout, empty output) after the fallback attempt: do not fail the skill run. Mark the review as errored in the `## Design Review` section and in the execution log (`--iterations 1 --exit-reason not-applicable`), then continue to Step 6 with a clear warning to the user.

### Step 5.7: Update linked concept progress

If the notes link a concept, update that stable story row's Notes State and
Design Evidence (concept revision, notes path and actual gate/review artifacts).
Read the complete agreed story set and verify each backend mapping, actual
FINAL notes and required design checks/review before setting `Status: DESIGNED`.
A FINAL header alone, a partial/errored review, an open gate or unresolved
concept-change reconciliation cannot complete the concept. This applies even
when the existing Step 5.6 error path permits presenting the individual notes
with a warning. Preserve unrelated mappings and reread current concept state
before the update. Use the shared contract's progress reset rules after drift.

### Step 6: Present Summary

Present a summary to the user:

- Story key and title
- Implementation approach chosen (declarative vs programmatic breakdown)
- Number of components to create/modify
- Dependencies identified
- Questions resolved during the interactive session (count)
- Pre-resolved questions carried forward from story creation (count, if any)
- Remaining open questions / assumptions (if any)
- Test scenarios defined (count of Happy Path / Negativ / Edge Case)
- Design review result: reviewer runtime, **rounds run**, verdict, finding counts by severity, dispositions (accepted / rejected / deferred), the **design rubric score (/100) and band**, and the **quality-gate outcome** (`pass` / `stop`, with the `exit_reason`) — or the fallback/error note if the configured reviewer was unavailable. **A gate that ended in `budget-exhausted` or `no-progress` MUST be stated here explicitly — the design is not "review-clean" while the gate is open**
- File paths of the generated implementation notes and the design-review report(s)
- **Suggested next step**: Implement the story based on these notes

## Important Rules

- Follow all conventions from CLAUDE.md
- If `Story Backend` is `jira`: Use the Atlassian adapter (`pipeline/atlassian-access.md`) for all Jira operations — branch on `Deployment Type` from `customer.config.md`; never hardcode URLs, Cloud IDs, or PAT env var names
- If `Story Backend` is `markdown`: Use local file reads only — no Atlassian calls needed
- Prefer declarative solutions over code when both can meet the requirement
- Use the correct **naming prefixes** from config (B2C vs B2B based on the story's component)
- Cross-reference `customer.domain.md` for every field name and business term to avoid common pitfalls
- **NEVER include internal paths** (`pipeline/`, `.claude/`, skill names like `/implement-us`) in implementation notes or any other customer-visible output. Use neutral references instead.
- Let `pipeline/bin/quality-gate` decide when the design review loop exits (Step 5.6, sub-step 6) — never judge "good enough" ad hoc, and never report a `stop` outcome as a clean review. A gate that did not pass is a result to surface, not a step to skip
- ALWAYS write the execution log with `pipeline/bin/log-skill` — never hand-author the JSON. Run:
  ```bash
  pipeline/bin/log-skill --skill design-us --identifier $ARGUMENTS --status <success|partial|failed> \
    --preferred-runtime claude-code \
    --summary "<1–2 sentence result>" \
    --artifact <notes-dir>/implementation-notes.md \
    --artifact <notes-dir>/design-review-<reviewer-runtime>.md \
    --artifact <notes-dir>/design-review-round-<n>.findings.json \
    --score-report-file <notes-dir>/design-review-round-<n>.score.txt \
    --knowledge-impact-file /tmp/$ARGUMENTS/knowledge-impact.txt \
    --iterations <review rounds run> --verifier "bin/quality-gate" \
    --exit-reason <clean|score-threshold|score-unmeasured|budget-exhausted|no-progress|not-applicable> \
    --output "<full run text>"
  ```
  It guarantees a schema-valid document and writes it to `pipeline/customers/<customer>/logs/<YYYY-MM-DD>-<customer-short-name>-$ARGUMENTS-design-us.json` (customer, active runtime, and timestamp resolve from config automatically; pass `--artifact` once per created/modified file — including each per-round `design-review-*.md`; the directory is created if needed). Record the Step 5.6 outcome in the `--output` text: reviewer runtime actually used (configured vs. same-runtime fallback), rounds run, score per round, verdict, and finding dispositions.
- **Always pass the knowledge-impact report** (`--knowledge-impact-file`, Step 2.8) — `bin/log-skill` parses `docs=`/`tokens=`/`impact=` out of it into the log's `knowledge_impact` object. Never type those numbers as flag values from memory: the field exists to make the knowledge base's effect measurable, and a recalled number measures nothing. Omit the flag only when Step 2.8 could not run at all — a missing report is a usage error, not a zero
- **Always record the design review loop** with the loop flags above, taking `--iterations` and `--exit-reason` from the last `pipeline/bin/quality-gate` call in Step 5.6 (with the `score-unmeasured` override for incomplete verdicts, sub-step 6). The score is never typed: `--score-report-file` hands `bin/log-skill` the last round's scorer report, from which it parses `final_score`, the per-axis `loop.axes`, and `loop.unscored_axes` — a conflicting `--final-score` is a usage error. This is what makes the loop measurable: `/pipeline-stats` reports rounds-to-green per skill, aggregates axis coverage, and flags loops that habitually exhaust their budget, and `/improve-skills` mines exactly that history. If the review errored entirely, pass `--iterations 1 --exit-reason not-applicable`. A `budget-exhausted` or `no-progress` exit means the run status is at best `partial` — never `success`

## Error Handling

- If `Story Backend` is `jira` and the Jira issue cannot be fetched, inform the user with the error details and abort
- If `Story Backend` is `markdown` and the story file does not exist, list available stories and ask the user
- If implementation notes already exist for this story, ask the user whether to overwrite or abort
- If the story has no acceptance criteria, warn the user and ask whether to proceed with requirements only
- If the story's component (B2C/B2B) cannot be determined, ask the user to clarify the naming prefix
- If the configured cross-runtime reviewer is unavailable (Step 5.6), warn and fall back to a same-runtime review per `pipeline/agent-runtime-access.md` §2a — never silently skip; if the review errors entirely, mark it as errored in the notes and the log and continue
- If the design gate ends in `stop` (Step 5.6, sub-step 6), do **not** abort and do **not** proceed silently: report the open Blocker/Major findings and the `exit_reason`, log the run as `partial`, and let the user decide between another round and proceeding with the gap documented
