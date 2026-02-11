# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure (CRITICAL)

**Main Project:** `Salesforce CICD` (parent repository)

- Customer has **READ ACCESS** to this repository
- Contains all Salesforce metadata, code, and deployment configuration

**Submodule:** `ai-project` (this repository)

- Customer has **NO ACCESS** to this submodule
- Contains CLAUDE.md, custom skills, and internal AI workflow documentation
- This separation ensures sensitive workflows, prompts, and automation details remain confidential

⚠️ **Important:** Never commit sensitive information (API keys, internal processes, skill prompts) to the main `Salesforce CICD` repository - only to this submodule.

## Project Overview

Salesforce DX (SFDX) CI/CD repository for a multi-environment Salesforce org deployment. Uses Lightning Web Components (60+), Apex classes (240+), and various Salesforce metadata types with delta-based deployments via Azure Pipelines.

**API Version:** 64.0 (per `sfdx-project.json`; some components use 65.0)

## Glossary

Common abbreviations used throughout the codebase and documentation:
- **ASt** - Annahmestelle (Sales Point / Store)
- **ASten** - Annahmestellen (plural)
- **RD** - Regionaldirektion (Regional Management)
- **VO** - Vertriebsorganisation (Sales Organization)
- **VS** - Vertriebssteuerung (Sales Control)
- **TK** - Testkauf (Test Purchase / Mystery Shopping)
- **VDE** - Verband der Elektrotechnik (Electrical Safety Inspection)

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

## Org Aliases

- **LottoUAT2** (`system.user@lotto-bw.de.uat2`) - UAT2 testing sandbox
- Default org is typically the DEV sandbox

## Architecture

### Naming Prefixes
- **`STLG_`** - Core system (Service Desk, case management, person accounts)
- **`STLGS_`** - Sales/Store system (B2B retail, store management, test purchases, visit reports)

