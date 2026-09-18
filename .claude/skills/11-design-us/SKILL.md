---
name: design-us
description: Create implementation notes for a user story based on customer-specific configuration and codebase analysis. Supports Jira or local Markdown stories (see config)
argument-hint: [story-key]
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

## Configuration

Before executing, read the following customer-specific configuration files:
- `pipeline/customer.config.md` — Atlassian settings (Cloud ID, Project Key, Epic Link Field), locale (**Story Language**, **UI Language** if set), **Folder Paths** (in particular **Implementation Design**), **Story Backend** / **Stories Path** if set, **Platform**, **Short Name**
- `pipeline/stack.config.md` — Tech stack details (naming conventions, API version, org aliases, functional domains, test data factory, code quality rules)
- `pipeline/customer.domain.md` — Business logic, glossary, field name pitfalls, linked topic documentation files
- `pipeline/customers/<customer>/testdata.config.md` — Test data templates and record structures (resolve the active customer from the symlink target of `pipeline/customer.config.md`)


**Notes location — `<notes-dir>`:** take the **Implementation Design** path from `customer.config.md > ## Folder Paths` and substitute `<story-key>` with `$ARGUMENTS`. The path is relative to the **main repository root** (e.g. `implementation-design/AP2-1583/`). If the key is empty, use `implementation-design/$ARGUMENTS/`. Never write notes under `pipeline/`.

## Platform Adaptation

This skill contains Salesforce-specific references (sObjects, Flows, Apex, LWC, Trigger Actions, `force-app/`). Read `Platform` from `customer.config.md`:
- **If `salesforce`:** Follow all steps as written.
- **If not `salesforce`:** Adapt all steps to the project's tech stack as described in `stack.config.md`. Replace Salesforce-specific tooling recommendations (Flows, Apex, LWC, Validation Rules) with the equivalent patterns and frameworks from the stack configuration. Analyze the project's actual source structure instead of `force-app/`.

## Story Backend Adaptation

Read `Story Backend` from `customer.config.md` (default `jira` when the key is absent):
- **If `jira`:** Stories are fetched via the Atlassian MCP tools (`getJiraIssue`, `searchJiraIssuesUsingJql`) with the **Cloud ID** from config.
- **If `markdown`:** Stories are read from local Markdown files at `<Stories Path>/<story-key>.md`. The file has YAML frontmatter with `key`, `title`, `status`, `component`, `epic`, `priority`, `created`, `dependencies`. All Jira calls are replaced with file reads.

## Workflow: User Story → Implementation Notes

Generate implementation notes for story **$ARGUMENTS**:

### Step 1: Read User Story

#### If `Story Backend` is `jira`:
1. Fetch the story with `getJiraIssue` (key `$ARGUMENTS`, Cloud ID from config)
2. Extract all requirements, acceptance criteria, technical details, and dependencies from the description
3. Identify the parent Epic key from `parent` or the **Epic Link Field** from config
4. **Check story dependencies** — read `issuelinks`. If the story has "is blocked by" links, note them for the Dependencies section

#### If `Story Backend` is `markdown`:
1. **Read the story file** at `<Stories Path>/$ARGUMENTS.md`. If it does not exist, list available stories in the Stories Path and ask the user which one to use
2. Parse the YAML frontmatter for `key`, `title`, `status`, `component`, `epic`, `priority`, `dependencies`
3. Extract all requirements, acceptance criteria, technical details, and dependencies from the body
4. **Check story dependencies** — if `dependencies` is non-empty, check whether those story files exist and note their status

#### Both backends:
5. Check whether `<notes-dir>/implementation-notes.md` already exists:
   - **If it exists with DRAFT marker** (`<!-- STATUS: DRAFT -->` or `**Status:** DRAFT`): inform the user that a placeholder from story creation exists and will be replaced with the full design. Proceed without asking — overwriting DRAFT notes is the expected workflow. **Before overwriting, extract the `## Resolved Questions` table (if present)** — these are scope questions already answered during story creation; carry them into Step 3 so they are not re-asked. Also read `## Test Scenarios (DRAFT)` as a starting point for the final test scenarios.
   - **If it exists without DRAFT marker** (finalized notes): inform the user and ask whether to overwrite or abort.
   - **If it does not exist**: proceed normally.
