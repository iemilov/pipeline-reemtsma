---
name: promote-us
description: Promote a user story through environments (INT/UAT/PROD) — validates locally, generates packages, triggers CI/CD pipeline, monitors result
argument-hint: [story-key] [target-env]
preferred-runtime: openai-codex
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`


> **Runtime hint:** This skill prefers `openai-codex` (CI/CD shell mechanics). If the active `Agent Runtime` (from `customer.config.md`) differs after applying any `## Skill Runtime Overrides`, print the standardized warning from `pipeline/agent-runtime-access.md` §1a and proceed. Record `active_runtime`, `preferred_runtime`, and `runtime_match` in the execution log.

## Configuration

Before executing, read `pipeline/customer.config.md` for customer-specific values (Atlassian Deployment Type, CI skip pattern, branch patterns, **Platform**, **Git Strategy**), `pipeline/stack.config.md` for stack-specific values (org aliases, PMD rules file, naming prefixes, deployment folder paths, API version), and review the CI/CD pipeline configuration for pipeline stage structure. For all Jira calls, consult the **Atlassian adapter** at `pipeline/atlassian-access.md`. For all git workflow mechanics — environment flow per target, PR-required gates, branch role resolution — consult the **Git Strategy adapter** at `pipeline/git-access.md`.

## Platform Adaptation

This skill contains Salesforce-specific references (sf CLI, Apex tests, PMD, `sfdx-git-delta`, `package.xml`). Read `Platform` from `customer.config.md` (`pipeline/bin/config "Platform"`):
- **If `salesforce`:** Follow all steps as written.
- **If not `salesforce`:** Adapt all steps to the project's tech stack as described in `stack.config.md`. Replace Salesforce-specific validation (PMD, Apex tests, `sf deploy validate`) with the equivalent linting, testing, and deployment commands from the stack configuration. Skip steps that have no equivalent (e.g., `package.xml` generation, `sfdx-git-delta`, org validation).

## Workflow: Promote & Deploy

Promote a user story's implementation through environments. This skill prepares deployment packages, validates code quality, pushes to trigger the CI/CD pipeline, and monitors the result.

**Usage:** `/promote-us <story-key> <target-env>`

Parse `$ARGUMENTS` as a space-separated string: the **first word** is the story key (e.g., `CRM-2961`), the **second word** is the target environment (`INT`, `UAT`, or `PROD`). If the target environment is omitted, ask the user which environment to target.

### Environment Flow

The source branch, target branch, and PR gate per target environment are defined by the active **Git Strategy** preset — see `pipeline/git-access.md` §5 for the per-preset flow tables. The skill must NOT hardcode `feature/<story>`, `release/<version>`, or `master` as branch names; instead, resolve them via `resolve-branch-role(role, story-key, version)` from adapter §7. The default preset (`feature-branch`) yields:

| Target | Source role → Target role | Pipeline Stage | Tests |
|--------|---------------------------|----------------|-------|
| `INT` | `feature` → (push feature itself) | INT | PMD only |
| `UAT` | `feature` → `integration` | UAT2 + DEV Sync | `RunLocalTests` |
| `PROD` | `integration` → `trunk` | PROD | `RunLocalTests` |

Under `trunk-based`, all three targets collapse to a push (or tag) on `trunk`. Under `gitflow`, `UAT` is `integration` → `release` (develop → release) and a hotfix lane exists. See adapter §5 for the full per-preset breakdown.

---

### Step 1: Pre-Flight Checks

1. **Fetch story from Jira** via the Atlassian adapter's `getJiraIssue` operation (see `pipeline/atlassian-access.md` §3 — branch on `Deployment Type` from `customer.config.md`) with the story key
2. **Determine the release version**:
   - Read `fixVersions` from the Jira story
   - Fallback: derive from current branch name when on a release branch (the pattern comes from adapter §7 `resolve-branch-role(release, ...)`)
