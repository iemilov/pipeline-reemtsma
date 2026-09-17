---
name: cleanup-testdata
description: Delete test data records from a Salesforce org using ID-bound run manifests via the deterministic cleanup runner
argument-hint: "[org-alias]"
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`


## Platform Guard

This skill requires `Platform: salesforce` in `customer.config.md`. If the active customer uses a different platform, inform the user that this skill is Salesforce-specific and abort.

## Configuration

Before executing, read:
- `pipeline/customer.config.md` for customer-specific values (including `Platform`)
- `pipeline/stack.config.md` for org aliases
- The active customer's `testdata.catalog.json` (auto-resolved by the cleanup runner, or at `pipeline/customers/<customer>/testdata.catalog.json`) — specifically the `cleanup` section: `executor`, `protectedRecords`, `crossReferenceFields`, `selfReferenceFields`, `deletionOrder`, `legacyCleanupFallback`
- Run manifests under `pipeline/customers/<customer>/logs/` — these are the **primary** and, for a standard cleanup, the **only** source of records to delete (A-02). Only manifests with `lifecycleState: "FINALIZED"` are cleanup-eligible (A-03) — an incomplete or still-`LOGGING_ERROR` run can never anchor a cleanup, even if it already has root records recorded.

## When to Use / When NOT to Use

- **Use** for deleting test data from a Salesforce org whose creation was recorded in a FINALIZED run manifest by `/create-testdata`
- **Use** when the user says "Testdaten aufräumen", "Testdaten löschen", or similar
- **Use** the explicit two-step legacy mode (`legacy-plan` → `legacy-execute`) only for pre-manifest runs that predate the run-manifest system
- **Do NOT use** for creating test data → use `/create-testdata` instead (Skill 14)
- **Do NOT use** for analyzing required test data → use `/story-testdata` instead (Skill 22)

## Related Skills

| Need | Use instead | Why |
|------|------------|-----|
| Create test data | `/create-testdata` | Creates records + writes the run manifest this skill reads |
| Analyze story for test data | `/story-testdata` | Read-only analysis, no DML |

## Workflow: Delete Test Data from Salesforce Org

Parse `$ARGUMENTS`:
- An argument → org alias
- If no org alias → use the default development org from `stack.config.md`

The cleanup runner (`pipeline/bin/testdata-cleaner`) is a deterministic Node.js pipeline (A-02/A-03/A-05/A-08), analogous to `/create-testdata`'s `testdata-runner`: a DML-free `plan` step and a separate, approval-gated `execute` step. **Root records for a standard cleanup come EXCLUSIVELY from a FINALIZED run manifest's `rootRecords` (A-02/A-03) — never from a name/number/pattern search.** The catalog's cleanup executor is the only thing that ever resolves and deletes the dependent-record graph beneath those IDs, receiving nothing but a single schema-validated payload (root IDs, allowlisted `created` operations, org, and digests); this skill and the runner never contain or guess that graph themselves, and there is no manual SOQL/DML alternative for any part of this workflow — every path always goes through the runner.

### Step 1: Verify Environment & Scan for Cleanable Manifests

1. Verify org connectivity: `sf org display -o <org-alias>`
2. Scan `pipeline/customers/<customer>/logs/` for run manifests (`*.run-manifest.json`, written by `/create-testdata`'s `testdata-runner execute`) whose `orgAlias` matches the target org, whose `lifecycleState` is `FINALIZED`, and whose `cleanupStatus` is `pending` or `cleanup_failed`. A manifest whose `lifecycleState` is anything other than `FINALIZED` (still `PREFLIGHT_BLOCKED`, `EXECUTOR_ERROR`, or stuck at `LOGGING_ERROR`) is **not cleanup-eligible** — do not list it, and do not attempt to clean it even if it happens to already carry root records. Manifests with `cleanupStatus: cleaned` or `not_applicable` are already handled — do not list them unless the user explicitly asks to re-check.
3. Group and display the found manifests by date and preset:

```
Bereinigbare Testdaten-Läufe in <org-alias> (Quelle: pipeline/customers/<customer>/logs/):

