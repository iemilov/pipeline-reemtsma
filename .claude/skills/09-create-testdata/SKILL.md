---
name: create-testdata
description: Create test data records in a Salesforce org based on customer-specific test data configuration
argument-hint: "[org-alias] [story-key | preset]"
---

## Configuration

Before executing, read `pipeline/customer.config.md` for customer-specific values, `pipeline/stack.config.md` for Salesforce-specific values (naming prefixes, API version, org aliases, test data factory class), `pipeline/customer.domain.md` for domain-specific business logic, and `pipeline/customers/<customer>/testdata.config.md` for the test data definitions.

## Workflow: Create Test Data in Salesforce Org

Generate and insert test data into the Salesforce org specified by **$ARGUMENTS** (org alias, optional story key or preset). Parse arguments as follows:
- First argument that matches `CRM-\d+` pattern → story key
- Argument that matches a preset name from `testdata.config.md > ## Presets` section → preset (auto-selects sections, skips interactive selection)
- Remaining argument → org alias
- If no org alias is provided, use the default development org from `stack.config.md`

### Step 1: Validate Environment

1. Determine the target org alias and story key from `$ARGUMENTS`
2. Verify org connectivity:
   ```bash
   sf org display -o <org-alias>
   ```
3. If the org is not authenticated, inform the user and abort
4. Read `pipeline/customers/<customer>/testdata.config.md` to load the test data definitions including all section metadata (tags, depends_on, record counts)

### Step 2: Analyze Story, Preset & Build Section Recommendations

**If a preset name was provided:**

1. Read the `## Presets` section from `testdata.config.md`
2. Find the matching preset by name (case-insensitive)
3. Parse the sub-record IDs from the preset's metadata line (e.g., "Records: 0a, 0b-i, 0b-ii, 2c, 3b, 4a, 5a"). If the preset uses "alle aus Sek. X, Y" format, expand to all sub-records within those sections.
4. Mark these records as `[PRESET]` — skip interactive selection in Step 3. Only create the listed sub-records, not entire sections.

**If a story key was provided:**

1. **Check for Design Notes** — look for `implementation-design/<story-key>/implementation-notes.md`
   - If it exists AND contains a `## Test Scenarios` section:
     - Parse the Test Scenarios table for preset names and config section references
     - Parse the "Testdaten-Anforderungen" sub-table for custom records
     - Use these as **primary recommendations** (more precise than keyword-derived tags)
     - Display: `Design Notes gefunden → Testszenarien-basierte Empfehlung`
     - Skip the keyword-based tag derivation below (steps 2-4)
   - If it does not exist or has no Test Scenarios section → fall through to keyword-based analysis

2. Load the Jira story (summary, description, component, labels, epic key) using the Atlassian MCP tool
3. Read relevant topic docs from `pipeline/customers/lotto-bw/docs/` based on keywords in the story summary and description
4. Identify the domain area and map to section tags using the following rules:

   | Keywords in story | Recommended tags |
   |---|---|
   | Antrag, Neueröffnung, Übernahme, Verlegung | `antrag`, `b2b`, `nationality` |
   | Service Desk, Ticketsystem, Ticket, SD | `b2b`, `service-desk` |
   | Testkauf, Ampel, Compliance, Mystery | `testkauf`, `compliance` |
   | Pflichtschulung, Schulung, LMS, Training | `pflichtschulung` |
   | VDE, Prüfung, Inspektion, Asset | `vde`, `asset` |
   | Kündigung, Deaktivierung, Schließung | `verwaltung`, `b2b` |
   | Besuch, Visit, Regelbesuch | `besuch`, `b2b` |
   | B2C, Endkunde, Interessent, Erwin | `b2c` |
   | Rücklastschrift, SEPA, Bankdaten | `verwaltung`, `b2b` |
   | Nationalität, Staatsangehörigkeit, EU, Ausländer | `nationality`, `b2b` |
   | Component = B2C | `b2c` |
   | Component = B2B | `b2b` |

