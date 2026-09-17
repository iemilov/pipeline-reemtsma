---
name: create-testdata
description: Create test data records in a Salesforce org based on customer-specific test data configuration
argument-hint: "[org-alias] [story-key | preset]"
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`


## Platform Guard

This skill requires `Platform: salesforce` in `customer.config.md`. If the active customer uses a different platform, inform the user that this skill is Salesforce-specific and abort.

## Configuration

Before executing, read:
- `pipeline/customer.config.md` for customer-specific values (including `Platform`, `Project Key`)
- `pipeline/stack.config.md` for Salesforce-specific values (org aliases, API version)
- The active customer's `testdata.catalog.json` (auto-resolved by the planner, or at `pipeline/customers/<customer>/testdata.catalog.json`)
- The active customer's `testdata.config.md` for human-readable documentation (business rules, field definitions, testablauf)
- `pipeline/customers/<customer>/docs/b2b-business-rules.md` for entity graph rules (if it exists)

## When to Use / When NOT to Use

- **Use** for creating Salesforce test data — preset-based, story-based, or interactive
- **Use** when the user says "Testdaten anlegen", "Antrag erstellen", or uses a Natural Language Shortcut from `testdata.config.md`
- **Do NOT use** for test data analysis only → use `/story-testdata` instead (Skill 22)
- **Do NOT use** for cleanup → use `/cleanup-testdata` instead (Skill 15)

## Related Skills

| Need | Use instead | Why |
|------|------------|-----|
| Analyze story → recommend preset | `/story-testdata` | Analysis only, no DML |
| Delete test data | `/cleanup-testdata` | Uses run manifest from this skill |
| Initialize sandbox with test data | `/init-sandbox` | Orchestrates this skill + other setup steps |

## Workflow: Create Test Data in Salesforce Org

### Step 1: Parse Arguments & Validate Environment

Parse `$ARGUMENTS`:
- Argument matching a **preset name** from the catalog → preset mode
- Argument matching the customer's story-key pattern (from `Project Key` in `customer.config.md`, e.g., `CRM-\d+`) → story mode
- Remaining argument → org alias
- If no org alias → use the default development org from `stack.config.md`

**Resolve org alias:** If the parsed org-alias does not exactly match an alias from `stack.config.md > ## Org Aliases`, attempt a case-insensitive substring match against the alias column. If exactly one alias matches, use it and inform the user: `Org-Alias aufgelöst: <input> → <resolved-alias>`. If multiple match, ask the user to choose (via `AskUserQuestion`). If none match, show the available aliases and ask.

Verify org connectivity:
```bash
sf org display -o <org-alias>
```

### Step 1.5: Confirm Owner Role & User (before plan generation)

This step runs **before** `prepare` so that no plan or log is generated until the record owner is confirmed. It applies only when the catalog declares a `rootRecord.ownerResolution.lookup` object — skip this entire step if `lookup` is absent or `null`.

Read the catalog to extract the lookup config:
```bash
# Resolve catalog path
CUSTOMER_DIR=$(pipeline/bin/config --customer-dir)
CATALOG="${CUSTOMER_DIR}/testdata.catalog.json"
```

Parse from the catalog JSON:
- `rootRecord.ownerResolution.lookup.roleParameter` — name of the preset parameter that holds the role value (e.g., `targetRD`)
- `rootRecord.ownerResolution.lookup.roleField` — SOQL field to match against (e.g., `UserRole.Name`)
- `rootRecord.ownerResolution.lookup.profileName` — required Profile name
- `rootRecord.ownerResolution.lookup.permissionSet` — required Permission Set name
- `rootRecord.ownerResolution.targetOwnerParameter` — preset parameter to set with the selected username (e.g., `targetOwnerUsername`)

Also find the preset's definition of the `roleParameter` in its `parameters` array to get `default` and `allowed` values.

**1.5a — Confirm role value:**

