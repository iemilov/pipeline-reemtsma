# Stack Configuration: Salesforce DX

## Salesforce Project

| Key | Value |
|-----|-------|
| API Version | `<version>` |
| PMD Rules File | `apex-rules.xml` |
| Source Path | `force-app/main/default/` |
| Project Config | `sfdx-project.json` |

## Naming Conventions

| Key | Value |
|-----|-------|
| Primary Apex/Flow Prefix | `<PREFIX_>` |
| Secondary Apex/Flow Prefix | `<PREFIX2_>` (if applicable) |
| Primary LWC Prefix | `<prefix_>` |
| Secondary LWC Prefix | `<prefix2_>` (if applicable) |
| Test Data Factory | `<PREFIX_TestDataFactory>` |
| Apex Class Name Max Length | 40 characters |

## Org Aliases

| Alias | Username | Purpose |
|-------|----------|---------|
| `<DEV Alias>` | `<username>` | DEV sandbox (default development org) |
| `<UAT Alias>` | `<username>` | UAT testing sandbox |
| `<PROD Alias>` | — | Production (validation target) |

## Functional Domains

### Domain 1 — <Label>

- **Prefix:** `<PREFIX_>`
- **Scope:** <description>
- **Component (Jira):** `<component>`
- **Release Notes Section Header:** `<header>`

### Domain 2 — <Label> (if applicable)

- **Prefix:** `<PREFIX2_>`
- **Scope:** <description>
- **Component (Jira):** `<component>`
- **Release Notes Section Header:** `<header>`

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

### Trigger Action Framework
Uses the [Apex Trigger Actions Framework](https://github.com/mitchspano/apex-trigger-actions-framework) (metadata-driven):

1. **Triggers** delegate to `MetadataTriggerHandler` — no logic in triggers
2. **Trigger Action classes** implement interfaces like `TriggerAction.BeforeInsert`, `TriggerAction.AfterUpdate`
3. **Custom Metadata** (`Trigger_Action__mdt`) configures which classes fire, in what order, on which sObject events
4. **sObject Trigger Settings** (`sObject_Trigger_Setting__mdt`) enable/disable triggers per object

### Test Data Factory

The test data factory class name is defined above under **Naming Conventions**. Key methods (all insert internally):
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
- When test classes are executed, always return the code coverage from the test run in a table