5. Select all sections whose tags overlap with the identified tags — these are the **recommended sections**
6. Section `0` (prerequisites) is always included and marked `[IMMER]`

**If no story key was provided:**

- Skip this step — no sections are pre-recommended

### Step 2b: Apex Fast-Path (Presets only)

**If a preset was matched in Step 2**, check for a pre-built Anonymous Apex script:

1. Look for `scripts/apex/testdata/<preset-name>.apex` (e.g., `scripts/apex/testdata/uebernahme-np.apex`)
2. **If the file exists:**
   - Display: `Preset **<name>** → Apex Fast-Path (~5-10s)`
   - Execute:
     ```bash
     sf apex run -f scripts/apex/testdata/<preset-name>.apex -o <org-alias>
     ```
   - Parse debug output lines matching these patterns:
     - `CREATED|<sObject>|<Id>|<Name>|<RecordType>` → created record
     - `UPDATED|<sObject>|<Id>|<detail>` → updated record
     - `SKIPPED|<sObject>|<Id>|<reason>` → skipped (e.g., company account exists)
     - `TOTAL|<N> operations` → total count
     - `URL|<path>` → direct link to the main record (Request)
   - Build summary table from parsed lines
   - Write log file as usual
   - **Skip Steps 3–7 entirely** — all lookups, DML, cross-references, and ACR updates happen natively in Apex
   - Proceed directly to Step 8 (Summary)
3. **If no `.apex` file exists** → continue with Step 3 (standard flow)

### Step 3: Section Selection

**If a preset was matched (sections already determined):**

Display the preset summary (informational, no user question):

> Preset **\<name\>**: \<description\>
> Records: \<sub-record-list\> (~\<count\>)

Then skip directly to Step 4 (dependency resolution) — no interactive selection needed.

**If section recommendations came from Design Notes:**

Display the test scenarios table (informational) before the section selection:

> **Testszenarien aus Design Notes** (`implementation-design/<story-key>/implementation-notes.md`):
>
> | # | Szenario | Typ | Testdaten |
> |---|----------|-----|-----------|
> | T1 | ... | Happy Path | Preset: uebernahme-np |
> | T2 | ... | Negativ | Custom: Store ohne AZ |

Then proceed with the interactive selection below, using the Design Notes-derived sections as `[EMPFOHLEN]` instead of keyword-based recommendations.

**Otherwise — Interactive Selection:**

Present a selection table to the user with ALL available sections from the config:

```
Testdaten-Sektionen für <org-alias><story-context>:

STATUS       SEKTION   BESCHREIBUNG                                          RECORDS
──────────────────────────────────────────────────────────────────────────────────────
[IMMER]      0a        Company Account (skip if exists)                       1
[IMMER]      0b        RD-User Lookups (keine Erstellung)                     —
[EMPFOHLEN]  1         B2C Person Accounts (Prospect + Kunde)                 2
[EMPFOHLEN]  2         B2B Accounts & Stores (VollASt + Lotto Kompakt)        4
[EMPFOHLEN]  3         Sales Contacts inkl. Nationalitäts-Szenarien           7
[EMPFOHLEN]  4         AccountContactRelation Updates                         7
[EMPFOHLEN]  5         Anträge (Neueröffnung, Übernahme, Verlegung)           8
[ ]          6         B2C Cases (Allgemein, Gewinnauskunft, Erwin)           3
[ ]          7a        Service Desk allgemeine Anfrage                        1
[ ]          7b–7c     VDE Prüfung (inkl. Asset-Flow)                         2
[ ]          7d        Testkauf                                                1
[ ]          7e–7f     Pflichtschulung (Präsenz + Online)                      2
[ ]          7g–7p     Verwaltung (Kündigung, Datenänd., Rücklastschr., ...)   10
[ ]          8         Besuchsbericht (Regelbesuch)                            1
[ ]          9         Manuelle Test-Assets                                    2
```