Show the preset's default value for the role parameter and ask the user to confirm or change it (via `AskUserQuestion`). List the `allowed` values from the preset parameter definition as options.

**1.5b — Query available owners in the target org:**

Build the SOQL dynamically from the catalog's lookup config — write to a file (never inline):

```bash
cat > /tmp/query-owner.soql << SOQL
SELECT Id, Username, Name
FROM User
WHERE <roleField> = '<confirmed-role-value>'
  AND IsActive = true
  AND Profile.Name = '<profileName>'
  AND Id IN (SELECT AssigneeId FROM PermissionSetAssignment WHERE PermissionSet.Name = '<permissionSet>')
ORDER BY Name
SOQL
sf data query --file /tmp/query-owner.soql -o <org-alias>
```

**1.5c — User selects owner:**

- **0 results:** Inform the user that no matching user was found for this role value in the target org. Abort — do not proceed to `prepare`.
- **1 result:** Auto-select and show confirmation: `Owner: <Name> (<Username>)`. No question needed.
- **2+ results:** Ask the user to select one (via `AskUserQuestion`, list all with Name + Username).

**1.5d — Set confirmed parameters:**

Use the confirmed values as `--param <targetOwnerParameter>=<selected-username>` in the subsequent `prepare` call. If the user provided an explicit `--param` override for the owner parameter, the user's explicit value takes precedence (skip the lookup for that parameter).

> **Catalogs without `lookup`:** Skip this entire step — these catalogs do not use role-based owner resolution.

### Step 2: Prepare the Plan (DML-free, includes the mandatory preflight)

Use the deterministic create-runner's `prepare` command to generate an immutable, digest-carrying plan. This step never touches Salesforce with DML and never writes a run manifest — it is the DML-free half of the runner (A-01/A-08). `prepare` also ACTUALLY RUNS the full preflight for this preset itself — the customer capability check plus every declarative check the preset lists as relevant (A-01) — and returns the executed result as `preflightResult`. The skill never runs a SOQL check or a capability check itself, never re-evaluates an assertion, and never offers a way around a `BLOCKED`/`ERROR` result.

**If a preset was provided:**

Include the confirmed `--param <targetOwnerParameter>=<username>` from Step 1.5. Save the output directly to a file in one command:

```bash
pipeline/bin/testdata-runner prepare <preset-name> --org <org-alias> [--count N] [--param key=value ...] --project-root . 2>/dev/null > /tmp/testdata-plan-<preset>.json
```

When the user requests multiple instances (e.g., "zehn ÄSten mit Preset X", "5 Accounts", "count=10"), add `--count N` to the command. `--count` accepts 1–20; values above 20 are rejected before DML — split into separately planned and approved batches. Without `--count`, the existing single-instance flow applies unchanged.

> **Save the plan (CRITICAL):** The plan MUST be saved by redirecting the `prepare` command's stdout directly to a file in a single Bash command (`> /tmp/testdata-plan-<preset>.json`). Add `2>/dev/null` to suppress the stderr info line. NEVER save the plan via heredoc (`<< EOF`), the Write tool, `python -c`, `echo`, or any other method that re-serializes the JSON — even whitespace changes break the plan digest and cause `PLAN_DIGEST_MISMATCH` on execute. To read specific fields for display, use a separate `python3 -c` command that reads the saved file — never modify the file itself.

Parse the saved plan JSON for display:
- If `"error"` is present, display it and abort. A `"dmlBlocked": true` result means the catalog's `setupStatus` is `incomplete` — inform the user that the catalog is not fully configured for DML and abort. **Do not offer a continuation question.**
- If `"errorClass": "META_PRESET_NOT_EXECUTABLE"` is returned (e.g., for composite presets like `districts-alle`), display the list of sub-presets from `metaPreset.composedOf` and run `prepare` → approval → `execute` for each sub-preset sequentially. Do NOT merge them into a single execution.
- `preflightResult.status` is exactly one of `PASSED` / `PASSED_WITH_WARNINGS` / `BLOCKED` / `ERROR` — the runner's own, already-executed classification (A-01). `PASSED_WITH_WARNINGS` only ever contains non-blocking findings (the catalog itself decides what blocks a preset via `blocksPresets`); there is no separate, skill-level judgment call here.

