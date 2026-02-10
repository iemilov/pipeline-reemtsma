---
name: architecture-overview
description: Generate a comprehensive technical architecture and functionality overview of the Salesforce repository for Lotto BW as a customer
argument-hint: [confluence-space-key (optional)]
---

## Workflow: Repository → Architecture & Functionality Overview

Generate a complete technical architecture and functionality overview of this Salesforce repository, tailored for Lotto Baden-Württemberg as a customer.

### Step 1: Analyze Repository Structure
1. Explore the full `force-app/main/default/` directory structure to identify all metadata types present
2. Count and categorize all components:
   - Apex classes (group by prefix: `STLG_` vs `STLGS_` vs other)
   - Lightning Web Components (`lwc/`)
   - Aura components (`aura/`)
   - Flows (`flows/`)
   - Triggers (`triggers/`)
   - Custom Objects & Fields (`objects/`)
   - Custom Metadata Types
   - Custom Labels, Permission Sets, Profiles, Layouts, Validation Rules
   - Any other metadata types found
3. Read `sfdx-project.json` for project configuration and API version

### Step 2: Analyze Functional Domains
1. **B2C / Service Desk Domain (`STLG_`)**
   - Identify all Apex classes, LWC, Flows, and triggers with the `STLG_` prefix
   - Group them by functionality (case management, person accounts, integrations, batch jobs, etc.)
   - Read key classes to understand their purpose (focus on service classes, batch jobs, controllers)
   - Identify external integrations (REST callouts, named credentials, connected apps)

2. **B2B / Sales & Store Domain (`STLGS_`)**
   - Identify all components with the `STLGS_` prefix
   - Group by functionality (store management, visit reports, test purchases, retail operations)
   - Read key classes to understand their purpose
   - Identify B2B-specific integrations

3. **Shared / Cross-cutting Concerns**
   - Trigger Action Framework usage: read `Trigger_Action__mdt` metadata to map which trigger actions fire on which objects
   - Custom Metadata configurations
   - Utility classes and shared services
   - Scheduled and Batch jobs (identify all `Schedulable` and `Database.Batchable` implementations)

### Step 3: Analyze Data Model
1. Scan `objects/` directory for all custom objects and their fields
2. Identify record types per object
3. Map key relationships between objects
4. Note any custom metadata types and their purpose

### Step 4: Analyze Automation & Integrations
1. **Flows:** Read all flow metadata to identify process automations, screen flows, and scheduled flows
2. **Batch Jobs:** List all batch and schedulable Apex classes with their purpose
3. **Integrations:** Identify all callout classes, named credentials, and external services
4. **Email Services:** Identify any email-related automation

### Step 5: Analyze CI/CD & Deployment
1. Read Azure Pipeline configuration (`azure-pipelines.yml` or similar)
2. Document the branch strategy and deployment flow
3. Note delta deployment approach and tools used
4. List deployment versions from `deployment/` directory

### Step 6: Build Confluence Page
Structure the Confluence page in **Markdown** format with the following sections:

#### Page Title: `Technische Architektur – Salesforce Lotto BW`

1. **Einleitung (Introduction)**
   - Purpose of the Salesforce implementation for Lotto Baden-Württemberg
   - High-level description of the two main domains (B2C Service Desk & B2B Sales/Store)

2. **Architekturübersicht (Architecture Overview)**
   - Component statistics table (number of Apex classes, LWC, Flows, etc.)
   - Naming conventions and prefixes
   - API version and platform details
   - Trigger Action Framework explanation

3. **Funktionale Domänen (Functional Domains)**

   3.1 **B2C – Service Desk & Kundenmanagement (`STLG_`)**
   - Business purpose and key processes
   - Component listing grouped by functionality
   - Key automations and their triggers

   3.2 **B2B – Vertrieb & Filialmanagement (`STLGS_`)**
   - Business purpose and key processes
   - Component listing grouped by functionality
   - Key automations and their triggers

4. **Datenmodell (Data Model)**
   - Custom objects and their purpose
   - Key fields and record types
   - Relationships diagram (text-based)

5. **Integrationen (Integrations)**
   - External system connections
   - Named credentials and endpoints
   - Batch and scheduled jobs overview table (class name, schedule, purpose)

6. **Automatisierungen (Automations)**
   - Flows overview table (name, type, object, purpose)
   - Trigger Actions overview table (object, event, class, order)
   - Validation Rules summary

7. **Sicherheit & Berechtigungen (Security & Permissions)**
   - Permission sets and their purpose
   - Sharing model notes
   - Profile customizations

8. **CI/CD & Deployment**
   - Branch strategy diagram (text-based)
   - Pipeline stages and environments
   - Delta deployment approach
   - Release versioning

9. **Codequalität (Code Quality)**
   - PMD rules and thresholds
   - ESLint configuration
   - Testing approach and conventions

### Step 7: Publish to Confluence
1. Use `searchConfluenceUsingCql` to check if a page with title `Technische Architektur – Salesforce Lotto BW` already exists
2. If it exists, update the page using `updateConfluencePage`
3. If it does not exist, create a new page using `createConfluencePage`
   - If `$ARGUMENTS` is provided, use it as the space key
   - Otherwise, ask the user which Confluence space to use
4. ALWAYS add the page as a subpage of folder "Projekt: Einführung Salesforce/Architect"
5. Present the Confluence page URL to the user

### Step 8: Summary
Present:
- Link to the created/updated Confluence page
- Total component count by type
- Key findings and architectural highlights
- Any recommendations or observations

## Important Rules
- Follow all conventions from CLAUDE.md
- Output text in the Confluence page is ALWAYS in German
- Use the Atlassian MCP tools for all Confluence operations
- The cloudId for Jira/Confluence is `2a9f60f6-99f9-4ab6-aedd-ea0fc09fe2d4`
- ALWAYS create a log file named `<current date>-05-architecture-overview.txt` in the corresponding sub folder `.claude/skills/05-architecture-overview/logs/` — copy the complete output as text into this file
- Be thorough but concise — group similar components rather than listing every single file
- Focus on business value and customer relevance for Lotto BW
- When reading classes, focus on understanding purpose rather than implementation details
- If the repository is very large, prioritize reading service classes, batch jobs, and controllers over test classes and simple DTOs