3. **Verify branch state** — consult `pipeline/git-access.md` §5 for the source-role → target-role pair, then `pipeline/git-access.md` §7 to resolve role names into concrete branch names:
   - Confirm the source branch exists.
   - If the target environment requires a PR gate (per adapter §4A), check whether the PR is completed. If not, abort with an actionable message including the open-PR command from adapter §4C.
   - Trunk-based exception: for `UAT` and `PROD` no branch transition happens — the gate is the CI/CD tag-or-promote mechanism described in the customer's `stack.config.md > ## Key Commands > Deployment`. Verify the local checkout is on the trunk and matches `origin/<trunk>`.
4. **Run the close gate** — a story with unverified acceptance criteria must not be promoted. Resolve `<notes-dir>` from the **Implementation Design** config path (as in Step 2.1) and run:
   ```bash
   pipeline/bin/story-gate --phase close \
     --verification <notes-dir>/acceptance-verification.md \
     --notes <notes-dir>/implementation-notes.md
   ```
   - **`decision=pass`** → continue; log `--check "story-gate-close:pass"` in the execution log.
   - **`decision=block`** → **STOP.** Present the `finding=` lines verbatim (missing record, failed/unchecked criteria, missing evidence, coverage gap). Only the user may decide to promote anyway; record that override as `--check "story-gate-close:fail:<the overridden findings, briefly>"` — an overridden gate stays `fail`, never `pass` (`CLAUDE.md > Quality Gate & Loop Engineering` rule 2a). An unattended run has no user who could override: abort.
5. **Check for the Manual Deployment Steps file** at `deployment/<version>/Release-<version>-Manual-Deployment-Steps.md` — if it exists and contains a section for this story, display the steps as a reminder to the user

### Step 2: Identify & Validate Deployment Artifacts

1. **Identify all files** related to this story:
   - Search for the story key in `@see` tags and comments across Apex classes
   - Search for related metadata (Custom Metadata, custom fields, flows, validation rules, LWC, triggers, permission sets)
   - Check `implementation-notes.md` at the **Implementation Design** config path (`pipeline/bin/config "Implementation Design"`, with `<story-key>` substituted — customer **config** repo, not the repo-root `implementation-design/`) for expected scope
   - If implementation notes exist, cross-reference identified files against expected components — warn if anything appears missing

2. **Run PMD check** on all identified Apex classes (not test classes) using the **PMD rules file** from config:
   ```bash
   pmd check -d <comma-separated-class-files> -R <pmd-rules-file> -f text
   ```
   - **Stop and fix** Priority 1 or Priority 2 violations before proceeding
   - Warn about Priority 3+ violations but allow continuation
   - **Keep the report:** write the PMD output to `deployment/<story-key>/pmd-report.txt` — that is the evidence for the `pmd` check in the execution log (see *Important Rules*). Green is an artifact, not a claim

