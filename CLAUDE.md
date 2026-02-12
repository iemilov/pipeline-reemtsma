# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Customer-specific values:** See `pipeline/customer.config.md` for all customer-specific configuration (Atlassian credentials, naming prefixes, org aliases, locale, CI/CD settings).

**Domain knowledge:** See `pipeline/customer.domain.md` for customer-specific business logic, glossary, and field name pitfalls.

## Repository Structure (CRITICAL)

**Main Project:** `Salesforce CICD` (parent repository)

- Customer has **READ ACCESS** to this repository
- Contains all Salesforce metadata, code, and deployment configuration

**Submodule:** `ai-project` (this repository)

- Customer has **NO ACCESS** to this submodule
- Contains CLAUDE.md, custom skills, and internal AI workflow documentation
- This separation ensures sensitive workflows, prompts, and automation details remain confidential

**Important:** Never commit sensitive information (API keys, internal processes, skill prompts) to the main `Salesforce CICD` repository - only to this submodule.

## Project Overview

Salesforce DX (SFDX) CI/CD repository for a multi-environment Salesforce org deployment. Uses Lightning Web Components (60+), Apex classes (240+), and various Salesforce metadata types with delta-based deployments via Azure Pipelines.

The **API Version** and **org aliases** are defined in `customer.config.md`.

## Key Commands

### Linting & Formatting
```bash
npm run lint                  # ESLint on Aura & LWC files
npm run prettier              # Format all supported files
npm run prettier:verify       # Check formatting without changes
```

### Testing (LWC Jest)
```bash
npm test                      # Run all Jest tests
npm run test:unit:watch       # Watch mode
npm run test:unit:coverage    # With coverage report
npm run test:unit:debug       # Debug with inspector
```

### Apex Deployment & Testing
```bash
sf project deploy start --source-dir force-app/main/default/classes/MyClass.cls force-app/main/default/classes/MyClass.cls-meta.xml -o <org>
sf apex run test --class-names MyTestClass --result-format human --synchronous --wait 10 -o <org>
```

### PMD (Apex Static Analysis)
```bash
pmd check -d force-app/main/default/classes/MyClass.cls -R apex-rules.xml -f text
```

### Delta Deployment Scripts
```bash
./scripts/delta-deploy.sh <output_dir> <username>   # Generate delta package from git
./scripts/delta-deploy-manual.sh                    # Interactive delta deployment
```

### Versioned Deployment
```bash
sf project deploy start -x deployment/<version>/package/package.xml -o <org>
```

## Architecture

### Naming Prefixes

Naming prefixes and their scope are defined in `customer.config.md` under **Naming Conventions** and **Functional Domains**.

