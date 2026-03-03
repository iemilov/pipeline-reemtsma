---
name: cleanup-testdata
description: Delete test data records from a Salesforce org interactively by preset, suffix range, or date
argument-hint: "[org-alias] [preset | all | today]"
---

## Configuration

Before executing, read `pipeline/customer.config.md` for customer-specific values, `pipeline/stack.config.md` for Salesforce-specific values (org aliases), and `pipeline/customers/<customer>/testdata.config.md` for the **Suffix-Allocation pro Preset** table that maps StoreNumber suffixes to preset names.

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
4. Read the **Suffix-Allocation pro Preset** table from `pipeline/customers/<customer>/testdata.config.md` to load the suffix-to-preset mapping

### Step 2: Scan for Test Records

Query the org for all Accounts whose `STLGS_StoreNumber__c` ends with a known test data suffix. Build the WHERE clause from all suffixes listed in the Suffix-Allocation table:

```bash
sf data query -q "<query>" -o <org-alias> --json
```

Query:
```sql
SELECT Id, Name, STLGS_StoreNumber__c, CreatedDate,
  (SELECT Id, Name FROM STLGS_Requests__r)
FROM Account
WHERE (STLGS_StoreNumber__c LIKE '%99901'
  OR STLGS_StoreNumber__c LIKE '%99902'
  OR STLGS_StoreNumber__c LIKE '%99903'
  OR STLGS_StoreNumber__c LIKE '%99904'
  OR STLGS_StoreNumber__c LIKE '%99905'
  OR STLGS_StoreNumber__c LIKE '%99906'
  OR STLGS_StoreNumber__c LIKE '%99911'
  OR STLGS_StoreNumber__c LIKE '%99912'
  OR STLGS_StoreNumber__c LIKE '%99913'
  OR STLGS_StoreNumber__c LIKE '%99914'
  OR STLGS_StoreNumber__c LIKE '%99920'
  OR STLGS_StoreNumber__c LIKE '%99921'
  OR STLGS_StoreNumber__c LIKE '%99922'
  OR STLGS_StoreNumber__c LIKE '%99923'
  OR STLGS_StoreNumber__c LIKE '%99924'
  OR STLGS_StoreNumber__c LIKE '%99925'
  OR STLGS_StoreNumber__c LIKE '%99930'
  OR STLGS_StoreNumber__c LIKE '%99931'
  OR STLGS_StoreNumber__c LIKE '%99932')
ORDER BY STLGS_StoreNumber__c
```

If no records found → inform the user ("Keine Testdaten in <org-alias> gefunden.") and stop.

Group results by suffix range using the Suffix-Allocation table. For each group, count the number of Stores and Requests, and collect the distinct `CreatedDate` values.

### Step 3: Interactive Selection

**If `all` was passed as argument:** Skip selection, use all found records.

**If `today` was passed as argument:** Filter to records with `CreatedDate = TODAY` only.

**If a preset name was passed:** Filter to the suffix(es) associated with that preset from the Allocation table.

**Otherwise — Interactive Selection:**

Display a summary table:

```
Testdaten in <org-alias>:

BEREICH          SUFFIX      STORES  REQUESTS  ERSTELLT
──────────────────────────────────────────────────────────
Standard         99901       2       2         2026-03-03
Übernahme        99902       1       1         2026-03-03
Nachreichen      99903–04    2       3         2026-03-01
Flow-Tests       99905–06    3       4         2026-02-28
Nationalität     99911–14    4       4         2026-02-28
Aktenzeichen     99920–25    6       12        2026-03-03
Negativ-ÜN       99930–31    2       2         2026-03-03
Negativ-VL       99932       1       1         2026-03-03
──────────────────────────────────────────────────────────
Gesamt                       21      29
```

Only show rows where records actually exist. Ask the user via `AskUserQuestion`:

1. **Alles löschen** — Alle aufgelisteten Testdaten entfernen
2. **Nur von heute** — Nur Records mit `CreatedDate = TODAY`
3. **Bestimmte Bereiche** — User gibt an welche Bereiche (Follow-up-Frage mit Bereichsnamen)
4. **Abbrechen**

If "Bestimmte Bereiche" selected, ask a follow-up question listing the available group names for multi-select.

### Step 4: Generate & Execute Cleanup Apex

Based on the selected Store IDs (from Step 3), generate an Anonymous Apex script. The script must:

1. Query the selected Accounts by their concrete `STLGS_StoreNumber__c` values (not LIKE patterns)
2. Delete child records in strict dependency order (children before parents)
3. Clear cross-reference fields before deleting Accounts
4. Output structured debug lines for parsing

**Deletion order (mandatory, children first):**

| # | Object | Query |
|---|--------|-------|
| 1 | `STLGS_RequestContactRelation__c` | `WHERE STLGS_Request__c IN (SELECT Id FROM STLGS_Request__c WHERE STLGS_Store__c IN :storeIds)` |
| 2 | `STLGS_Request__c` | `WHERE STLGS_Store__c IN :storeIds` |
| 3 | `Case` | `WHERE AccountId IN :storeIds` |
| 4 | `Asset` | `WHERE AccountId IN :storeIds` |
| 5 | `STLGS_VisitReport__c` | `WHERE STLGS_Account__c IN :storeIds` |
| 6 | Cross-refs nullen | `PredecessorStore__c`, `SuccessorStore__c`, `LeadingRequest__c` auf null setzen + update |
| 7 | `Contact` | `WHERE AccountId IN :storeIds` |
| 8 | `Account` | Die Stores selbst |

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

Present the cleanup results:

```
Cleanup abgeschlossen in <org-alias>:

OBJEKT                              GELÖSCHT
───────────────────────────────────────────
STLGS_RequestContactRelation__c     12
STLGS_Request__c                    8
Case                                0
Asset                               0
STLGS_VisitReport__c                0
Contact                             6
Account (Stores)                    5
───────────────────────────────────────────
Gesamt                              31

Gelöschte Stores:
  199901  Test ASt VollASt 2026-03-03
  199930  Test Vorgänger-ASt ohne AZ 2026-03-03
  199931  Test ASt ÜN-NoAZ 2026-03-03
```

Write a log file to `.claude/skills/12-cleanup-testdata/logs/`.

## Important Rules

- Follow all conventions from CLAUDE.md
- **NEVER delete the Company Account** (`Staatliche Toto-Lotto GmbH Baden-Württemberg`) — the suffix-based selection excludes it automatically, but always verify before executing
- **Cross-references first:** Always null out `STLGS_PredecessorStore__c`, `STLGS_SuccessorStore__c`, and `STLGS_LeadingRequest__c` on Store Accounts BEFORE deleting any records — otherwise delete will fail due to lookup constraints
- **Deletion order is mandatory:** RequestContactRelation → Request → Case → Asset → VisitReport → (clear cross-refs) → Contact → Account
- Read suffix-to-preset mapping from `testdata.config.md` — do not hardcode
- Read org aliases from `stack.config.md` — do not hardcode
- ALWAYS create a log file named `<YYYY-MM-DD>-<customer-short-name>-<org-alias>-cleanup-testdata.txt` in `.claude/skills/12-cleanup-testdata/logs/`

## Error Handling

- If the org is not authenticated or unreachable, inform the user and abort
- If no test records are found, inform the user and stop — do not generate an empty cleanup script
- If the Apex execution fails partially, show the error details and list which records were successfully deleted
- If the user cancels the selection, abort gracefully with no changes
