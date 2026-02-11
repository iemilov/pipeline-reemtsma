---
name: create-story
description: Create one or multiple Jira user stories from meeting transcripts in the business/input folder (interactive)
argument-hint: [epic-id]
---

## Workflow: Transcript → User Stories (Interactive)

This skill creates well-structured Jira user stories from meeting transcripts. It supports creating **multiple stories** and uses an **interactive approach** to ensure story quality and optimal implementation readiness.

Execute the following steps for Epic **$ARGUMENTS**:

### Step 1: Gather Context

1. Read the Epic details from Jira using the Atlassian tools (use `getJiraIssue` with key `$ARGUMENTS`)
2. Read **all files** in the `business/input/$ARGUMENTS/` folder (use `textutil -convert txt -stdout` for `.docx` files, `openpyxl` for `.xlsx` files)
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

- Link to Epic using `additional_fields: {"customfield_10014": "$ARGUMENTS"}`
- Set component based on context (B2B or B2C)
- Use descriptive titles (max 70 characters)
- Output text in stories is **ALWAYS in German**
- Reference other stories in the epic for dependencies (e.g., "Abhängigkeit: Story XYZ muss zuerst implementiert werden")

### Step 4: Summary

Present a summary of:

- Number of stories created
- Story keys and links
- Dependency graph (if applicable)
- Key requirements extracted from the transcripts
- **Suggested next step**:
  - If stories have dependencies: Start with Story XYZ (no dependencies)
  - If stories are independent: Can be implemented in parallel
  - Command to run: `/implement-us <story-key>` to generate implementation code

## Important Rules

- Follow all conventions from CLAUDE.md
- Output text in user stories is **ALWAYS in German**
- Use the Atlassian MCP tools for all Jira operations
- The cloudId for Jira is `2a9f60f6-99f9-4ab6-aedd-ea0fc09fe2d4`
- **Be interactive**: Ask questions to clarify requirements, story cuts, and priorities
- **Quality over speed**: Better to ask 3 questions than to create 1 wrong story
- **Implementation-ready**: Each story should be detailed enough for `/implement-us` to generate working code
- ALWAYS create a log file named `<YYYY-MM-DD>-$ARGUMENTS-create-story.txt` in `.claude/skills/01-create-us/logs/` — copy the complete output as text into this file

## Error Handling
- If the Epic cannot be fetched from Jira, inform the user with the error details and abort
- If the `business/input/$ARGUMENTS/` folder does not exist or is empty, inform the user and abort
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
- [ ] Written in German (except code examples)
