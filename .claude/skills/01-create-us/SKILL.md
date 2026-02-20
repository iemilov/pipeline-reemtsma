---
name: create-story
description: Create one or multiple Jira user stories from meeting transcripts in the business/input folder (interactive)
argument-hint: [epic-id]
---

## Configuration

Before executing, read `pipeline/customer.config.md` for customer-specific values (Cloud ID, project key, components, epic link field, locale settings, folder paths), `pipeline/stack.config.md` for Salesforce-specific values (naming prefixes, API version, functional domains), and `pipeline/customer.domain.md` for domain-specific business logic, glossary, field name pitfalls, and linked topic documentation files.

## Workflow: Transcript → User Stories (Interactive)

This skill creates well-structured Jira user stories from meeting transcripts. It supports creating **multiple stories** and uses an **interactive approach** to ensure story quality and optimal implementation readiness.

Execute the following steps for Epic **$ARGUMENTS**:

### Step 1: Gather Context

1. Read the Epic details from Jira using the Atlassian tools (use `getJiraIssue` with key `$ARGUMENTS` and the **Cloud ID** from config)
2. Read **all files** in the **transcript input folder** from config (e.g., `business/input/$ARGUMENTS/`). Use `textutil -convert txt -stdout` for `.docx` files, `openpyxl` for `.xlsx` files
3. Synthesize the transcripts into structured requirements: functional requirements, technical details, acceptance criteria, and volume/configuration data

### Step 2: Propose Story Split (Interactive)

**Analyze the requirements and propose a story split strategy:**

1. **Determine story count**: Based on complexity, technical boundaries, and implementation phases

2. **Propose story cuts**: Each story should be:
   - **Self-contained**: Can be implemented independently (or with minimal dependencies)
   - **Sized appropriately**: Not too large (> 5 days) or too small (< 0.5 days)
   - **Implementation-ready**: Clear requirements for the `/implement-us` skill to generate code
   - **Testable**: Clear acceptance criteria and test scenarios

3. **Common story patterns** (use as guidance):
   - **Data Model**: Custom objects, fields, relationships, page layouts
   - **Permissions & Sharing**: Permission sets, sharing rules, field-level security
   - **Business Logic**: Flows, validation rules, formula fields, triggers
   - **Integrations**: Inbound/outbound APIs, middleware configurations
   - **UI Components**: LWC, Aura components, custom pages
   - **Reporting**: Reports, dashboards, list views

4. **Present the proposal to the user** in a clear format:

   ```
   Based on the requirements, I propose creating [N] stories:

   Story 1: [Title]
   - Scope: [What it includes]
   - Dependencies: [What it depends on, if any]
   - Implementation approach: [Declarative/Code/Mixed]
   - Estimated complexity: [Low/Medium/High]

   Story 2: [Title]
   ...

   Questions:
   - Is this story split appropriate?
   - Should any stories be merged or split further?
   - Are there any missing aspects?
   ```

5. **Ask the user for confirmation** using `AskUserQuestion`:
   - "Is this story split OK?"
   - "Should any stories be merged or split?"
   - "Any changes needed before I create the stories?"

6. **Iterate if needed**: If the user requests changes, revise the proposal and ask again

### Step 3: Create Jira User Stories

**Only after user approval**, create each story with:

1. **Clear User Story statement** (Als ... möchte ich ... damit ...)
2. **Background context** from the transcripts
3. **Requirements** with tables where applicable
4. **Business Logic** as numbered steps (if applicable)
5. **Existing fields/objects** referenced in transcripts (if applicable)
6. **Acceptance criteria** as a checklist
7. **Dependencies** (if any) to other stories in the epic
8. **Technical hints** for implementation (which Salesforce tools to use: Flows, Apex, LWC, etc.)

**Story creation best practices:**

- Link to Epic using the **epic link field** from config (e.g., `additional_fields: {"customfield_10014": "$ARGUMENTS"}`)
- Set component based on context using the **components** from config
- Use descriptive titles (max 70 characters)
- Output text in stories uses the **story language** from config
- Reference other stories in the epic for dependencies

### Step 4: Generate Implementation Notes

**After creating all stories**, generate an implementation notes markdown file for each story:

1. **Create the folder** using the **implementation design path** from config (e.g., `implementation-design/<story-key>/`)

2. **Create the file** `implementation-design/<story-key>/implementation-notes.md` with the following structure:

   ```markdown
   # Implementation Notes: <Story-Key> — <Story Title>

   **Epic:** <Epic-Key>
   **Story:** <Story-Key>
   **Created:** <YYYY-MM-DD>

   ## Summary

   <Brief 2-3 sentence summary of what this story implements>

   ## Requirements

   <Key functional requirements extracted from the transcript, as bullet points>

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

   <Any unresolved questions or assumptions made during story creation>

   ## Notes for `/implement-us`

   <Specific hints for the implementation skill>
   ```

3. **Content guidelines:**
   - Use the **story language** from config for business-facing sections, English for technical sections
   - Be specific about Salesforce API names, not just labels
   - Reference existing codebase patterns discovered during transcript analysis
   - Include enough detail so `/implement-us` can generate code without re-reading the transcripts

### Step 5: Summary

Present a summary of:

- Number of stories created
- Story keys and links
- Implementation notes file paths created
- Dependency graph (if applicable)
- Key requirements extracted from the transcripts
- **Suggested next step**:
  - If stories have dependencies: Start with Story XYZ (no dependencies)
  - If stories are independent: Can be implemented in parallel
  - Command to run: `/implement-us <story-key>` to generate implementation code

## Important Rules

- Follow all conventions from CLAUDE.md
- Output text in user stories uses the **story language** from config
- Use the Atlassian MCP tools for all Jira operations
- Read **Cloud ID** from `customer.config.md` — do not hardcode
- **Be interactive**: Ask questions to clarify requirements, story cuts, and priorities
- **Quality over speed**: Better to ask 3 questions than to create 1 wrong story
- **Implementation-ready**: Each story should be detailed enough for `/implement-us` to generate working code
- ALWAYS create a log file named `<YYYY-MM-DD>-$ARGUMENTS-create-story.txt` in `.claude/skills/01-create-us/logs/` — copy the complete output as text into this file

## Error Handling
- If the Epic cannot be fetched from Jira, inform the user with the error details and abort
- If the transcript input folder does not exist or is empty, inform the user and abort
- If `.docx` conversion via `textutil` fails, try reading the file as plain text or inform the user
- If Jira story creation fails (API error), display the error and offer to retry or save the story content locally

## Story Quality Checklist

Before creating each story, verify:

- [ ] Has clear user story statement (Als/möchte/damit)
- [ ] Has specific, testable acceptance criteria
- [ ] Has clear technical approach hint (Flow/Apex/LWC/Validation Rule/etc.)
- [ ] Dependencies are documented (if any)
- [ ] Scope is clear and bounded (not too large, not too small)
- [ ] Can be implemented with `/implement-us` skill
- [ ] Written in the story language from config