**If a story key was provided:**

1. Check for implementation notes at the **Implementation Design** config path (`pipeline/bin/config "Implementation Design"`, with `<story-key>` substituted). If a `## Test Scenarios` section exists, extract preset names and use those.
2. Otherwise, load the Jira story (via the Atlassian adapter) and extract keywords from summary + description.
3. Use the catalog's `storyTagMapping` to derive tags, then match against record group tags.
4. Present recommendations to the user and ask which preset to use, then run `prepare` for it as above.

**If neither preset nor story key:**

```bash
pipeline/bin/testdata-planner list --presets
```

Present the preset list and ask the user to choose, then run `prepare` for the chosen preset.

### Step 3: Display Plan & Request Approval

Display the plan to the user, including `preflightResult.status` and its `details`. This is the **mandatory approval gate** — no DML before this, and `execute` (Step 4) may only be called from a new agent turn after explicit approval.

```
Ausführungsplan für <orgAlias>:

PRESET          <preset> (<fixtureType>)
OWNER           <role-value> — <Owner Name> (<Owner Username>)
ROOT-RECORD     <rootRecord.sObject> — Owner-Strategie: <rootRecord.ownerResolution>
EXECUTOR        <executor.type> → <executor.path>
PARAMETER       <key>=<value>, ...
PREFLIGHT       <preflightResult.status> (<preflightChecks-count> Checks) — <preflightResult.details Kurzfassung>
RECORDS         ~<totalEstimatedRecords> records in <steps-count> groups

SCHRITTE:
  #   GROUP-ID      LABEL                                      ~COUNT  OPERATION
  ──────────────────────────────────────────────────────────────────────────────
  1   <id>          <label>                                    ~N      <op>
  ...

SCHUTZOBJEKTE (werden nie gelöscht, nur bei Einzelläufen angezeigt):
  - <cleanup.protectedRecords[].sObject> / <identifier> — <reason>

CLEANUP-VERTRAG  <cleanup.executor.path> (deletionOrder: <cleanup.deletionOrder.length> Schritte)
MANUALE UI-SCHRITTE (nicht headless):
  - <manualSteps>

PLAN-DIGEST     <planDigest>
```

**Batch display format** (when `isBatch` is true in the plan):

```
Batch-Ausführungsplan für <orgAlias>:

BATCH           <count> Instanzen von <preset>
ZIEL-ORG        <orgAlias>
OWNER           <Owner Name> (<Owner Username>)
ZIEL-ÄSTEN      <count> (nur wenn Preset genau 1 fachliche Ziel-ASt pro Instanz deklariert; sonst: Preset-Instanzen)
DML-RECORDS     ~<estimatedRecordsPerInstance × count>
FEHLERSTRATEGIE stop
PREFLIGHT       <preflightResult.status>
CLEANUP         <count> getrennte, ID-gebundene Child-Manifeste
BATCH-DIGEST    <batchPlanDigest>
CHILD-DIGESTS   01 … <count (zero-padded)>
```

For `count=1`, always use the single-plan format above — never the batch format.

`preflightResult` was already fully executed by `prepare` (Step 2) — the skill does not run any check itself here:

- If `preflightResult.status` is `BLOCKED` or `ERROR`: inform the user that DML cannot proceed, **do not ask for approval, and do not offer any workaround**. Go straight to Step 4 and call `execute` anyway — it independently re-runs the exact same preflight immediately before any DML and, finding it still blocked, produces a fully logged, DML-free completion (schema-valid manifest + skill log) on its own, without ever calling the executor.
- If `preflightResult.status` is `PASSED` or `PASSED_WITH_WARNINGS`: **ask for explicit approval** (via `AskUserQuestion`):
  1. **Ausführen** — Plan wie angezeigt ausführen → go to Step 4, `execute`
  2. **Parameter ändern** — Laufzeitparameter anpassen (zurück zu Step 1.5 for RD/GL changes, or Step 2 for other `--param`)
  3. **Abbrechen** → go to Step 4, `decline` (never just silently drop the plan — the runner still needs to record and log the rejection)