### Trigger Action Framework
Uses the [Apex Trigger Actions Framework](https://github.com/mitchspano/apex-trigger-actions-framework) (metadata-driven):

1. **Triggers** delegate to `MetadataTriggerHandler` — no logic in triggers
2. **Trigger Action classes** implement interfaces like `TriggerAction.BeforeInsert`, `TriggerAction.AfterUpdate`
3. **Custom Metadata** (`Trigger_Action__mdt`) configures which classes fire, in what order, on which sObject events
4. **sObject Trigger Settings** (`sObject_Trigger_Setting__mdt`) enable/disable triggers per object

### Test Data Factory

The test data factory class name is defined in `customer.config.md`. Key methods (all insert internally):
- `createSalesAccount(String name, String recordTypeDevName)` - Creates and inserts a Store/Business account
- `createContacts(Integer count, String recordTypeName, Id accountId)` - Creates and inserts contacts
- `createCases(Integer count, String recordTypeName, Id accountId, Id contactId)` - Creates cases
- `createUsers(Integer count, String lastname, String profileName)` - Creates users

**Important:** These methods insert records internally. Do not call `insert` again on the returned records.

### Apex Test Pitfalls
- **MIXED_DML_OPERATION:** When test setup creates both setup objects (User, Profile) and non-setup objects (Account, Case), create Users first via direct DML, then wrap non-setup DML in `System.runAs(currentUser)`. Org flows on User (e.g. "Set Auto BCC") can trigger this unexpectedly.
- **Custom Metadata in tests:** CMT records from the org are visible in tests. Use `@TestVisible` fields to inject test configs and design assertions that account for real CMT data (e.g. before/after count patterns).

### Source Structure
- `force-app/main/default/` - All Salesforce metadata organized by type
  - `classes/` - Apex classes and tests (`*Test.cls` naming)
  - `lwc/` - Lightning Web Components
  - `aura/` - Legacy Aura components
  - `flows/`, `objects/`, `triggers/`, `pages/` - Standard metadata
- `deployment/<version>/` - Versioned release packages with `package.xml` and `destructiveChanges.xml`

## CI/CD Pipeline (Azure Pipelines)

Branch strategy and pipeline environments are defined in `customer.config.md` under **Repository & CI/CD**.

Pipeline uses `sfdx-git-delta` plugin for intelligent delta deployments. JWT authentication with service accounts stored in Azure Key Vault.

## Code Quality

### PMD Rules (apex-rules.xml)
- **Cyclomatic complexity:** max 10 per method (priority 2)
- **Method length:** max 60 NCSS lines (priority 3)
- **Class length:** max 1000 lines (priority 3)
- **Nesting depth:** max 4 levels (priority 2)
- **No SOQL/DML in loops** (priority 1)
- **Sharing model required** — `with sharing` / `without sharing` must be declared (priority 1)
- **CRUD/FLS checks required** — use `WITH SECURITY_ENFORCED` in SOQL (priority 2)

### Other Quality Tools
- **ESLint** - Salesforce-specific rules via `@salesforce/eslint-config-lwc`
- **Husky** - Pre-commit hooks run lint-staged on changed files

## Conventions

- Test classes: `*Test.cls` with `test*()` or `testShould*()` methods
- Apex class names must not exceed 40 characters (Salesforce limit)
- LWC components import Apex via `@salesforce/apex/ClassName.methodName`
- Components use `@api` decorators for public properties
- Deployment commits include the CI skip pattern from `customer.config.md`
- When test classes are executed, always return the code coverage from the test run in a table

## Custom Skills (Slash Commands)

### Transcript → User Story → Code workflow

1. Place meeting transcripts (`.docx`, `.xlsx`) into the transcript input folder (see `customer.config.md`)
2. `/create-story <epic-id>` — Reads all transcripts, synthesizes requirements, creates Jira user stories linked to the epic, and generates implementation notes
3. `/implement-us <story-key>` — Reads the Jira story, explores codebase patterns, and generates a first draft of implementation code (Apex, Flows, Validation Rules, LWC, Custom Metadata, etc.)
4. `/deploy-us <story-key> <org-alias>` — Deploys all story-related metadata to an org, runs PMD checks and Apex tests, and presents a deployment report
5. `/document-us <epic-id>` — Fetches the epic and all linked stories from Jira, generates a Confluence page with business and technical documentation
6. `/architecture-overview [space-key]` — Analyzes the full repository and publishes a comprehensive technical architecture overview to Confluence
7. `/release-notes [version]` — Generates release notes from the latest master merge commit by resolving all referenced Jira stories

## Additional Skill Remarks

- ALWAYS create a log file for each execution of a skill in this pattern: `<YYYY-MM-DD>-<identifier>-<skill-name>.txt` where `<identifier>` is the story key, epic key, or version depending on the skill. Copy the complete output as text into this file and store it under the `logs/` subfolder of each skill's directory (e.g., `.claude/skills/02-implement-us/logs/`)
- NEVER state in any metadata that it was co-authored by Claude Code
- All Atlassian integration details (Jira URL, Cloud ID, Confluence URL, project key, components) are in `customer.config.md`
