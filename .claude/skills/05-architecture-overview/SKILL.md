---
name: architecture-overview
description: Generate a comprehensive technical architecture and functionality overview of the Salesforce repository
argument-hint: [confluence-space-key (optional)]
---

## Configuration

Before executing, read `pipeline/customer.config.md` for customer-specific values (Cloud ID, customer identity, Confluence parent page, documentation language), `pipeline/stack.config.md` for Salesforce-specific values (naming prefixes, API version, org aliases, functional domains, source path, code quality rules), and `pipeline/customer.domain.md` for domain-specific business logic.

## Workflow: Repository → Architecture & Functionality Overview

Generate a complete technical architecture and functionality overview of this Salesforce repository.

**Scope Guidance:** This skill analyzes a large repository. Prioritize breadth over depth:
- Read at most 5 representative classes per functional group (service classes, batch jobs, controllers)
- Skip test classes, DTOs, and simple wrapper classes during analysis
- For objects with many custom fields, summarize field counts and highlight only key fields
- For Flows, read the metadata to determine type and trigger but do not trace full logic paths
- Aim for a complete overview rather than exhaustive detail on any single component

### Step 1: Analyze Repository Structure
1. Explore the full `force-app/main/default/` directory structure to identify all metadata types present
2. Count and categorize all components:
   - Apex classes (group by the **naming prefixes** from config)
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

For each **functional domain** defined in config:

1. Identify all Apex classes, LWC, Flows, and triggers with the domain's prefix
2. Group them by functionality (case management, integrations, batch jobs, etc.)
3. Read key classes to understand their purpose (focus on service classes, batch jobs, controllers)
4. Identify external integrations (REST callouts, named credentials, connected apps)

Also analyze:
- **Shared / Cross-cutting Concerns**
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
2. Document the branch strategy and deployment flow (from config)
3. Note delta deployment approach and tools used
4. List deployment versions from `deployment/` directory

### Step 6: Build Confluence Page
Structure the Confluence page in **Markdown** format using the **architecture page title** from config.

1. **Einleitung (Introduction)**
   - Purpose of the Salesforce implementation for the customer
   - High-level description of the functional domains from config

2. **Architekturübersicht (Architecture Overview)**
   - Component statistics table (number of Apex classes, LWC, Flows, etc.)
   - Naming conventions and prefixes (from config)
   - API version and platform details
   - Trigger Action Framework explanation

3. **Funktionale Domänen (Functional Domains)**
   - One subsection per domain from config
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
   - Branch strategy diagram (text-based, from config)
   - Pipeline stages and environments
   - Delta deployment approach
   - Release versioning

9. **Codequalität (Code Quality)**
   - PMD rules and thresholds
   - ESLint configuration
   - Testing approach and conventions

### Step 7: Publish to Confluence
1. **Always save locally:** Save the generated Markdown to `<project-dir>/architecture/<YYYY-MM-DD>-architecture-overview.md`. Create the `architecture/` directory if it does not exist.
2. **Check Atlassian connection:** If `Cloud ID` or `Confluence URL` in `customer.config.md` is empty or set to `—`, skip Confluence publishing. Inform the user that the overview was saved locally only because no Atlassian connection is configured.
3. If Atlassian is configured, use `searchConfluenceUsingCql` to check if a page with the **architecture page title** from config already exists
3. If it exists, update the page using `updateConfluencePage`
4. If it does not exist, create a new page using `createConfluencePage`
   - If `$ARGUMENTS` is provided, use it as the space key
   - Otherwise, ask the user which Confluence space to use
5. ALWAYS add the page as a subpage of the **Confluence parent page** from config
6. Present the Confluence page URL to the user

### Step 8: Summary
Present:
- Link to the created/updated Confluence page
- Total component count by type
- Key findings and architectural highlights
- Any recommendations or observations

## Important Rules
- Follow all conventions from CLAUDE.md
- Output text in the Confluence page uses the **documentation language** from config
- Use the Atlassian MCP tools for all Confluence operations
- Read **Cloud ID** from `customer.config.md` — do not hardcode
- ALWAYS create a log file named `<YYYY-MM-DD>-architecture-overview.txt` in `.claude/skills/05-architecture-overview/logs/` — copy the complete output as text into this file
- Be thorough but concise — group similar components rather than listing every single file
- When reading classes, focus on understanding purpose rather than implementation details
- If the repository is very large, prioritize reading service classes, batch jobs, and controllers over test classes and simple DTOs

## Error Handling
- If the repository structure cannot be read, inform the user and abort
- If no Atlassian connection is configured (Cloud ID or Confluence URL is empty/`—`), save the overview as a local Markdown file and inform the user. Do not attempt any Confluence API calls.
- If Confluence page creation or update fails, save the generated Markdown content locally in the logs folder and inform the user
- If specific metadata directories are missing (e.g., no `flows/` folder), note the absence and continue with available metadata types
- If the analysis is taking too long or generating too much output, summarize remaining sections at a higher level
