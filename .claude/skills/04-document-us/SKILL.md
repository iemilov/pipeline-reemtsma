---
name: document-us
description: Create a Confluence documentation page for an epic and all its linked user stories
argument-hint: [epic-id]
---

## Workflow: Epic → Confluence Documentation

Execute the following steps for Epic **$ARGUMENTS**:

### Step 1: Gather Epic & Story Data
1. Fetch the Epic details from Jira using `getJiraIssue` with key `$ARGUMENTS`
2. Search for all user stories linked to the epic using `searchJiraIssuesUsingJql` with JQL: `"Epic Link" = $ARGUMENTS ORDER BY key ASC`
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
4. Present the Confluence page URL to the user

### Step 4: Summary
Present:
- Link to the created/updated Confluence page
- Number of user stories documented
- List of key technical components referenced

## Important Rules
- Follow all conventions from CLAUDE.md
- Output text in the Confluence page is ALWAYS in German
- Use the Atlassian MCP tools for all Jira and Confluence operations
- The cloudId for Jira/Confluence is `2a9f60f6-99f9-4ab6-aedd-ea0fc09fe2d4`
- If no Confluence space is obvious, ask the user which space to use
- ALWAYS create a log file named `<current date>-`$ARGUMENTS`-04-document-us` in the corresponding sub folder `/skills/<skill name>/logs` following the pattern from CLAUDE.md
- Link epic with title `$ARGUMENTS` into the Confluence page
- ALWAYS add new Confluence Page as a subpage of folder "Projekt: Einführung Salesforce/Architect"
