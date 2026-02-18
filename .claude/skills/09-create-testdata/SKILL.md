---
name: create-testdata
description: Create test data records in a Salesforce org based on customer-specific test data configuration
argument-hint: [org-alias]
---

## Configuration

Before executing, read `pipeline/customer.config.md` for customer-specific values, `pipeline/stack.config.md` for Salesforce-specific values (naming prefixes, API version, org aliases, test data factory class), `pipeline/customer.domain.md` for domain-specific business logic, and `pipeline/customers/<customer>/testdata.config.md` for the test data definitions.

## Workflow: Create Test Data in Salesforce Org

Generate and insert test data into the Salesforce org specified by **$ARGUMENTS** (org alias). If no org alias is provided, use the default development org from `stack.config.md`.

### Step 1: Validate Environment

1. Determine the target org alias from `$ARGUMENTS` or fall back to the default dev org from config
2. Verify org connectivity:
   ```bash
   sf org display -o <org-alias>
   ```
3. If the org is not authenticated, inform the user and abort
4. Read `pipeline/customers/<customer>/testdata.config.md` to load the test data definitions
5. Present a summary of what will be created and ask the user for confirmation

### Step 2: Query Existing Metadata

Before creating records, query the org for required metadata:

1. **Record Type IDs** — For each sObject in the test data config, query record types:
   ```bash
   sf data query -q "SELECT Id, DeveloperName FROM RecordType WHERE SObjectType = '<object>' AND IsActive = true" -o <org-alias> --json
   ```
2. **Profile IDs** — If user creation is needed:
   ```bash
   sf data query -q "SELECT Id, Name FROM Profile WHERE Name IN ('<profiles>')" -o <org-alias> --json
   ```
3. **Queue IDs** — If queue assignment is needed:
   ```bash
   sf data query -q "SELECT Id, DeveloperName FROM Group WHERE Type = 'Queue' AND DeveloperName IN ('<queues>')" -o <org-alias> --json
   ```
4. Store all IDs in a lookup map for use in record creation

### Step 3: Create Records

Process the test data config **in dependency order** (parents before children). For each record group:

1. Build the JSON payload based on the field definitions in the config
2. Replace placeholder tokens:
   - `{{RecordTypeId:<DeveloperName>}}` → resolved Record Type ID
   - `{{Ref:<referenceId>}}` → ID from a previously created record
   - `{{Today}}` → today's date in YYYY-MM-DD format
   - `{{Year}}` → current year
   - `{{OrgAlias}}` → target org alias
3. Use the **Composite Tree API** for batch creation (max 200 records per request):
   ```bash
   sf api request rest -o <org-alias> --method POST --body '<json>' "services/data/v<apiVersion>/composite/tree/<sObject>"
   ```
4. If the Composite Tree API is not suitable (e.g., cross-object references), fall back to individual record creation:
   ```bash
   sf data create record -s <sObject> -v "<field1>=<value1> <field2>=<value2>" -o <org-alias> --json
   ```
5. Store created record IDs for use as parent references in subsequent steps
6. Add a 2-second pause between API batches to respect rate limits

### Step 4: Verify Created Records

1. For each sObject type, query the org to verify records were created:
   ```bash
   sf data query -q "SELECT Id, Name, RecordType.DeveloperName FROM <sObject> WHERE Id IN ('<ids>')" -o <org-alias> --json
   ```
2. Build a summary table of all created records

### Step 5: Summary

Present:
- Target org alias
- Table of created records (sObject, Name/Subject, Record Type, Id)
- Total record count
- Any errors or warnings encountered

## Important Rules

- Follow all conventions from CLAUDE.md
- Read test data definitions from `pipeline/customers/<customer>/testdata.config.md` — do not hardcode record types or field values
- Read org aliases from `stack.config.md` — do not hardcode
- **Dependency order:** Always create parent records before children (e.g., Account before Contact before Case)
- **Rate limiting:** Add 2-second pause between Composite Tree API batches
- **Prefer Composite Tree API** over individual record creation for performance
- **Avoid `sf data import bulk`** — it has persistent line ending issues on macOS (see domain knowledge)
- **Do not create duplicate test data** — before creating, optionally query for existing records with the same name pattern and warn the user
- ALWAYS create a log file named `<YYYY-MM-DD>-<org-alias>-create-testdata.txt` in `.claude/skills/09-create-testdata/logs/` — copy the complete output as text into this file

## Error Handling

- If the org is not authenticated or unreachable, inform the user and abort
- If a Record Type is not found in the org, list available record types and ask the user how to proceed
- If record creation fails, show the error details and continue with remaining records (do not abort entirely)
- If the Composite Tree API returns partial failures, list successful and failed records separately
- If a required parent record was not created (dependency failure), skip all dependent children and inform the user