3. **Run tests locally**:

   **For `salesforce` platform:**
   Run Apex tests against the DEV org (alias from config):
   ```bash
   sf apex run test --class-names <TestClass1> <TestClass2> --result-format human --code-coverage --synchronous --wait 10 \
     --output-dir deployment/<story-key>/test-results -o <DEV-alias-from-config>
   ```
   - Present code coverage results in a table
   - If tests fail, stop and fix before proceeding
   - **Keep the machine-readable result:** `--output-dir` persists the run's JSON/JUnit artifact; its path is the evidence for the `apex-tests` check in the execution log. If no result file exists on disk, the check is `unchecked`, never `pass`

   Then check `stack.config.md` for a `## Testing` section with UI tests:
   - **If no `## Testing` section exists** or `E2E Framework` is `none`, skip UI testing
   - If `E2E Framework` is set (e.g., Playwright):
     1. Retrieve the org URL via `sf org open -o <Test Org Alias from config> --url-only`
     2. Run the E2E tests using the configured command (e.g., `npx playwright test`)
     3. **All UI tests must pass before promoting** — if any test fails, stop and fix before proceeding
     4. Present a summary of UI test results (passed/failed/skipped)
     5. Keep the framework's machine-readable report (JUnit XML, Playwright report directory) and note its path — the evidence for the `e2e-tests` check in the execution log. No report on disk → `unchecked`, never `pass`

   **For non-`salesforce` platforms:**
   Check `stack.config.md` for a `## Testing` section:
   - **If no `## Testing` section exists**, skip UI testing
   - If `E2E Framework` and `Component Test Framework` are both `none`, skip testing
   - If `Component Test Framework` is set: run the component test command (e.g., `npm run test`)
   - If `E2E Framework` is set: run the E2E test command (e.g., `npm run test:e2e`)
   - **All tests must pass before promoting** — if any test fails, stop and fix before proceeding
   - Present a summary of test results (passed/failed/skipped)
   - Keep the framework's machine-readable report (JUnit XML, Playwright report directory) and note its path — the evidence for the `e2e-tests` check in the execution log. No report on disk → `unchecked`, never `pass`

4. **Present the validation summary** and ask for confirmation:
   - List all files that will be part of the deployment
   - Show PMD results and test results
   - Ask: "Validation passed. Proceed with promotion to <target-env>?"
   - Option 1: "Yes, promote"
   - Option 2: "No, abort"

### Step 3: Prepare Deployment Package

1. **Generate the deployment package** at `deployment/<story-key>/`:
   ```bash
   mkdir -p deployment/<story-key>
   ```
   - Use `sfdx-git-delta` to generate `package/package.xml` and `destructiveChanges/destructiveChanges.xml`:
     ```bash
     sf sgd:source:delta --from HEAD~1 -o deployment/<story-key> --json
     ```
   - If `sfdx-git-delta` is not available, generate `package.xml` manually by collecting all metadata types from the identified files

2. **Display the generated package** for user review:
   - Show `deployment/<story-key>/package/package.xml`
   - Show `deployment/<story-key>/destructiveChanges/destructiveChanges.xml` (if non-empty)

3. **For PROD promotions**, also create/update the **versioned release package** at `deployment/<version>/`:
   - Merge the story's package.xml into `deployment/<version>/package/package.xml` (add new members, preserve existing ones)
   - Merge destructive changes similarly
   - This accumulates all stories for the release into one deployment package

### Step 4: Promote (Push to Trigger Pipeline)

The promotion strategy depends on the target environment **and** the active **Git Strategy** preset. For each target, look up the source/target role pair in `pipeline/git-access.md` §5, then resolve roles to concrete branch names via §7.

Use `<source-branch>` and `<target-branch>` below as placeholders for the resolved names; use `<pr-required>` for the boolean from adapter §4A.

#### INT (deploy to integration environment)

Source/target roles from adapter §5: under `feature-branch` → push the feature branch itself; under `gitflow` → `feature → integration` (develop); under `trunk-based` → already on trunk.

1. Ensure all changes on `<source-branch>` are committed.
2. If `<pr-required>` is `true` for this transition (adapter §4A) and a PR is not yet completed, abort with: "PR `<source-branch> → <target-branch>` must be completed first. Open at <URL>." Show the open-PR command from adapter §4C.
3. Push the source branch (or trunk under `trunk-based`):
   ```bash
   git push origin <source-branch>
   ```
