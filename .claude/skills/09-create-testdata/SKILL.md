---
name: create-testdata
description: Create test data records in a Salesforce sandbox from the customer's testdata.config.md presets and record groups — resolves IDs, creates in dependency order via the Composite Tree API, checks for duplicates first, verifies afterwards, and writes an ID-bound run manifest so the records can be removed again exactly
argument-hint: "[org-alias] [story-key | preset-name] [--dry-run]"
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

> **Platform Guard:** This skill requires `Platform = salesforce` in `customer.config.md`. On any other platform, inform the user and abort.

## Configuration

Read before executing:

- `pipeline/customer.config.md` — `Platform`, `Short Name`, Documentation Language
- `pipeline/stack.config.md` — `## Org Configuration > Sandboxes` (alias, purpose), API version, source path
- `pipeline/customers/<customer>/testdata.config.md` — the single source of test data: `## Record Groups` (numbered sections with field tables, one column per record), `## Presets` (preset → record groups → default org), `## Dependency Order`, `## Notes` (token replacement, email safety, suffix convention)
- `pipeline/customer.domain.md` — business rules that constrain valid test records (status codes, consent fields, brand names)

Resolve inputs from `$ARGUMENTS`:

| Input | Resolution |
|---|---|
| **Org alias** | first token that matches an alias in `stack.config.md`; otherwise the preset's default org from `testdata.config.md`; otherwise the first alias whose purpose contains "User Acceptance". **Abort if the alias's purpose contains "Production".** |
| **Preset or story key** | a preset name from `## Presets`; a story key (project key pattern from config) delegates the analysis to `/story-testdata` and returns with its chosen preset; nothing → interactive selection |
| `--dry-run` | resolve, plan and show everything, create nothing |

## When to Use / When NOT to Use

- Use to load a known preset into a sandbox before manual or automated testing, or to create the records a story's test scenarios need.
- Do NOT use on production, ever.
- Do NOT use to reason about *which* data a story needs — that is `/story-testdata`.
- Do NOT use to remove data — that is `/cleanup-testdata`.

## Workflow

### Step 1: Parse arguments and validate the environment

1. Resolve org alias and preset as above.
2. Verify the org: `sf org display --target-org <alias> --json` — must be connected; the `instanceUrl` must not be the production instance and the alias's purpose must not be "Production". Abort otherwise.
3. Print one line: org, purpose, preset (or "interactive"), dry-run flag.

### Step 2: Select the preset and record groups

- **Preset given:** read its row in `## Presets`; expand the record group references, including partial selections such as "7 (Records 1, 3)" into the exact record columns.
- **Interactive:** list the presets with their descriptions via `AskUserQuestion` (max four options; group the rest under "other" with free text), then confirm the resolved record groups.
- Order the groups per `## Dependency Order` (parents first). A child group whose parent group is not in the selection pulls the referenced parent records in and says so.

### Step 3: Build the plan (no DML)

For every selected record, in dependency order:

1. Copy the field table from `testdata.config.md`.
2. **Resolve tokens:**
   - `{{RecordTypeId:<Object>.<DeveloperName>}}` → `SELECT Id FROM RecordType WHERE SObjectType = '<Object>' AND DeveloperName = '<DeveloperName>'`
   - `{{QueueId:<DeveloperName>}}` / `{{ProfileId:<Name>}}` / `{{UserId:<Username>}}` → the corresponding SOQL
   - `{{Today}}`, `{{Today-<n>}}`, `{{Year}}`, `{{Now}}` → dates from the current date; `{{OrgAlias}}` → the alias
   - `{{Ref:<referenceId>}}` → stays a Composite Tree reference within the same request, or the Id from an earlier request of this run
3. **Apply the suffix convention** from `## Notes > Cleanup` (e.g. `_TEST`) to the name-like field of every record if the config prescribes it, and keep e-mail addresses on the safe test domain from `## Notes > Email Safety`.
4. **Duplicate check:** query the org for records matching the record's natural key (person accounts: `PersonEmail`; campaigns and brands: `Name`; children: parent reference plus a distinguishing field). Mark existing matches; the default is to **reuse** an existing match for references and skip creating it, unless the user chooses to create anyway.
5. Assemble Composite Tree request bodies per sObject and dependency level, at most 200 records per request, written to the scratchpad as JSON files.

Present the plan as a table — sObject, reference id, key values, action (create / reuse existing / skip) — and, unless `--dry-run`, ask via `AskUserQuestion`: **create**, **adjust** (free text), **abort**.

### Step 4: Execute

For each request file, in order:

```bash
sf api request rest "/services/data/v<API>/composite/tree/<SObject>" -o <alias> --method POST --body @<file>.json > <file>.result.json
```

For a single record without children, `sf data create record -s <SObject> -v "<field=value ...>" -o <alias> --json` is acceptable.

- Read every result: map `referenceId` → `id`; substitute `{{Ref:...}}` in the next level's request files.
- Pause two seconds between requests.
- If a request fails: report the error verbatim, do not send dependent requests, keep the manifest of what was created so far.

### Step 5: Write the run manifest

`testdata/runs/<YYYY-MM-DD-HHMM>-<alias>-<preset>.json` (create the folder if missing):

```json
{
  "run": "<YYYY-MM-DD-HHMM>-<alias>-<preset>",
  "org": "<alias>",
  "preset": "<preset>",
  "story": "<story-key or null>",
  "created": "<ISO timestamp>",
  "createdBy": "<sf org display username>",
  "records": {
    "Brand__c": ["a0X...", "a0X..."],
    "Campaign": ["701..."],
    "Account": ["001..."]
  },
  "reused": { "Brand__c": ["a0X..."] },
  "deletionOrder": ["EngagementTracking__c", "LoyaltyMemberTier__c", "CampaignMember", "Account", "Campaign", "Brand__c"]
}
```

`deletionOrder` is the reverse of `## Dependency Order`. `reused` records are never deleted by cleanup. The manifest is the only thing `/cleanup-testdata` needs; it is not committed to the main repository unless the user wants it (add `testdata/runs/` to `.gitignore` on first use and say so).

### Step 6: Verify

Query every created Id per sObject (`SELECT Id, Name FROM <SObject> WHERE Id IN (...)`) and compare counts with the manifest. Missing records are reported as such.

### Step 7: Summary and log

Present a table — sObject, name or key, record type, Id, action — with totals, the manifest path, and the org.

Create `<YYYY-MM-DD>-<customer-short-name>-<alias>-<preset>-create-testdata.json` in `.claude/skills/09-create-testdata/logs/` per the CLAUDE.md JSON schema; `artifacts` lists the manifest and the request files.

## Important Rules

- **Never on production.** The purpose check on the alias is mandatory; a production instance URL aborts even when the alias is misnamed.
- **Duplicate check before every create**; reuse is the default.
- **Every created Id lands in the manifest**, also after a partial failure.
- Tokens are resolved by query, never by hardcoded Ids.
- Keep test e-mail addresses on the safe domain; never use real consumer data.
- Prefer the Composite Tree API; avoid `sf data import bulk` on macOS (line ending issues).
- Read aliases, API version and presets from config; never hardcode.

## Error Handling

- **Alias unknown or production:** abort with the list of allowed aliases.
- **Preset unknown:** list the presets from `testdata.config.md` and ask.
- **Token cannot be resolved** (record type or queue missing in the org): stop before any DML, name the token and the query.
- **Parent request fails:** skip its children, report, write the manifest for what exists.
- **Verification count mismatch:** report the missing Ids; status `partial`.
