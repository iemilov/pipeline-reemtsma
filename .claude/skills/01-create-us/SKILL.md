---
name: create-story
description: Create a Jira user story from meeting transcripts in the transcripts folder
argument-hint: [epic-id]
---

## Workflow: Transcript → User Story

Execute the following steps for Epic **$ARGUMENTS**:

### Step 1: Gather Context
1. Read the Epic details from Jira using the Atlassian tools (use `getJiraIssue` with key `$ARGUMENTS`)
2. Read **all files** in the `transcripts/$ARGUMENTS/` folder (use `textutil -convert txt -stdout` for `.docx` files, `openpyxl` for `.xlsx` files)
3. Synthesize the transcripts into structured requirements: functional requirements, technical details, acceptance criteria, and volume/configuration data

### Step 2: Create Jira User Story
1. Create a new **Story** in the CRM project linked to Epic `$ARGUMENTS` using `createJiraIssue` with `additional_fields: {"customfield_10014": "$ARGUMENTS"}`
2. The story must include:
   - A clear **User Story** statement (Als ... möchte ich ... damit ...)
   - **Background** context from the transcripts
   - **Requirements** with tables where applicable
   - **Business Logic** as numbered steps
   - **Existing fields/objects** referenced in transcripts
   - **Acceptance criteria** as a checklist
3. Set component to `B2C`

### Step 3: Summary
Present a summary of:
- The Jira story key and link
- Key requirements extracted from the transcripts
- Suggested next step: run `/implement-us <story-key>` to generate implementation code

## Important Rules
- Follow all conventions from CLAUDE.md
- Output text in the user story is ALWAYS in German
- Use the Atlassian MCP tools for all Jira operations
- The cloudId for Jira is `2a9f60f6-99f9-4ab6-aedd-ea0fc09fe2d4`
