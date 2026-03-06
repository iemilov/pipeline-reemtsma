---
name: design-us
description: Create implementation notes for an existing Jira user story based on customer-specific configuration and codebase analysis
argument-hint: [story-key]
---

## Configuration

Before executing, read the following customer-specific configuration files:
- `pipeline/customer.config.md` — Atlassian credentials, locale, folder paths, CI/CD settings
- `pipeline/stack.config.md` — Salesforce tech stack (naming prefixes, API version, org aliases, functional domains, code quality rules)
- `pipeline/customer.domain.md` — Business logic, glossary, field name pitfalls, linked topic documentation files
- `pipeline/customers/<customer>/testdata.config.md` — Test data templates and record structures (resolve the active customer from the symlink in `pipeline/customer.config.md`)

## Workflow: User Story → Implementation Notes

Generate implementation notes for Jira story **$ARGUMENTS**:

### Step 1: Read User Story

1. Fetch the story details from Jira using `getJiraIssue` with key `$ARGUMENTS` and the **Cloud ID** from config
2. Extract all requirements, acceptance criteria, technical details, and dependencies from the description
3. Identify the parent Epic key from the `parent` or **epic link field** from config
4. **Check story dependencies** — read the `issuelinks` field. If the story has "is blocked by" links, note them for the Dependencies section
5. Check if `implementation-design/$ARGUMENTS/implementation-notes.md` already exists — if so, inform the user and ask whether to overwrite or abort

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

### Step 3: Resolve Open Questions (Interactive)

Before determining the implementation approach, identify and resolve ambiguities. Collect **all** open questions that emerged from Steps 1-2 — do not guess or assume when the answer materially affects the implementation.

**When to ask the user:**
- The story is ambiguous about scope, behavior, or edge cases
- Multiple valid implementation approaches exist and the trade-offs are significant
- Field types, lengths, or labels are not specified in the story
- It is unclear which object, record type, or page layout is affected
- The naming prefix (B2C `STLG_` vs B2B `STLGS_`) cannot be determined from the story's component
- Dependencies on other stories or existing metadata are unclear
- Business rules from `customer.domain.md` conflict with or are not addressed by the story
- Acceptance criteria are missing, incomplete, or contradictory

**How to ask:**
1. **Batch related questions** — group questions by topic and present them together using `AskUserQuestion` (up to 4 questions per call). Do not ask one question at a time when multiple are independent.
2. **Provide context and options** — for each question, explain why it matters and offer concrete options where possible (e.g., "Long Text Area (32,000 chars) or Rich Text Area?"). Put the recommended option first.
3. **Iterate if needed** — if an answer raises follow-up questions, ask those before proceeding. Quality of the design document is more important than speed.

**What NOT to ask:**
- Questions answerable from the Jira story, config files, domain knowledge, or codebase exploration
- Pure implementation details that `/implement-us` can decide (e.g., exact Flow node structure, SOQL query syntax)
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

1. **Create the folder** `implementation-design/$ARGUMENTS/`

2. **Create the file** `implementation-design/$ARGUMENTS/implementation-notes.md` with the following structure:

```markdown
# Implementation Notes: <Story-Key> — <Story Title>

**Epic:** <Epic-Key>
**Story:** <Story-Key>
**Created:** <YYYY-MM-DD>
**Language:** <Story Language from config> (Business), English (Technical)

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

<Any remaining unresolved questions or assumptions that could not be clarified — flag these for `/implement-us` to handle or for the user to revisit>

## Notes for `/implement-us`

<Specific technical hints for the implementation skill:>
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
   - Include enough detail so `/implement-us` can generate code without re-reading the Jira story
   - For each new field: specify Type, Length, Label, API Name, Description, Help Text
   - For each new component: specify the exact metadata type and configuration
   - Reference relevant entries from `testdata.config.md` if the story involves objects with test data templates
   - Flag any field name pitfalls from `customer.domain.md`
   - For the Test Scenarios section: derive at least one test case per acceptance criterion. Include Happy Path, Negativ-Test, and Edge Case scenarios where applicable. Reference existing `testdata.config.md` presets by name (e.g., `uebernahme-np`). If the story requires records that don't exist in the config, describe them in the "Testdaten-Anforderungen" table — these will later inform updates to `testdata.config.md` and the `/create-testdata` skill.

### Step 6: Present Summary

Present a summary to the user:

- Story key and title
- Implementation approach chosen (declarative vs programmatic breakdown)
- Number of components to create/modify
- Dependencies identified
- Questions resolved during the interactive session (count)
- Remaining open questions / assumptions (if any)
- Test scenarios defined (count of Happy Path / Negativ / Edge Case)
- File path of the generated implementation notes
- **Suggested next step**: `/implement-us $ARGUMENTS`

## Important Rules

- Follow all conventions from CLAUDE.md
- Use the Atlassian MCP tools for all Jira operations
- Read **Cloud ID** from `customer.config.md` — do not hardcode
- Prefer declarative solutions over code when both can meet the requirement
- Use the correct **naming prefixes** from config (B2C vs B2B based on the story's component)
- Cross-reference `customer.domain.md` for every field name and business term to avoid common pitfalls
- ALWAYS create a log file named `<YYYY-MM-DD>-<customer-short-name>-$ARGUMENTS-design-us.json` in `.claude/skills/11-design-us/logs/` — use the structured JSON format from CLAUDE.md

## Error Handling

- If the Jira issue cannot be fetched, inform the user with the error details and abort
- If implementation notes already exist for this story, ask the user whether to overwrite or abort
- If the story has no acceptance criteria, warn the user and ask whether to proceed with requirements only
- If the story's component (B2C/B2B) cannot be determined, ask the user to clarify the naming prefix