6. **Concept-linked notes (optional):** if the notes carry `**Concept:** <slug>` and a concept dossier exists under `concepts/<slug>/concept.md` (or the path configured as **Concepts** in `customer.config.md`), read it, preserve the `Concept`, `Concept Story ID` and `Concept Revision` fields in the FINAL notes, and carry over its resolved Q&A and design-deferred questions. Check that the story scope still matches the concept revision; if the concept changed materially, say so and treat the difference as an open question in Step 3. If no dossier exists, skip this point silently.

### Step 2: Explore Codebase

Analyze the existing codebase to inform the implementation approach:

1. **Naming conventions** — apply the naming patterns from `stack.config.md > Naming Conventions` (class, object, field, LWC and flow patterns); if the stack config defines component-specific prefixes, resolve the prefix from the story's component
2. **Existing similar implementations** — search for patterns matching the story's requirements (similar Flows, Apex classes, LWC, Validation Rules)
3. **Affected sObjects** — for each object mentioned in the story:
   - List existing custom fields, validation rules, flows, and trigger actions
   - Identify potential conflicts or order-of-execution concerns
4. **Existing metadata** — check what already exists that the implementation can build on or must integrate with
5. **Test patterns** — if Apex is likely needed, read the **Test Data Factory** class named in `stack.config.md > Testing Standards` for existing test data methods
6. **Test data templates** — analyze `testdata.config.md` presets and record sections relevant to this story's affected objects. Identify which existing presets/sections can be reused, and which custom records would need to be added
7. **Domain knowledge** — cross-reference `pipeline/customer.domain.md` for business logic rules, field name pitfalls, and glossary terms relevant to this story
8. **Documentation impact** — if topic documentation exists (`pipeline/customers/<customer>/docs/*.md` or the linked topic files from `customer.domain.md`), grep it for the components identified in points 2–4. Read every matching document before designing — they carry business rules, configuration and known issues the design must respect — and list them in the notes under `## Implementation Guidance` as *expected documentation impact*. No matches, or no documentation, means nothing to declare.

### Step 3: Resolve Open Questions (Interactive)

Before determining the implementation approach, identify and resolve ambiguities. Collect **all** open questions that emerged from Steps 1–2 — do not guess or assume when the answer materially affects the implementation.

**Pre-resolved questions:** if DRAFT notes contained a `## Resolved Questions` table, those answers are already known. Do not re-ask questions whose substance was already covered; verify the answers still hold given the codebase analysis and carry them into the final table. If the codebase contradicts a pre-resolved answer, flag it to the user as a conflict rather than a new open question.

**When to ask the user:**
- The story is ambiguous about scope, behavior, or edge cases
- Multiple valid implementation approaches exist and the trade-offs are significant
- Field types, lengths, or labels are not specified in the story
- It is unclear which object, record type, or page layout is affected
- The naming pattern for a new component is ambiguous (e.g. service vs. helper, subflow vs. trigger flow)
- Dependencies on other stories or existing metadata are unclear
- Business rules from `customer.domain.md` conflict with or are not addressed by the story
- Acceptance criteria are missing, incomplete, or contradictory
- An assumption the design would otherwise have to make silently — confirm it here so it becomes a resolved question instead of an open one at implementation time

**How to ask:**
1. **Batch related questions** — group by topic and present them together with `AskUserQuestion` (up to 4 per call). Do not ask one at a time when several are independent.
2. **Provide context and options** — explain why each question matters and offer concrete options, recommended option first.
3. **Iterate if needed** — if an answer raises follow-ups, ask them before proceeding. Quality of the design document matters more than speed.

**What NOT to ask:**
- Questions answerable from the story, config files, domain knowledge, or codebase exploration
- Pure implementation details decidable during implementation (exact Flow node structure, SOQL syntax)
- Questions where the existing codebase has a clear convention

**Record all Q&A** — every question and answer goes into the `## Resolved Questions` section (Step 5).

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

