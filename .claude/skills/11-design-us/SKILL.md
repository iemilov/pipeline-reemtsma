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
6. **Domain knowledge** — cross-reference `pipeline/customer.domain.md` for business logic rules, field name pitfalls, and glossary terms relevant to this story

### Step 3: Determine Implementation Approach

Based on the requirements and codebase analysis, decide the optimal approach:

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

### Step 4: Generate Implementation Notes

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

## Open Questions / Assumptions

<Any unresolved questions or assumptions made during analysis>

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

### Step 5: Present Summary

Present a summary to the user:

- Story key and title
- Implementation approach chosen (declarative vs programmatic breakdown)
- Number of components to create/modify
- Dependencies identified
- Open questions that need clarification
- File path of the generated implementation notes
- **Suggested next step**: `/implement-us $ARGUMENTS`

## Important Rules

- Follow all conventions from CLAUDE.md
- Use the Atlassian MCP tools for all Jira operations
- Read **Cloud ID** from `customer.config.md` — do not hardcode
- Prefer declarative solutions over code when both can meet the requirement
- Use the correct **naming prefixes** from config (B2C vs B2B based on the story's component)
- Cross-reference `customer.domain.md` for every field name and business term to avoid common pitfalls
- ALWAYS create a log file named `<YYYY-MM-DD>-<customer-short-name>-$ARGUMENTS-design-us.txt` in `.claude/skills/11-design-us/logs/` — copy the complete output as text into this file

## Error Handling

- If the Jira issue cannot be fetched, inform the user with the error details and abort
- If implementation notes already exist for this story, ask the user whether to overwrite or abort
- If the story has no acceptance criteria, warn the user and ask whether to proceed with requirements only
- If the story's component (B2C/B2B) cannot be determined, ask the user to clarify the naming prefix
