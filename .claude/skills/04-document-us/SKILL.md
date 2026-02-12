---
name: document-us
description: Create a Confluence documentation page for an epic and all its linked user stories
argument-hint: [epic-id]
---

## Configuration

Before executing, read `pipeline/customer.config.md` for all customer-specific values (Cloud ID, Confluence parent page, documentation language, customer identity).

## Workflow: Epic → Confluence Documentation

Execute the following steps for Epic **$ARGUMENTS**:

### Step 1: Gather Epic & Story Data
1. Fetch the Epic details from Jira using `getJiraIssue` with key `$ARGUMENTS` and the **Cloud ID** from config
2. Search for all user stories linked to the epic using `searchJiraIssuesUsingJql` with JQL: `parent = $ARGUMENTS ORDER BY key ASC`
3. For each story, fetch full details (summary, description, status, acceptance criteria) using `getJiraIssue`
4. Read any relevant implementation files referenced in the stories by exploring the codebase (Apex classes, Flows, Custom Metadata, Custom Fields, etc.)

### Step 2: Build Documentation Content
Structure the Confluence page in **Markdown** format with the following sections:

#### Page Title: `$ARGUMENTS – <Epic Summary>`

1. **Zusammenfassung (Executive Summary)**
   - Brief business context and goal of the epic (2-3 sentences)

2. **Fachliche Beschreibung (Business Description)**
   - Detailed business requirements and process description
   - User personas and their needs
   - Volume data and SLAs if applicable

3. **User Stories**
   For each linked story, create a subsection:
   - **<Story-Key>: <Summary>**
     - Status: current Jira status
     - Fachliche Beschreibung: business-level explanation of the story
     - Technische Umsetzung: technical implementation details (classes, fields, flows, metadata created/modified)
     - Akzeptanzkriterien: acceptance criteria from the story

4. **Technische Architektur (Technical Architecture)**
   - Overview of all Salesforce components created/modified
   - Data model changes (new fields, objects, CMT)
   - Integration points and automation (Flows, Batch Jobs, Scheduled Jobs)
   - Security model (sharing rules, FLS, permissions)

5. **Konfiguration (Configuration)**
   - Any Custom Metadata or Custom Settings and their purpose
   - Schedulable jobs and their cron expressions
   - Environment-specific notes

### Step 3: Find or Create Confluence Page
1. Use `searchConfluenceUsingCql` to check if a page with title `$ARGUMENTS` already exists in the target space
2. If it exists, update the page using `updateConfluencePage`
3. If it does not exist, create a new page using `createConfluencePage` in the appropriate space
4. ALWAYS add the page as a subpage of the **Confluence parent page** from config
5. Present the Confluence page URL to the user

### Step 4: Summary
Present:
- Link to the created/updated Confluence page
- Number of user stories documented
- List of key technical components referenced

## Important Rules
- Follow all conventions from CLAUDE.md
- Output text in the Confluence page uses the **documentation language** from config
- Use the Atlassian MCP tools for all Jira and Confluence operations
- Read **Cloud ID** from `customer.config.md` — do not hardcode
- If no Confluence space is obvious, ask the user which space to use
- ALWAYS create a log file named `<YYYY-MM-DD>-$ARGUMENTS-document-us.txt` in `.claude/skills/04-document-us/logs/` — copy the complete output as text into this file
- Link epic with title `$ARGUMENTS` into the Confluence page

## Error Handling
- If the Epic cannot be fetched from Jira, inform the user with the error details and abort
- If no stories are found linked to the epic, inform the user (the epic may have no children yet) and abort
- If Confluence page creation or update fails, save the generated Markdown content locally in the logs folder and inform the user
- If a specific story cannot be fetched, skip it with a warning but continue documenting the other stories