**Decision criteria:** prefer declarative unless the requirement involves complex logic, bulk operations, external integrations, or cross-object processing that exceeds Flow capabilities.

### Step 5: Generate Implementation Notes

1. **Create the folder** `<notes-dir>` (see *Configuration*)

2. **Create the file** `<notes-dir>/implementation-notes.md` with the following structure:

```markdown
# Implementation Notes: <Story-Key> — <Story Title>

**Epic:** <Epic-Key>
**Story:** <Story-Key>
**Created:** <YYYY-MM-DD>
**Status:** FINAL
**Language:** <Story Language from config> (Business), English (Technical), <UI Language from config, if set> (UI labels/strings)

## Summary

<Brief 2-3 sentence summary of what this story implements>

## Requirements

<Key functional requirements extracted from the story, as bullet points>

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

Test cases derived from the acceptance criteria, with concrete test data requirements.

| # | Scenario | Type | Test data | Expected result |
|---|----------|------|-----------|-----------------|
| T1 | <description> | Happy Path / Negative / Edge Case | <preset or custom records from testdata.config.md> | <what to verify after execution> |

### Test Data Requirements

<If custom records are needed that do not exist in testdata.config.md:>

| Record | sObject | Special characteristic | Config section |
|--------|---------|------------------------|----------------|
| <Name> | <sObject> | <what differs from the standard> | <existing section or "NEW"> |

## Resolved Questions

| # | Question | Answer | Impact on Design |
|---|----------|--------|------------------|
| 1 | <question asked during design> | <user's answer> | <how this affected the approach> |

## Open Questions / Assumptions

<Only items that still need a DECISION by the user or the implementer. Confirmed assumptions live in Resolved Questions (Answer: "Assumption, confirmed"); observations and known platform limits live in Implementation Guidance. `/implement-us` treats every non-empty line here as an open question and stops — write "None" when nothing is open>

## Implementation Guidance

<Specific technical hints for the implementation:>
1. <Detailed instruction with API names, field types, character limits, etc.>
2. <Step-by-step guidance for each component to create/modify>
3. <References to existing patterns found in the codebase>
4. <Test data considerations from testdata.config.md>
5. <Domain-specific pitfalls from customer.domain.md>
6. <Expected documentation impact — topic documents that must be updated after implementation>
```

3. **Content guidelines:**
   - Use the **Story Language** from config for business-facing sections (Summary, Requirements), English for technical sections
   - Be specific about Salesforce API names, not just labels
   - Reference existing codebase patterns discovered during analysis
   - Include enough detail to generate implementation code without re-reading the story
   - For each new field: Type, Length, Label, API Name, Description, Help Text
   - For each new component: the exact metadata type and configuration
   - Reference relevant entries from `testdata.config.md` if the story involves objects with test data templates
   - Flag any field name pitfalls from `customer.domain.md`
   - **Test Scenarios (MANDATORY):** at least one test case per acceptance criterion, with at minimum one **Happy Path**, one **Negative**, and one **Edge Case** if the story involves conditional logic, thresholds, or multi-object relationships. Reference `testdata.config.md` presets by name. Records missing from the config go into *Test Data Requirements*. DRAFT scenarios are a starting point, not a copy — they lack codebase context.

### Step 5.5: Validate Completeness

Before writing the file, verify:
- [ ] `## Test Scenarios` has at least one row per acceptance criterion
- [ ] At least one Happy Path, one Negative, and (if applicable) one Edge Case scenario
- [ ] `### Test Data Requirements` is present if any scenario references records not in `testdata.config.md`
- [ ] `## Resolved Questions` includes all Q&A from Step 3 and any pre-resolved questions carried forward
- [ ] `## Open Questions / Assumptions` contains only items that still need a decision ("None" if none)
- [ ] No template placeholders (`<...>`) and no DRAFT marker remain
- [ ] No internal paths (`pipeline/`, `.claude/`) or skill command names appear in the notes

If any check fails, fix the content before writing the file. After writing, grep the file once for `<` placeholders and `DRAFT` to confirm the mechanical half.

### Step 5.6: Independent Design Review