Ask the user (via `AskUserQuestion`) with three options:
1. **Empfehlung übernehmen** — Nur die `[EMPFOHLEN]` + `[IMMER]` Sektionen erstellen
2. **Auswahl anpassen** — User gibt an, welche Sektionen hinzugefügt oder entfernt werden sollen (Freitext oder Follow-up-Frage)
3. **Alle erstellen** — Vollständiger Datensatz wie bisher

### Step 4: Resolve Dependencies

For the confirmed section selection, automatically add any missing `depends_on` sections:
- Section 2 requires: `0`
- Section 3 requires: `0`, `2`
- Section 4 requires: `0`, `2`, `3`
- Section 5 requires: `0`, `2`, `3`, `4`
- Section 6 requires: `1`
- Sections 7a–7p, 8, 9 require: `0`, `2`

If dependencies were added automatically, inform the user:
> "Abhängigkeit hinzugefügt: Sektion 3 benötigt Sektion 2 — wurde automatisch ergänzt."

Then present the **final confirmed list** before proceeding.

### Step 5: Query Existing Metadata

Before creating records, query the org for required metadata:

1. **Record Type IDs** — For each sObject in the selected sections:
   ```bash
   sf data query -q "SELECT Id, DeveloperName FROM RecordType WHERE SObjectType = '<object>' AND IsActive = true" -o <org-alias> --json
   ```
2. **Queue IDs** — If queue assignment is needed:
   ```bash
   sf data query -q "SELECT Id, DeveloperName FROM Group WHERE Type = 'Queue' AND DeveloperName IN ('<queues>')" -o <org-alias> --json
   ```
3. Store all IDs in a lookup map for token replacement
4. **Lookup existing records** — For each record group with `operation: lookup` in the selected sections:
   ```bash
   sf data query -q "<lookupQuery>" -o <org-alias> --json
   ```
   - If the query returns a result, store the Id under the specified `referenceId`
   - If the query returns no results, log a **warning** and fall back to the running user

### Step 6: Create Records

Process the selected sections **in dependency order** (parents before children). For each record group:

1. Build the JSON payload based on the field definitions in the config
2. Replace placeholder tokens:
   - `{{RecordTypeId:<DeveloperName>}}` → resolved Record Type ID
   - `{{Ref:<referenceId>}}` → ID from a previously created record
   - `{{Today}}` → today's date in YYYY-MM-DD format
   - `{{Today+Nd}}` → today's date plus N days (e.g., `{{Today+42d}}`)
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

### Step 7: Verify Created Records

1. For each sObject type in the selected sections, query the org to verify records were created:
   ```bash
   sf data query -q "SELECT Id, Name, RecordType.DeveloperName FROM <sObject> WHERE Id IN ('<ids>')" -o <org-alias> --json
   ```
2. Build a summary table of all created records

### Step 8: Summary

Present:
- Target org alias
- Story key (if provided) + derived recommendation basis
- Design Notes used: Yes/No + file path (if story key was provided and Design Notes with Test Scenarios were found)
- Selected sections
- Table of created records (sObject, Name/Subject, Record Type, Id)
- Total record count
- Test scenario coverage (if Design Notes were used): which T-scenarios from the Design Notes are covered by the created records, and which require additional manual setup
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
- **Always resolve dependencies** before starting creation — never create a child section without its parents
- ALWAYS create a log file named `<YYYY-MM-DD>-<customer-short-name>-<org-alias>-create-testdata.json` in `.claude/skills/09-create-testdata/logs/` — use the structured JSON format from CLAUDE.md

## Error Handling

- If the org is not authenticated or unreachable, inform the user and abort
- If a Record Type is not found in the org, list available record types and ask the user how to proceed
- If record creation fails, show the error details and continue with remaining records (do not abort entirely)
- If the Composite Tree API returns partial failures, list successful and failed records separately
- If a required parent record was not created (dependency failure), skip all dependent children and inform the user