### Trigger Action Framework
Uses the [Apex Trigger Actions Framework](https://github.com/mitchspano/apex-trigger-actions-framework) (metadata-driven):

1. **Triggers** delegate to `MetadataTriggerHandler` — no logic in triggers
2. **Trigger Action classes** implement interfaces like `TriggerAction.BeforeInsert`, `TriggerAction.AfterUpdate`
3. **Custom Metadata** (`Trigger_Action__mdt`) configures which classes fire, in what order, on which sObject events
4. **sObject Trigger Settings** (`sObject_Trigger_Setting__mdt`) enable/disable triggers per object

Example: A class `STLGS_TA_SetFileVisibilityProServices` is registered via `Trigger_Action.STLGS_TA_SetFileVisibilityProServices.md-meta.xml` with `Before_Insert__c = ContentDocumentLink` and `Order__c = 30`.

### Test Data Factory
`STLG_TestDataFactory` provides reusable test data creation. Key methods (all insert internally):
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
  - `lwc/` - Lightning Web Components with `stlgs_*` prefix
  - `aura/` - Legacy Aura components with `stlg_*` prefix
  - `flows/`, `objects/`, `triggers/`, `pages/` - Standard metadata
- `deployment/<version>/` - Versioned release packages with `package.xml` and `destructiveChanges.xml`

## Domain-Specific Business Logic

### Testkauf (TK) - Test Purchase / Mystery Shopping

**Batch Processing:** `STLGS_UpdateTestPurchaseBatch`

- **Manual execution:** `Database.executeBatch(new STLGS_UpdateTestPurchaseBatch(), 200);`
- Processes TK cases with status "TK durchgeführt" from previous calendar week
- **Important:** Lotto billing week runs Saturday-Saturday (not standard Mon-Sun Salesforce week)
- Code uses `isDateInLastWeek()` logic: `Date.today().toStartOfWeek().addDays(-7)` to calculate the previous week

**Key Validation Rules:**

- `STLGS_PreventStatusChange2ndLevelSD`: Status "Zugewiesen an 2nd Level" requires `STLGS_ChecksToKBDone__c=true`

**Processing Logic:**

- TK result "nicht bestanden" → Status: "Testkaufergebnis nicht geprüft" (manual review required)
- TK result "bestanden" + no other open TKs → Full automation to "Abrechnung"
- TK result "bestanden" + other open TKs exist → Only to "nicht geprüft" (manual review)
- TK-Art "Nachschulung" → Always to "nicht geprüft" (CRM-2497)
- TK result "Fehlanfahrt" → To "nicht geprüft" (no Ampelstatus calculation)

### VDE Prüfung (Electrical Safety Inspection)

**Asset Creation:**

- Flow-based automated asset creation based on `Account.STLGS_SalesType__c`:
  - "Vollannahmestelle" → 12 standard assets
  - "Lotto Kompakt" → 7 standard assets

**Custom Asset Fields:**

- `Case__c` (Lookup to Case)
- `STLGS_Type__c` (e.g., "Terminal & Drucker", "Lottowand", "weitere Geräte")
- `STLGS_ErrorFound__c`, `STLGS_InspectionStickerApplied__c`, `STLGS_InspectionDate__c`

### Common Field Name Pitfalls

Frequently confused field names (use correct spelling to avoid deployment errors):

- ✅ `STLGS_RegionalDirectorate__c` (NOT RegionalDirection)
- ✅ `STLGS_SubjectSD__c` (NOT SubjectDescription)
- ✅ `STLG_TMFTicketId__c` (NOT T_MFTicketId)
- ✅ `STLGS_ProServicesCase__c` (means "Sichtbar für ProServices")
- ✅ `STLG_FollowupDate__c` (NOT FollowUpDate)

### Bulk Data Operations Best Practices

**Preferred Approach: Composite Tree API**

```bash
# Use Composite Tree API for bulk operations
POST /services/data/v65.0/composite/tree/Case
```

- Maximum 200 records per request
- Each record requires `referenceId` in `attributes`
- Add 2-second pause between batches for rate limiting

**Avoid:** `sf data import bulk` has persistent line ending issues on macOS - prefer Composite Tree API

### Important Record IDs (Production)

- **RecordType STLGS_ServiceDeskCase:** `012Tr000003l2pRIAQ`
- **Queue ProServices:** `00GTr000005KTsfMAG`

## CI/CD Pipeline (Azure Pipelines)

**Branch Strategy:**
- `feature/*` → INT (Integration sandbox)
- `release/*` → UAT2 (Testing)
- `master` → PROD (with manual approval)

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
- Deployment commits include `[skip ci]` to prevent pipeline loops
- When test classes are executed, always return the code coverage from the test run in a table

## Custom Skills (Slash Commands)

### Transcript → User Story → Code workflow

1. Place meeting transcripts (`.docx`, `.xlsx`) into `transcripts/<epic-id>/`
2. `/create-story <epic-id>` — Reads all transcripts, synthesizes requirements, creates Jira user stories linked to the epic, and generates implementation notes in `implementation-design/<story-key>/`
3. `/implement-us <story-key>` — Reads the Jira story, explores codebase patterns, and generates a first draft of implementation code (Apex, Flows, Validation Rules, LWC, Custom Metadata, etc.)
4. `/deploy-us <story-key> <org-alias>` — Deploys all story-related metadata to an org, runs PMD checks and Apex tests, and presents a deployment report
5. `/document-us <epic-id>` — Fetches the epic and all linked stories from Jira, generates a Confluence page with business and technical documentation in German
6. `/architecture-overview [space-key]` — Analyzes the full repository and publishes a comprehensive technical architecture overview to Confluence
7. `/release-notes [version]` — Generates release notes from the latest master merge commit by resolving all referenced Jira stories

## Additional Skill Remarks

- ALWAYS create a log file for each execution of a skill in this pattern: `<YYYY-MM-DD>-<identifier>-<skill-name>.txt` where `<identifier>` is the story key, epic key, or version depending on the skill. Copy the complete output as text into this file and store it under the `logs/` subfolder of each skill's directory (e.g., `.claude/skills/02-implement-us/logs/`)

### Atlassian Integration
- **Jira URL:** `https://kommit.atlassian.net` (NOT lottobw.atlassian.net)
- **Jira cloudId:** `2a9f60f6-99f9-4ab6-aedd-ea0fc09fe2d4`
- **Confluence URL:** `https://kommit.atlassian.net/wiki`
- Stories are created in the **CRM** project with component **B2C** or **B2B** based on context
- Epic linking uses `Parent` field on user story