After writing the notes, dispatch **one independent, read-only review** of the design document via the `Agent` tool (a fresh general-purpose agent, not a fork) with this brief:

> Review the implementation notes at `<notes-dir>/implementation-notes.md` for story `$ARGUMENTS`. Read the referenced source files, `pipeline/customer.domain.md` and `pipeline/stack.config.md`. Do not modify any file. Assess five dimensions: (1) factual correctness against the codebase — do the named classes, flows, fields and patterns exist and behave as described; (2) design soundness — order of execution, bulk safety, sharing, error paths; (3) completeness — every acceptance criterion mapped and tested, dependencies named; (4) internal consistency — no contradictions between sections; (5) convention compliance — naming conventions, declarative-first, domain pitfalls. Return at most 4 KB: a list of findings, each with severity (Blocker / Major / Minor / Info), dimension, location (section or file:line) and a one-sentence fix; then a line `Status: reviewed` and, per dimension, whether it was assessed.

Then **triage every finding**:
- **Accepted** — apply the fix to the notes now.
- **Rejected** — only with a citable evidence anchor (a `file:line` in the repository, or a named section of `customer.domain.md`, `stack.config.md` or the story that contradicts the finding). A rejection without an anchor stays open.
- **Deferred** — move into `## Open Questions / Assumptions`. Deferred Blockers and Majors count as **open**.

**Gate:** if any Blocker or Major remains open after triage, run one more review round against the updated notes (maximum **two** rounds). If Blockers or Majors are still open after round two, do **not** present the design as reviewed clean: name them, mark the run `partial`, and let the user decide between another round and proceeding with the gap documented in the open questions.

Append a `## Design Review` section to the notes: reviewer (agent), date, rounds run, finding counts by severity, and a disposition table (`# | Severity | Finding | Disposition | Evidence / Rationale`). Save each round's raw review output as `<notes-dir>/design-review-round-<n>.md`.

If the review agent errors (no output, crash): mark the review as errored in the `## Design Review` section and in the log, warn the user, and continue.

### Step 6: Present Summary

- Story key and title
- Implementation approach chosen (declarative vs programmatic breakdown)
- Number of components to create/modify
- Dependencies identified
- Questions resolved during the interactive session (count), pre-resolved questions carried forward (count)
- Remaining open questions / assumptions (if any)
- Test scenarios defined (count of Happy Path / Negative / Edge Case)
- Design review result: rounds run, finding counts by severity, dispositions, and whether Blockers/Majors remain open — **an open gate must be stated explicitly**
- File paths of the implementation notes and the review file(s)
- **Suggested next step**: implement the story based on these notes

## Important Rules

- Follow all conventions from CLAUDE.md
- If `Story Backend` is `jira`: use the Atlassian MCP tools for all Jira operations and read the **Cloud ID** from config — never hardcode
- If `Story Backend` is `markdown`: local file reads only
- Prefer declarative solutions over code when both meet the requirement
- Use the naming patterns from `stack.config.md`
- Cross-reference `customer.domain.md` for every field name and business term
- **NEVER include internal paths** (`pipeline/`, `.claude/`, skill names) in the implementation notes — they live in the customer-readable main repository. Use neutral references.
- Never report an open review gate as a clean review
- ALWAYS create a log file `<YYYY-MM-DD>-<customer-short-name>-$ARGUMENTS-design-us.json` in `.claude/skills/11-design-us/logs/` using the JSON structure from CLAUDE.md. Include in `summary`: review rounds, open Blocker/Major count, and the notes path; in `artifacts`: the notes and every review file. A run with an open gate is at best `partial`.

## Error Handling

- Story cannot be fetched (Jira) or story file missing (markdown): report the error, list alternatives where possible, and abort
- Finalized notes already exist: ask whether to overwrite or abort
- Story has no acceptance criteria: warn and ask whether to proceed with requirements only
- The naming pattern for a new component cannot be derived from the stack config: ask the user
- Review agent unavailable or errored: mark as errored, warn, continue — never skip silently
- Review gate still open after two rounds: report the open findings, log `partial`, let the user decide