DATUM         PRESET              CLEANUP-STATUS   ROOT-RECORDS   MANIFEST
──────────────────────────────────────────────────────────────────────────────
YYYY-MM-DD    <preset>            pending          N              <manifest-file>
YYYY-MM-DD    <preset>            cleanup_failed   N              <manifest-file>
──────────────────────────────────────────────────────────────────────────────
```

If no cleanable manifests are found → inform the user and stop. Do not fall back to a name/number/pattern search on the standard path — offer the explicit Legacy-Recovery mode below only if the user confirms this is a pre-manifest run.

### Step 2: User Selects Manifests

**Approval gate** — ask via `AskUserQuestion` which listed run(s) to clean (single run, multiple runs, or all listed). **Do NOT proceed without an explicit selection.**

### Step 3: Prepare the Cleanup Plan (DML-free)

For each selected manifest, run:

```bash
pipeline/bin/testdata-cleaner plan --manifest <manifest-path> --org <org-alias> --project-root .
```

This step never touches Salesforce. It:
1. Schema-validates the run manifest and the catalog, and requires `lifecycleState: "FINALIZED"` — anything else is rejected as `ERROR`/`MANIFEST_NOT_FINALIZED` before any other check runs
2. Verifies the manifest's `orgAlias` matches the target org — a mismatch is rejected as `ERROR` ("Fremde Org")
3. Verifies the catalog's current digest matches the manifest's recorded `catalogDigest` — a changed catalog is rejected as `ERROR`
4. Checks the manifest's `rootRecords` against the catalog's `cleanup.protectedRecords` — any overlap is rejected as `BLOCKED`
5. Emits an immutable cleanup plan carrying a SHA-256 `cleanupPlanDigest` and a `manifestDigest` (a content digest of the exact manifest this plan was built from, used to detect tampering before `execute`)

Parse the JSON output:
- `"status": "NOT_APPLICABLE"` — nothing to clean (already cleaned, or the manifest never had root records). Inform the user and move to the next selected manifest.
- `"status": "BLOCKED"` — a protected-record overlap. Display `overlaps` (the exact records and their `reason`) and abort this manifest's cleanup. **Never override a protected-record block.**
- `"status": "ERROR"` — display `error`/`errorClass` (e.g. `MANIFEST_NOT_FINALIZED`, `ORG_MISMATCH`, `CATALOG_DIGEST_MISMATCH`, `NO_CLEANUP_EXECUTOR_CONFIGURED`) and abort this manifest's cleanup.
- **Signature (M-9)** — the cleaner HMAC-verifies the manifest before it can anchor a deletion (the runner signs every FINALIZED manifest with an operator-side key). Three `ERROR` classes come from this gate:
  - `MANIFEST_SIGNATURE_INVALID` — the manifest was altered or was not produced by this operator's runner. **This is a tamper/forgery signal — abort, never override.** A planted manifest that named foreign records for deletion lands here.
  - `MANIFEST_SIGNATURE_UNVERIFIABLE` — the manifest is signed but no signing key is available. Not a tamper signal: the operator must provide the key (`HARNESS_TESTDATA_MANIFEST_KEY` / `HARNESS_TESTDATA_MANIFEST_KEY_FILE`, or `~/.config/harness/manifest-signing.key`) and re-run. Do not work around it.
  - `MANIFEST_UNSIGNED` — a pre-signing (legacy) manifest with no signature. Only for a manifest the operator produced before signing existed and explicitly trusts, re-run `plan`/`execute` with `--allow-unsigned-manifest` — and only after the user confirms in this session (it is an explicit waiver of the forgery gate). Never add the flag automatically.
- `"status": "PASSED"` — a plan is ready. Save it to a temporary file for Step 4 (e.g. `/tmp/testdata-cleanup-plan-<runId>.json`) — do not re-serialize or reformat it, `execute` re-verifies its digests.

### Step 4: Display Plan & Request Approval

Display each ready plan. This is the **mandatory approval gate** — no DML before this, and `execute` (Step 5) may only be called from a new agent turn after explicit approval.

```
Cleanup-Plan für <orgAlias>:

MANIFEST        <manifestPath>
ROOT-RECORDS    <rootRecords[].sObject> / <rootRecords[].id> (<rootRecords[].identifierValue>)
CLEANUP-EXECUTOR <cleanupExecutor.type> → <cleanupExecutor.path>
LÖSCHREIHENFOLGE
  #   SOBJECT       QUERY-PATTERN
  ──────────────────────────────────────────────
  1   <sObject>     <queryPattern>
  ...