**Do NOT proceed to Step 4's `execute` without this explicit approval**, and never invent your own status for a decline — always call `decline` and show its result.

### Step 4: Execute, or Decline (both are runner-owned, approval-gated completions)

Every path out of Step 3 ends by calling the runner — either `execute` (approved plan, or a preflight-blocked/error plan that must still be finalized) or `decline` (rejected approval). The skill never writes a manifest or a skill log itself and never computes its own final status; the runner does both, from one shared run-state (A-03/A-04).

**Approved, or preflight already `BLOCKED`/`ERROR`:**

```bash
pipeline/bin/testdata-runner execute --plan <plan-json-path> --org <orgAlias> --project-root . \
  --manifest-dir pipeline/customers/<customer>/logs
```

**Declined by the user:**

```bash
pipeline/bin/testdata-runner decline --plan <plan-json-path> --org <orgAlias> \
  --manifest-dir pipeline/customers/<customer>/logs --reason "Benutzer hat die Ausführung abgelehnt"
```

`<customer>` is the active customer, resolved the same way as elsewhere (the `customer.config.md` symlink target). This is the **Kundenlogpfad** — the run manifest for this execution is always written under `pipeline/customers/<customer>/logs/`, never into the shared pipeline repo.

`execute`, in order (A-01/A-03/A-04):
1. Re-verifies the plan's `planDigest` and the catalog's current `catalogDigest` — a plan modified after `prepare`, or a catalog that changed since, is rejected with `"status": "ERROR"` and **no manifest is written** for it.
2. Writes a schema-valid `EXECUTION_STARTED` manifest to `--manifest-dir` before doing anything else.
3. Re-checks the fail-closed gate (`dmlBlocked` / `setupStatus: incomplete` / not catalog-driven) — if blocked, advances the manifest to `PREFLIGHT_BLOCKED`, writes the skill log, and finalizes — no DML is executed.
4. Re-runs the exact same preflight from Step 2, immediately before any DML. `BLOCKED`/`ERROR` advances the manifest to `PREFLIGHT_BLOCKED` and finalizes exactly like step 3, still without any DML. Only `PASSED`/`PASSED_WITH_WARNINGS` advances the manifest to `PREFLIGHT_PASSED` (written to disk) and continues.
5. Only now: generates Apex from the catalog-driven DML plan (`catalogExecutor.generateApex`), writes it to a temporary file, and runs it via `sf apex run -f <temp> -o <orgAlias>`. No external `.apex` executor files are needed — the runner builds the Apex entirely from the plan. Advances the manifest to `EXECUTOR_COMPLETED`/`EXECUTOR_ERROR`.
6. Parses the executor's debug output (`CREATED|`, `UPDATED|`, `SKIPPED|`, `TOTAL|`, `URL|`, `NEGATIV|`, `WARNING|`, `HALT|`, `ASSERT|`) into structured operations and root records.
7. Evaluates catalog-driven conformance assertions (`expect` field checks + `postCheckModules` SOQL checks) from the parsed executor output, advancing the manifest with `conformanceResult`.
8. Writes the mandatory skill execution log itself via `pipeline/bin/log-skill`, validates it, and finalizes the manifest — `FINALIZED` with the exact log path in `executionLog`, or `LOGGING_ERROR` (status stays `null`) if the log could not be written or failed validation. `LOGGING_ERROR` is never reported as a successful run, even if DML itself succeeded.

