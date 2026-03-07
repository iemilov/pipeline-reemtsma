---
name: cleanup-testdata
description: Delete test data records from a Salesforce org interactively by preset, suffix range, or date
argument-hint: "[org-alias] [preset | all | today]"
---

## Platform Guard

This skill requires `Platform: salesforce` in `customer.config.md`. If the active customer uses a different platform, inform the user that this skill is Salesforce-specific and abort.

## Configuration

Before executing, read:
- `pipeline/customer.config.md` for customer-specific values (including `Platform`)
- `pipeline/stack.config.md` for org aliases
- `pipeline/customers/<customer>/testdata.config.md` for:
  - **Suffix-Allocation pro Preset** table (suffix-to-preset mapping)
  - **Cleanup Configuration** section (store number field, request relationship, protected account, cross-reference fields, deletion order)

## Workflow: Delete Test Data from Salesforce Org

Identify and delete test data records in the Salesforce org specified by **$ARGUMENTS**. Parse arguments as follows:
- First argument matching a known preset name from the Suffix-Allocation table → preset filter
- `all` → delete all test data (no interactive selection)
- `today` → delete only records created today
- Remaining argument → org alias
- If no org alias is provided, use the default development org from `stack.config.md`

### Step 1: Validate Environment

1. Determine the target org alias from `$ARGUMENTS`
2. Verify org connectivity:
   ```bash
   sf org display -o <org-alias>
   ```
3. If the org is not authenticated, inform the user and abort
4. Read the **Suffix-Allocation pro Preset** table from `testdata.config.md` to load the suffix-to-preset mapping
5. Read the **Cleanup Configuration** section from `testdata.config.md` to load:
   - `<store-number-field>` — the field API name used to identify test stores (e.g., `STLGS_StoreNumber__c`)
   - `<request-relationship>` — the child relationship name for requests (e.g., `STLGS_Requests__r`)
   - `<protected-account>` — the company account name that must never be deleted
   - Cross-reference fields to nullify before deletion
   - Deletion order table with sObject names and query patterns

### Step 2: Scan for Test Records

Query the org for all Accounts whose `<store-number-field>` ends with a known test data suffix. Build the WHERE clause from all suffixes listed in the Suffix-Allocation table:

```bash
sf data query -q "<query>" -o <org-alias> --json
```

Query (build dynamically from config values):
```sql
SELECT Id, Name, <store-number-field>, CreatedDate,
  (SELECT Id, Name FROM <request-relationship>)
FROM Account
WHERE (<store-number-field> LIKE '%<suffix1>'
  OR <store-number-field> LIKE '%<suffix2>'
  ...)
ORDER BY <store-number-field>
```

If no records found → inform the user ("Keine Testdaten in <org-alias> gefunden.") and stop.

Group results by suffix range using the Suffix-Allocation table. For each group, count the number of Stores and Requests, and collect the distinct `CreatedDate` values.

### Step 3: Interactive Selection

**If `all` was passed as argument:** Skip selection, use all found records.

**If `today` was passed as argument:** Filter to records with `CreatedDate = TODAY` only.

**If a preset name was passed:** Filter to the suffix(es) associated with that preset from the Allocation table.

**Otherwise — Interactive Selection:**

Display a summary table (build from actual data, group names from Suffix-Allocation table):

```
Testdaten in <org-alias>:

BEREICH          SUFFIX      STORES  REQUESTS  ERSTELLT
──────────────────────────────────────────────────────────
<group-name>     <suffix>    N       N         YYYY-MM-DD
...
──────────────────────────────────────────────────────────
Gesamt                       N       N
```

Only show rows where records actually exist. Ask the user via `AskUserQuestion`:

1. **Alles löschen** — Alle aufgelisteten Testdaten entfernen
2. **Nur von heute** — Nur Records mit `CreatedDate = TODAY`
3. **Bestimmte Bereiche** — User gibt an welche Bereiche (Follow-up-Frage mit Bereichsnamen)
4. **Abbrechen**

If "Bestimmte Bereiche" selected, ask a follow-up question listing the available group names for multi-select.

### Step 4: Generate & Execute Cleanup Apex

Based on the selected Store IDs (from Step 3), generate an Anonymous Apex script. The script must:

1. Query the selected Accounts by their concrete `<store-number-field>` values (not LIKE patterns)
2. Delete child records in strict dependency order as defined in the **Deletion Order** table from `testdata.config.md` (children before parents)
3. Clear cross-reference fields (from config) before deleting Accounts
4. Output structured debug lines for parsing

**Debug output pattern** (one line per object type):
- `DELETED|<sObject>|<count>` — deleted N records of this type
- `TOTAL|Cleaned <N> stores` — summary line
- `STORE|<StoreNumber>|<Name>` — one line per deleted Store

Write the generated script to `/tmp/cleanup-testdata-<timestamp>.apex` and execute:
```bash
sf apex run -f /tmp/cleanup-testdata-<timestamp>.apex -o <org-alias>
```

Parse the debug output lines matching `DELETED|`, `TOTAL|`, and `STORE|` patterns.

### Step 5: Summary

Present the cleanup results (object names from the Deletion Order table in config):

```
Cleanup abgeschlossen in <org-alias>:

OBJEKT                              GELÖSCHT
───────────────────────────────────────────
<sObject-from-config>               N
...
Account (Stores)                    N
───────────────────────────────────────────
Gesamt                              N

Gelöschte Stores:
  <StoreNumber>  <Name>  <CreatedDate>
```

Write a log file to `.claude/skills/12-cleanup-testdata/logs/`.

## Important Rules

- Follow all conventions from CLAUDE.md
- **NEVER delete the protected account** (name from Cleanup Configuration in `testdata.config.md`) — the suffix-based selection excludes it automatically, but always verify before executing
- **Cross-references first:** Always null out the cross-reference fields (from config) on Store Accounts BEFORE deleting any records — otherwise delete will fail due to lookup constraints
- **Deletion order is mandatory:** Follow the exact order from the Deletion Order table in `testdata.config.md`
- Read suffix-to-preset mapping from `testdata.config.md` — do not hardcode
- Read org aliases from `stack.config.md` — do not hardcode
- Read all field names, object names, and relationship names from `testdata.config.md` — do not hardcode
- ALWAYS create a log file named `<YYYY-MM-DD>-<customer-short-name>-<org-alias>-cleanup-testdata.json` in `.claude/skills/12-cleanup-testdata/logs/`

## Error Handling

- If the org is not authenticated or unreachable, inform the user and abort
- If no test records are found, inform the user and stop — do not generate an empty cleanup script
- If the Apex execution fails partially, show the error details and list which records were successfully deleted
- If the user cancels the selection, abort gracefully with no changes
