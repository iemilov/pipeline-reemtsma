---
name: cleanup-testdata
description: Delete test data from a Salesforce sandbox — primarily ID-bound via the run manifests written by /create-testdata, with a preview and explicit confirmation before any deletion; a suffix-based legacy fallback exists for records created before manifests and needs separate approval
argument-hint: "[org-alias] [run-id | today | all | --legacy] [--dry-run]"
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

> **Platform Guard:** This skill requires `Platform = salesforce` in `customer.config.md`. On any other platform, inform the user and abort.

## Configuration

Read before executing:

- `pipeline/customer.config.md` — `Platform`, `Short Name`
- `pipeline/stack.config.md` — `## Org Configuration > Sandboxes` (alias, purpose), API version
- `pipeline/customers/<customer>/testdata.config.md` — `## Dependency Order` (reverse = deletion order), `## Notes > Cleanup` (suffix convention), `## Notes > Email Safety` (test e-mail domain)
- `testdata/runs/*.json` — run manifests from `/create-testdata`

Resolve inputs from `$ARGUMENTS`:

| Input | Resolution |
|---|---|
| **Org alias** | first token matching an alias in `stack.config.md`; otherwise ask. **Abort if the purpose contains "Production".** |
| **Scope** | a run id (manifest file name without `.json`), `today` (manifests created today for this org), `all` (every manifest for this org), `--legacy` (suffix-based scan, see below); nothing → interactive selection of manifests |
| `--dry-run` | plan and preview only |

## When to Use / When NOT to Use

- Use after a test session to remove exactly the records a `/create-testdata` run created.
- Use `--legacy` only for records created before manifests existed, identified by the suffix convention.
- Do NOT use on production, ever.
- Do NOT use to delete business data or records that were merely *reused* by a run.

## Workflow

### Step 1: Verify the environment and scan manifests

1. `sf org display --target-org <alias> --json` — connected, not production (purpose and instance URL).
2. List `testdata/runs/*-<alias>-*.json`; for each: run id, preset, story, created timestamp, record counts per sObject, and whether it was already cleaned (`"cleaned": "<timestamp>"` present).
3. Filter by scope. If no manifests match and `--legacy` was not given, say so and offer the legacy mode.

### Step 2: Select manifests

Interactive: `AskUserQuestion` (multiSelect) with one option per uncleaned manifest (label: run id, description: preset, counts), plus "all listed". More than three manifests: offer "all", "today" and the two newest.

### Step 3: Build the deletion plan (no DML)

For every selected manifest:

1. Take `records` (never `reused`) and order the sObjects by the manifest's `deletionOrder` (children first).
2. **Verify existence:** `SELECT Id FROM <SObject> WHERE Id IN (...)` per sObject. Ids that no longer exist are dropped from the plan and listed as "already gone".
3. **Check for foreign records:** for parent sObjects, query children that are *not* in the manifest (e.g. `SELECT Id FROM CampaignMember WHERE CampaignId IN (...) AND Id NOT IN (...)`). If any exist, the parent cannot be deleted cleanly: list them and exclude the parent unless the user explicitly includes the children.
4. Write the plan to the scratchpad: one CSV per sObject with the Ids, in deletion order.

Present the plan: sObject, count to delete, already gone, blocked by foreign children. Then ask via `AskUserQuestion`: **delete**, **adjust** (free text: exclude sObjects or Ids), **abort**. With `--dry-run` stop here.

### Step 4: Execute

Per sObject in deletion order:

```bash
sf data delete bulk --sobject <SObject> --file <ids>.csv -o <alias> --wait 10 --json
```

For fewer than 50 records `sf data delete record -s <SObject> -i <Id> -o <alias>` per record is acceptable. Do not empty the Recycle Bin.

- Read the job result; count successes and failures per sObject; failed Ids with their error message are kept.
- Stop at the first sObject with failures before moving to its parents, unless the user chooses to continue.

### Step 5: Update the manifests

Add to each processed manifest: `"cleaned": "<ISO timestamp>"`, `"cleanedBy": "<username>"`, `"deleted": { "<SObject>": <n> }`, `"failed": { "<SObject>": ["<Id>: <error>"] }`. A manifest with failures is not marked `cleaned`.

### Step 6: Summary and log

Table — sObject, deleted, already gone, failed — per manifest, plus the org and the Recycle Bin note (records recoverable for 15 days).

Create `<YYYY-MM-DD>-<customer-short-name>-<alias>-cleanup-testdata.json` in `.claude/skills/12-cleanup-testdata/logs/` per the CLAUDE.md JSON schema; `artifacts` lists the updated manifests and the Id CSVs.

## Legacy mode (`--legacy`, records without a manifest)

Only for records created before run manifests existed. Two stages, both explicit.

**Stage 1 — scan (no DML):** using the suffix convention from `testdata.config.md > Notes > Cleanup` and the test e-mail domain from `Notes > Email Safety`, query candidates per sObject of the dependency order, e.g. `SELECT Id, Name, CreatedDate, CreatedBy.Name FROM Account WHERE PersonEmail LIKE '%.test@example.com'` and `... WHERE Name LIKE '%_TEST'`. Show the full candidate list (Id, name, created, creator) grouped by sObject. Candidates created by users other than the current one or older than the age the user names are shown separately.

**Stage 2 — delete:** requires **explicit, separate approval by the customer's Salesforce owner**, obtained by the user outside this session and confirmed in the `AskUserQuestion` ("The Salesforce owner has approved deleting these <n> records"). Without that confirmation, stop after Stage 1. Then proceed as in Steps 3–6 with a manifest written retroactively as `testdata/runs/<YYYY-MM-DD-HHMM>-<alias>-legacy.json` so the deletion is documented.

## Important Rules

- **Never on production.**
- **Manifest first.** The suffix scan is a fallback with a higher approval bar, never the default.
- **Preview before every deletion**, and every deletion is confirmed via `AskUserQuestion`.
- **Reused records are never deleted.**
- **Children before parents**; a parent with foreign children is excluded, not force-deleted.
- Never empty the Recycle Bin; never use `Database.emptyRecycleBin`.
- Read aliases, deletion order and conventions from config; never hardcode.

## Error Handling

- **Alias unknown or production:** abort with the allowed aliases.
- **No manifests for the org:** say so; offer legacy mode.
- **Manifest malformed:** skip it, report the file, continue with the others.
- **Bulk job partially fails:** keep the failed Ids in the manifest, do not mark it cleaned, status `partial`.
- **Foreign children found:** exclude the parent, list the children, let the user decide.