SCHUTZOBJEKTE (geprüft, keine Überschneidung):
  - <protectedRecords[].sObject> / <identifier> — <reason>

CLEANUP-PLAN-DIGEST  <cleanupPlanDigest>
MANIFEST-DIGEST       <manifestDigest>
```

**Ask for explicit approval** (via `AskUserQuestion`):
1. **Ausführen** — Plan wie angezeigt ausführen
2. **Überspringen** — dieses Manifest nicht bereinigen
3. **Abbrechen** — gesamten Cleanup-Lauf abbrechen

**Do NOT proceed without approval.**

### Step 5: Execute (approval-gated DML)

Only after explicit approval, run the cleanup runner's `execute` command against the **exact, unmodified** plan file saved in Step 3:

```bash
pipeline/bin/testdata-cleaner execute --plan <plan-json-path> --manifest <manifest-path> --org <org-alias> --project-root .
```

The runner, in order (A-02/A-03/A-05/A-08):
1. Re-verifies the plan's `cleanupPlanDigest`, the manifest's current content digest (`manifestDigest`), and the catalog's current digest — a plan modified after `plan`, a manifest that changed on disk since (e.g. a tampered root ID or operation), or a catalog that changed since, is rejected with `"status": "ERROR"` and the cleanup executor is **never invoked**.
2. Re-checks `lifecycleState: "FINALIZED"` and the manifest's `cleanupStatus` — a manifest already `cleaned` short-circuits to `"status": "NOT_APPLICABLE"` with no DML (idempotent).
3. Builds the **one** schema-validated payload the executor ever receives: the manifest's root IDs, the subset of its `operations` marked `created` (never `updated`/`skipped`), the org alias, and both digests — no freely-suppliable ID or search pattern is ever part of it. Copies the catalog-configured cleanup executor to a temporary file, injects this payload as its only parameter, and runs it as an argument-list subprocess — the versioned executor script is never modified.
4. Parses the executor's debug output (`WARNING|`, `HALT|`, `ASSERT|`, ...) — a `HALT|` line stops the run at `"status": "BLOCKED"` before any success is assumed. A customer's own cleanup assertions (A-07) are evaluated by the executor itself and surface as exactly this signal.
5. **Re-queries the org for every root ID's continued existence.** `cleanupStatus` is set to `cleaned` in the manifest **only if** the executor reported no halt/technical failure **and** the re-query confirms zero surviving root records. Any surviving record yields `"status": "FAILED"` and `cleanupStatus: cleanup_failed` — never a masked success. A technical failure (auth, permission, timeout, unparseable output) is always `ERROR`/`cleanup_failed`, never reinterpreted as "already cleaned".
6. Rewrites the **original** run-manifest file in place — cleanup never creates a new manifest, and never touches its `lifecycleState`/`lifecycleEvents` (those remain the create-run's own record).
7. Writes and validates the mandatory skill execution log itself, from the same run-state as the manifest update — the skill never calls `pipeline/bin/log-skill` itself for this run.

Parse the JSON output (the updated run manifest plus `manifestPath`, `cleanupSkillLog`, and `cleanupResult`):
- `status` is exactly one of `PASSED` / `PASSED_WITH_WARNINGS` / `NOT_APPLICABLE` / `BLOCKED` / `FAILED` / `ERROR` (A-06) — **never** treat `BLOCKED`/`FAILED`/`ERROR` as a successful cleanup.
- `cleanupStatus` — `cleaned` (confirmed by re-query), `cleanup_failed` (retryable — repeat from Step 3 with the same manifest), or unchanged if execution never reached DML.
- `cleanupResult.survivingIds` — root IDs still present after re-query, if any.
- `cleanupSkillLog` — the exact skill-log file path once written and validated; if `errorClass: "LOGGING_ERROR"` is returned instead, the manifest's `cleanupStatus` already reflects the true DML outcome, but the skill log itself could not be written/validated — treat this as a technical failure requiring follow-up, **never as success**, even though DML may already have succeeded.

### Step 6: Summary

Present per manifest:
- Manifest path and org alias
- Root records and their final `cleanupStatus`
- `cleanupResult.survivingIds` (if any) — instruct the user that a retry via Step 3 is possible for these
- Any `warnings`/`halts` from the executor output
- The exact `cleanupSkillLog` path (already written and validated by `execute` — the skill does not write a second log for this run)

## Legacy-Recovery Mode (Pre-Manifest Runs Only)

If the user explicitly asks to clean up a run from **before** the run-manifest system existed (no matching manifest can be found in Step 1), use the separate, clearly labeled two-step Legacy-Recovery path instead of inventing a manifest. This is never a free name/number/pattern search — root records are resolved exclusively through the catalog's declared `cleanup.legacyCleanupFallback.externalKeyField`, and a match count other than exactly one is always rejected.

### Stufe 1: Legacy-Plan (DML-free preview)

```bash
pipeline/bin/testdata-cleaner legacy-plan --org <org-alias> --key-field <field> --key-value <value> --project-root .
```

- `--key-field` **must exactly match** the catalog's configured `cleanup.legacyCleanupFallback.externalKeyField` — the runner rejects any other field with `errorClass: LEGACY_KEY_FIELD_MISMATCH`. This mode can never search an arbitrary, undeclared field.
- A match count of **zero or more than one** is always `"status": "BLOCKED"` with `ambiguousMatch: true` and `errorClass: LEGACY_AMBIGUOUS_MATCH` — there is no "not found, nothing to do" short-circuit and no implicit best-match selection. Only exactly one match proceeds.
- A single match is also checked against `cleanup.protectedRecords` — an overlap is `"status": "BLOCKED"`/`PROTECTED_RECORD_OVERLAP`, exactly like the standard path.
- The result is `legacyMode: true`, carries an explicit `warning` label, and — once `"status": "PASSED"` — a `planDigest`. It is a **DML-free preview only**; save it unmodified for Stufe 2.

**Before any deletion of legacy-fallback records, get the customer's Salesforce owner's explicit, separate approval** and document the action per `pipeline/CLAUDE.md`'s Data Remediation sequence (plan → backup → rollback script → verify counts → execute → verify results → document). Do not treat a legacy preview as itself authorizing DML.

### Stufe 2: Legacy-Execute (approval-gated DML)

Only after explicit approval, run:

```bash
pipeline/bin/testdata-cleaner legacy-execute --legacy-plan <legacy-plan-json-path> --org <org-alias> --project-root .
```

This accepts **only** the exact, unmodified plan from Stufe 1 — re-verified via its `planDigest`, `orgAlias`, the catalog's current digest, and the catalog's current `legacyCleanupFallback.externalKeyField` before the executor is ever invoked; any drift is rejected with `"status": "ERROR"` and no executor call. It then runs the same catalog-configured cleanup executor as the standard path, re-queries the org for the resolved record's continued existence, and writes a **separate, schema-validated result artifact** (`schemas/testdata-cleanup-result.schema.json`, `provenance: "legacy-recovery"`) into the customer log path — **never a rewritten or invented run manifest** — plus the mandatory skill execution log.

Parse the JSON output:
- `resultPath` — the exact file path of the written, schema-validated Legacy-Recovery result artifact
- `status` — same six-value vocabulary as the standard path; a technical failure is always `ERROR`, never reinterpreted as a successful recovery
- `cleanupSkillLog` — the exact skill-log path, or `errorClass: "LOGGING_ERROR"` if it could not be written/validated (the result artifact itself was still written faithfully in that case)

## Important Rules

- Follow all conventions from CLAUDE.md
- **No manual SOQL/DML alternative:** every part of this workflow — standard cleanup and Legacy-Recovery alike — goes exclusively through `pipeline/bin/testdata-cleaner`. Never offer or fall back to a hand-written SOQL query or Apex delete as a substitute for a blocked or failed runner call.
- **FINALIZED manifests only (A-03):** an incomplete or non-finalized manifest (including one stuck at `LOGGING_ERROR`) is never cleanup-eligible, even if it already shows root records or a `cleanupStatus` other than `not_applicable`.
- **Manifest-IDs are the standard cleanup contract (A-02):** a standard cleanup never searches by name, number, or pattern — only a FINALIZED, schema-valid run manifest's `rootRecords` may anchor a deletion.
- **Never bypass a `BLOCKED` protected-record overlap** — if `plan`/`legacy-plan` reports an overlap, stop; do not attempt a workaround.
- **The manifest signature (M-9) is an authorization gate, not a formality:** `MANIFEST_SIGNATURE_INVALID` means a tampered/planted manifest — abort, never `--allow-unsigned-manifest` your way past it (the flag waives only a *missing* signature, never an invalid one). Use `--allow-unsigned-manifest` solely for a genuine pre-signing manifest the operator confirms they produced and trust.
- **Digests are the tamper/staleness guard:** never hand-edit a saved cleanup-plan or legacy-plan JSON file before calling `execute`/`legacy-execute` — the runner recomputes and rejects a mismatched `cleanupPlanDigest`/`manifestDigest`/`planDigest`/catalog digest with `status: ERROR`.
- **Re-query decides `cleaned`, not the executor's own exit code:** a surviving root record after re-query is always `cleanup_failed`/`FAILED`, even if the executor itself reported success.
- **A logging failure is never a success:** if `execute`/`legacy-execute` returns `errorClass: "LOGGING_ERROR"`, treat the run as a technical failure requiring follow-up — even though the manifest/result artifact already recorded the true DML outcome.
- **Mandatory approval:** two gates — before `execute` (DML) for the standard path, and before `legacy-execute` (DML) for Legacy-Recovery. No exceptions.
- **Idempotent by design:** re-running `plan` on an already-`cleaned` manifest reports `NOT_APPLICABLE` with no DML attempted.
- Read all executor paths, protected records, and deletion order from the catalog — do not hardcode.
- Read org aliases from `stack.config.md` — do not hardcode.
- **Never call `pipeline/bin/log-skill` directly for this run** — `execute`/`legacy-execute` already write and validate the mandatory skill log themselves from the same run-state.

## Error Handling

- If the org is not authenticated or unreachable, inform the user and abort
- If no cleanable manifests are found for the target org, inform the user and stop — offer Legacy-Recovery mode only if the user explicitly confirms this is a pre-manifest run
- If `plan` returns `"errorClass": "MANIFEST_NOT_FINALIZED"`, inform the user the run never completed (or never finished logging) and is not cleanup-eligible — never attempt to force a cleanup against it
- If `plan` returns `BLOCKED` (protected-record overlap) or `ERROR` (foreign org, catalog-digest mismatch, invalid manifest, missing cleanup executor), display the details and abort that manifest's cleanup — never continue past a block
- If `plan`/`execute` returns `errorClass: MANIFEST_SIGNATURE_INVALID`, treat it as tampering/forgery — abort and never override. `MANIFEST_SIGNATURE_UNVERIFIABLE` means the operator must supply the signing key and re-run. `MANIFEST_UNSIGNED` is a legacy (pre-signing) manifest — proceed only with `--allow-unsigned-manifest` after the user explicitly confirms they produced and trust it (never add the flag on your own)
- If `execute` returns `errorClass: "CLEANUP_EXECUTOR_UNAVAILABLE"`, the cleanup executor file is not present in the current project root. This is a hard block before any query or DML — do not attempt to work around it. Missing CREATE-executor warnings from the catalog do NOT block cleanup; only a missing cleanup executor does.
- If `execute` returns `errorClass: PLAN_DIGEST_MISMATCH` / `CLEANUP_PLAN_DIGEST_MISMATCH` / `MANIFEST_DIGEST_MISMATCH` / `CATALOG_DIGEST_MISMATCH`, inform the user the plan, manifest, or catalog changed since `plan` and require a fresh `plan` → approval cycle
- If `execute` returns `cleanupStatus: cleanup_failed` with `cleanupResult.survivingIds`, inform the user which records are still present and offer a retry (Step 3 again, same manifest)
- If `execute`/`legacy-execute` returns `errorClass: "LOGGING_ERROR"`, treat this as a technical failure requiring manual reconciliation — show `skillLogError` and the manifest/result path so the run can be investigated and re-logged manually
- If `legacy-plan` returns `ambiguousMatch: true` (zero or multiple matches), inform the user no unique record could be resolved and stop — never proceed with a best-guess selection
- If `legacy-execute` returns `errorClass: LEGACY_PLAN_DIGEST_MISMATCH` / `LEGACY_KEY_FIELD_MISMATCH`, inform the user the legacy plan or the catalog's legacy configuration changed and require a fresh `legacy-plan` → approval cycle
- If the user cancels, abort gracefully with no changes