4. The pipeline automatically triggers the INT stage (per the customer's CI/CD config).

#### UAT (promote to UAT environment)

Source/target roles from adapter §5: `feature-branch` → `feature → integration` (release); `gitflow` → `integration → release` (develop → release); `trunk-based` → tag-or-promote on trunk, no git transition.

1. **For `feature-branch` and `gitflow`**:
   - Verify the source branch is merged into the target branch (PR completed per adapter §4A). If not, abort and show the open-PR command.
   - Checkout and pull the target branch:
     ```bash
     git checkout <target-branch>
     git pull origin <target-branch>   # pull command per adapter §3
     ```
   - Ensure the commit message contains the story key (the customer's pipeline extracts it via the Jira project's key pattern):
     ```bash
     git add deployment/<story-key>
     git commit -m "<story-key> [skip ci]"
     git push origin <target-branch>
     ```
     Note: Remove `[skip ci]` to allow the pipeline to trigger, OR push the code change commit (without skip ci) separately.
   - The pipeline automatically triggers: UAT stage (delta deploy + `RunLocalTests`) → any downstream sync stages.
2. **For `trunk-based`**:
   - No branch transition. Trigger the customer's tag-or-promote mechanism documented in `stack.config.md > ## Key Commands > Deployment` (typically `git tag uat/<version> <trunk-sha> && git push origin uat/<version>`, or a CI/CD API call).
   - Show the resolved promotion command to the user and confirm before executing.

#### PROD (validate / deploy to production)

Source/target roles from adapter §5: `feature-branch` → `integration → trunk`; `gitflow` → `release → trunk`; `trunk-based` → tag-or-promote on trunk.

1. Confirm with the user — this is a production deployment:
   - Ask: "This will validate against PRODUCTION. Are you sure?"
   - Option 1: "Yes, validate against PROD"
   - Option 2: "No, abort"
2. **For `feature-branch` and `gitflow`**:
   - Verify the source branch is merged into the target branch (PR completed per adapter §4A). If not, abort and show the open-PR command.
   - If the versioned release package exists at `deployment/<version>/package/package.xml`, push it:
     ```bash
     git checkout <target-branch>
     git pull origin <target-branch>   # pull command per adapter §3
     git push origin <target-branch>
     ```
   - The pipeline triggers: Generate PROD Package → Deploy Validate (with `RunLocalTests`).
3. **For `trunk-based`**:
   - No branch transition. Trigger the customer's PROD tag-or-promote mechanism (typically `git tag prod/<version> <trunk-sha> && git push origin prod/<version>`).
4. **For `gitflow`** (post-deployment): surface the required back-merges in Step 6 — `release → develop`, and for any hotfix branches `hotfix → develop` — per adapter §5C.

### Step 5: Monitor Pipeline

1. **Check pipeline status** — use the **Azure DevOps** config from `customer.config.md` if available:
   - **Primary (if Azure DevOps is configured):**
     ```bash
     az pipelines runs list --org "<Organization>" --project "<Project>" --branch <branch> --top 1 --output table
     ```
   - **Fallback (if `az` CLI is unavailable, not authenticated, or Azure DevOps is not configured):** Provide the user with a direct link to the pipeline run:
     ```
     <Organization>/<Project-URL-encoded>/_build
     ```

2. **Poll for completion** (if `az` CLI is available):
   - Check every 30 seconds, up to 10 minutes
   - Report the final status (succeeded, failed, cancelled)

3. If the pipeline **fails**:
   - Fetch the pipeline logs if possible
   - Analyze the error and suggest fixes
   - Offer to re-run after fixes are applied

### Step 6: Post-Deployment Actions

1. **Comment on the Jira story** with the deployment result:
   - Environment deployed to
   - Pipeline status (success/failure)
   - Commit hash and branch

2. **For UAT promotions**: Also validate against the **production org** (from config) as a dry run:
   ```bash
   sf project deploy validate -x deployment/<story-key>/package/package.xml -o <PROD-alias-from-config> --verbose -l RunLocalTests
   ```
   - Present the validation result separately
   - This catches PROD-specific issues early

3. **Present a deployment report**:

   | Step | Status | Details |
   |------|--------|---------|
   | PMD Check | Pass/Fail | Violations by priority |
   | Local Tests | Pass/Fail | Pass rate, coverage |
   | Package Generated | Yes | Components count |
   | Pipeline Triggered | Yes/No | Branch, commit hash |
   | Pipeline Status | Success/Failed/Pending | Link to run |
   | PROD Validation | Pass/Fail/Skipped | (UAT only) |

4. **Surface manual deployment steps** — if `deployment/<version>/Release-<version>-Manual-Deployment-Steps.md` contains steps for this story, remind the user that manual steps are required after deployment

## Important Rules
- Follow all conventions from CLAUDE.md
- Always confirm the file list with the user before promoting
- **Never push directly to master** without explicit user confirmation
- Use the Atlassian adapter (`pipeline/atlassian-access.md`) for all Jira operations — branch on `Deployment Type` from `customer.config.md`; never hardcode URLs, Cloud IDs, or PAT env var names
- Use the Git Strategy adapter (`pipeline/git-access.md`) for all branch/PR/promotion mechanics — branch on `Git Strategy` from `customer.config.md > ## Repository & CI/CD`; never hardcode `feature/<story>`, `release/<version>`, or `master` as branch names
- Commit messages for pipeline-triggering pushes must contain the story key (`CRM-XXXX`) — the pipeline extracts it
- When test classes are executed, always return the code coverage from the test run in a table
- ALWAYS comment on the related user story in Jira on successful deployment and validation
- ALWAYS write the execution log with `pipeline/bin/log-skill` — never hand-author the JSON. Run:
  ```bash
  pipeline/bin/log-skill --skill promote-us --identifier <story-key> --status <success|partial|failed> \
    --preferred-runtime openai-codex \
    --summary "<1–2 sentence result>" \
    --artifact <path> \
    --check "story-gate-close:<pass|fail>:<gate reason or override note>" \
    --check "pmd:<pass|fail|unchecked>:deployment/<story-key>/pmd-report.txt" \
    --check "apex-tests:<pass|fail|unchecked>:deployment/<story-key>/test-results" \
    --check "e2e-tests:<pass|fail|unchecked>:<report path>" \
    --check "ci-pipeline:<pass|fail|unchecked>:<pipeline run link>" \
    --check "prod-validation:<pass|fail|unchecked>:<validation output path>" \
    --output "<full run text>"
  ```
  It guarantees a schema-valid document and writes it to `pipeline/customers/<customer>/logs/<YYYY-MM-DD>-<customer-short-name>-<story-key>-promote-us.json` (customer, active runtime, and timestamp resolve from config automatically; pass `--artifact` once per created/modified file; the directory is created if needed).
  - Record one `--check` per gate this promotion actually reached, each with the path (or link) of the artifact the verdict came from. **Green is an artifact, not a claim:** a gate whose evidence is not on disk — tool missing, step could not run — is `unchecked`, never `pass`, and per `CLAUDE.md > Quality Gate & Loop Engineering` rule 2a every `fail` and every `unchecked` on a mandatory check counts as at least one `--majors`.
  - **Omit** a `--check` only for a gate that does not apply to this promotion at all (e.g. `prod-validation` outside UAT, `e2e-tests` when the stack configures no test framework). Not-applicable is omitted; could-not-run is `unchecked` — the two must never be conflated.

## Error Handling
- If the Jira issue cannot be fetched, inform the user with the error details and abort
- If PMD is not available on the system, warn the user and skip the PMD step (do not fail the entire workflow) — and record `--check "pmd:unchecked:pmd not installed"` in the execution log: a check that could not run is unchecked, never pass
- If local tests fail, stop before promoting — do not push broken code to trigger the pipeline
- If the target branch does not exist, inform the user and suggest creating it
- If the PR is not yet merged (for UAT/PROD), inform the user and abort — do not auto-merge
- If the pipeline fails, display the error details and suggest fixes
- If the `az` CLI is not available, skip pipeline monitoring and provide the manual link instead — and record `--check "ci-pipeline:unchecked:<manual link>"`: the pipeline result was not observed by this run
- If the org alias is not recognized, list available orgs using `sf org list` and ask the user to pick one