`decline` writes the same `EXECUTION_STARTED` → `PREFLIGHT_BLOCKED` (status `BLOCKED`, `details.reason` = the `--reason` text) → skill-log → `FINALIZED`/`LOGGING_ERROR` sequence, without re-running the preflight and without ever touching the executor.

Parse the JSON output (the final run manifest plus `manifestPath`):
- `status` is exactly one of `PASSED` / `PASSED_WITH_WARNINGS` / `NOT_APPLICABLE` / `BLOCKED` / `FAILED` / `ERROR` (A-06), or `null` if `lifecycleState` is `LOGGING_ERROR` — **never** treat `BLOCKED`/`FAILED`/`ERROR`/`LOGGING_ERROR` as a successful run.
- `rootRecords` / `operations` — created/updated/skipped records with sObject and Id (preserved even on a `LOGGING_ERROR`)
- `fieldContract.conformanceResult` — `{status, passed, failed, checks}` or `null` if no conformance assertions ran
- `executionLog` — the exact skill-log file path once `FINALIZED`, or `null` while `LOGGING_ERROR`
- `manifestPath` — the run manifest's location under `pipeline/customers/<customer>/logs/`

The skill does **not** call `pipeline/bin/log-skill` itself for this run — `execute`/`decline` already did, and `executionLog` in the result points at the exact file.

### Step 5: Fix Flow (only if `conformanceResult.status` is `FIELD_CONTRACT_DRIFT`)

If the manifest's `fieldContract.conformanceResult.status` is `FIELD_CONTRACT_DRIFT` (one or more ASSERT|FAIL lines in the executor output):

1. Display the failing assertions with field paths, expected vs. actual values from `conformanceResult.checks`
2. Inform the user which catalog records or postCheckModules produced the drift
3. **Ask for explicit approval** before any remediation — do NOT auto-fix
4. If the drift is a catalog bug (wrong `expect` or `postCheckModule` query), fix the catalog and re-run
5. If the drift is an org-state issue, guide the user to the manual fix

### Step 6: Summary

**Single-run summary** (non-batch):

Present:
- Target org alias
- Preset name + fixtureType
- Parameters used
- Table of created/updated/skipped records (from `operations`)
- Total record count
- **Manuale UI-Schritte** from the plan (if any)
- **Conformance result** (`conformanceResult.status`, or "keine Conformance-Assertions für dieses Preset")
- Any errors or warnings
- **Cleanup reference:** "Cleanup via `/cleanup-testdata <org-alias>`" — the cleanup runner reads Root-IDs from this run's manifest
- **Manifest path:** `<manifestPath>` (under `pipeline/customers/<customer>/logs/`)
- **URLs** from parsed debug output

**Batch summary** (when the plan had `isBatch: true`):

Present:
- Target org alias, preset, count
- Batch status (`PASSED` / `PASSED_WITH_WARNINGS` / `BLOCKED` / `FAILED` / `ERROR`)
- Per-child table with instanceId, status, and child manifest path
- Counters: planned, passed, warned, blocked, failed, errors, notStarted
- If aborted: abort reason and which instances were not started
- **Cleanup reference:** "Batch-Cleanup via `/cleanup-testdata <org-alias>` — Batch-Manifest: `<batchManifestPath>`"
- **Batch-Manifest path**

## Important Rules

