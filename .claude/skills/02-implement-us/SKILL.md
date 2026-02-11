---
name: implement-us
description: Generate a first draft of implementation for an existing Jira user story using the appropriate Salesforce tools
argument-hint: [story-key]
---

## Workflow: User Story → Implementation Draft

Generate an implementation for Jira story **$ARGUMENTS**:

### Step 1: Read User Story
1. Fetch the story details from Jira using `getJiraIssue` with key `$ARGUMENTS`
2. Extract all requirements, acceptance criteria, and technical details from the description
3. Check if `implementation-design/$ARGUMENTS/implementation-notes.md` exists — if so, read it and use it as additional context for implementation decisions (proposed approach, affected objects, acceptance criteria mapping, and technical hints)

### Step 2: Explore Codebase Patterns
Before implementing, explore the existing codebase to understand:
1. Naming conventions (STLG_ vs STLGS_ prefix)
2. Existing similar implementations for the same type of solution
3. Relevant existing fields, objects, and metadata on affected sObjects
4. Test patterns (STLG_TestDataFactory usage) if Apex is involved

### Step 3: Choose Implementation Approach
Analyze the requirements and determine which Salesforce tools are most appropriate. Use declarative tools where possible, code where necessary:

#### Declarative (no-code / low-code)
- **Flows** (Record-Triggered, Screen, Scheduled, Autolaunched) — for automation, screen wizards, scheduled processes
- **Validation Rules** — for field-level data integrity and business rule enforcement
- **Formula Fields** — for computed/derived values
- **Roll-Up Summary Fields** — for aggregate calculations on master-detail
- **Approval Processes** — for multi-step approval workflows
- **Assignment Rules / Escalation Rules** — for case or lead routing
- **Sharing Rules** — for record access control
- **Permission Sets / Permission Set Groups** — for feature access
- **Page Layouts / Record Types** — for UI and process variations
- **Custom Metadata Types / Custom Settings** — for configuration data
- **Reports & Dashboards** — for analytics requirements
- **Email Templates / Email Alerts** — for notification requirements

#### Programmatic (code)
- **Apex Trigger Actions** — for complex before/after DML logic (use Trigger Action Framework)
- **Batch Apex + Schedulable** — for large data volume processing on a schedule
- **Apex REST/SOAP Services** — for custom API endpoints
- **Invocable Apex** — for reusable logic callable from Flows
- **Lightning Web Components** — for custom UI
- **Aura Components** — only if extending existing Aura components

### Step 4: Generate feature branch
- Run APEX Test Classes when APEX code is involved
- Run PMD Check when APEX code is involved
- Create based on the latest release branch (release/...) a feature branch (feature/<story-key>)
- Do a checkout of this feature branch

### Step 5: Generate Implementation
Based on the chosen approach, create the appropriate metadata files:

#### For Flows
- Create `.flow-meta.xml` files in `force-app/main/default/flows/`
- Follow naming: `STLG_<DescriptiveName>` or `STLGS_<DescriptiveName>`
- Use subflows for reusable logic
- Add fault paths for error handling

#### For Validation Rules
- Create files in `force-app/main/default/objects/<Object>/validationRules/`
- Include clear `errorMessage` in German where appropriate
- Use `errorDisplayField` to show errors on the relevant field

#### For Formula Fields
- Create `.field-meta.xml` in `force-app/main/default/objects/<Object>/fields/`

#### For Custom Fields
- Create `.field-meta.xml` with proper type, label, description
- Add to relevant Page Layouts, Permission Sets, and FLS as needed

#### For Sharing Rules
- Create in `force-app/main/default/sharingRules/`

#### For Permission Sets
- Create or update in `force-app/main/default/permissionsets/`

#### For Apex Classes
- Follow project conventions:
  - `with sharing` / `without sharing` as appropriate
  - `WITH SECURITY_ENFORCED` on SOQL queries
  - No SOQL/DML in loops
  - Max cyclomatic complexity of 10 per method
  - Class names max 40 characters
- Create a **Scheduled wrapper** if the class is a Batch
- Create a **Test class** with:
  - Use `STLG_TestDataFactory` where possible
  - Wrap User DML before Account/Case DML or use `System.runAs()` to avoid MIXED_DML_OPERATION errors
  - Multiple test methods covering happy path, edge cases, and error scenarios
  - Target 80%+ code coverage

#### For Lightning Web Components
- Create in `force-app/main/default/lwc/`
- Follow naming: `stlg_<componentName>` or `stlgs_<componentName>`
- Include `.js`, `.html`, `.css` (if needed), `.js-meta.xml`
- Import Apex via `@salesforce/apex/ClassName.methodName`

#### For all metadata
- Create all `-meta.xml` files with apiVersion `64.0` (per `sfdx-project.json`)

### Step 6: Create a pull request
- Create a pull request from the feature branch into the release branch you created the feature branch from

### Step 7: Summary
Present a summary of:
- Implementation approach chosen and rationale (why declarative vs code)
- All files created (grouped by type)
- How to deploy the solution
- Any manual configuration steps needed post-deployment (e.g. activating Flows, scheduling jobs)
- Any open questions or assumptions made

## Important Rules
- Follow all conventions from CLAUDE.md
- Prefer declarative solutions over code when both can meet the requirement
- Use the Atlassian MCP tools for all Jira operations
- The cloudId for Jira is `2a9f60f6-99f9-4ab6-aedd-ea0fc09fe2d4`
- Add always the epic id in the header with @see, so the code can be tracked back and linked to a user story in Jira
- ALWAYS create a log file named `<YYYY-MM-DD>-$ARGUMENTS-implement-us.txt` in `.claude/skills/02-implement-us/logs/` — copy the complete output as text into this file

## Error Handling
- If the Jira issue cannot be fetched, inform the user with the error details and abort
- If branch creation fails (e.g., branch already exists), ask the user whether to reuse the existing branch or choose a different name
- If PMD check finds Priority 1 violations, fix them before committing
- If PR creation fails (e.g., Azure DevOps CLI not available), ensure the branch is pushed and provide the manual PR creation URL