- Follow all conventions from CLAUDE.md
- **Business Rules:** Before generating ANY Apex for test data, read the customer's business rules documentation (path from config). The catalog and executor scripts encode these rules — the skill does not re-derive them.
- **Catalog-driven only:** All presets are catalog-driven — the runner generates Apex from the DML plan at runtime. There are no versioned `.apex` executor files. The skill must never bypass the runner to create records manually.
- **Explicit approval gates:** Two mandatory gates — (1) before `testdata-runner execute` (DML), (2) before fix-DML execution. No exceptions. `execute` may only run in a new agent turn after the user has approved the plan shown in Step 3.
- **Run manifest is mandatory:** Every `execute`/`decline` call writes a schema-valid run manifest into `pipeline/customers/<customer>/logs/` (the Kundenlogpfad). Without it, `/cleanup-testdata` cannot find the records.
- **Digests are the tamper/staleness guard:** Never hand-edit a saved plan JSON file before calling `execute`/`decline` — the runner recomputes and rejects a mismatched `planDigest`/`catalogDigest` with `status: ERROR`.
- **Dependency order:** The planner resolves dependencies inside `prepare`. The skill does not hardcode dependency rules.
- **Preflight is executed by the runner, not the skill:** `prepare` and `execute` each run the full capability + declarative-check preflight themselves (A-01). The skill only displays `preflightResult`; it never runs a SOQL check or a capability check itself, never re-evaluates an assertion, and never offers a "continue anyway" for `BLOCKED`/`ERROR` — those are never user-overridable.
- **Status vocabulary:** Use only the six A-06 statuses (`PASSED`, `PASSED_WITH_WARNINGS`, `NOT_APPLICABLE`, `BLOCKED`, `FAILED`, `ERROR`), or `null` for a `LOGGING_ERROR` run, when describing a run's outcome to the user. The skill maintains no second status-mapping table anywhere — `cli/lib/testdata/status.js` (inside the runner) is the only place that maps a status to a skill-log outcome or an exit code.
- Read org aliases from `stack.config.md` — do not hardcode
- **Not catalog-driven:** If `prepare` returns `catalogDriven: false` (record groups without `records` arrays), the runner's `execute` will block with `NOT_CATALOG_DRIVEN`. Inform the user that this preset's record groups need to be completed in the catalog. Never fall back to manual/interactive record creation outside the runner — that would create records without a manifest, which `/cleanup-testdata` could then never find.
- **Avoid `sf data import bulk`** — it has persistent line ending issues on macOS (see domain knowledge)
- **Duplicate check:** Before creating records, optionally query for existing records with the same name pattern in the target org and warn the user if matches are found. This prevents accidental duplicate test data sets.
- **Never call `pipeline/bin/log-skill` directly for this run** — `execute`/`decline` already write and validate the mandatory skill log themselves from the same run-state as the manifest.

## Error Handling

- If the org is not authenticated or unreachable, inform the user and abort
- If `prepare` returns an error (invalid preset, bad parameters, cycle, `CATALOG_INVALID`), display the error and abort
- If `prepare` returns `catalogDriven: false`, the preset's record groups are incomplete (missing `records` arrays in the catalog). This is a hard block — the runner will refuse to execute. Inform the user which record groups need completion.
- If `prepare` returns `"dmlBlocked": true` (catalog `setupStatus: incomplete`) or `preflightResult.status` is `BLOCKED`/`ERROR`, inform the user why DML cannot proceed — **never offer to continue anyway**. Go straight to Step 4 and call `execute`, which independently re-confirms the block and finalizes a DML-free run on its own.
- If `execute`/`decline` returns an `errorClass` of `PLAN_DIGEST_MISMATCH` / `CATALOG_DIGEST_MISMATCH`, inform the user the plan or catalog changed since `prepare` and require a fresh `prepare` → approval cycle — never retry `execute`/`decline` with the same plan file
- If `execute` returns `"status": "ERROR"` (empty/unrecognized executor output, technical CLI/auth/timeout failure), show the error details from the manifest
- If `execute`/`decline` returns `lifecycleState: "LOGGING_ERROR"` (`status` stays `null`), treat this as a technical failure requiring manual reconciliation — **never report it as success**, even if `rootRecords`/`operations` show DML already happened. Show `skillLogError` and the manifest path so the run can be investigated and re-logged manually.
- If `conformanceResult.status` is `FIELD_CONTRACT_DRIFT`, inform the user and follow the Fix Flow (Step 5) — do not attempt structural fixes without approval
- If record creation fails partially (`PASSED_WITH_WARNINGS`), list successful and failed records separately
