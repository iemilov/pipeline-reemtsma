---
name: implement-us
description: Generate a first draft of implementation for a user story using the appropriate tools for the project's tech stack, based on FINAL implementation notes when they exist. Supports Jira or local Markdown stories (see config)
argument-hint: [story-key] [--skip-deploy] [--no-pr]
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

## Configuration

Before executing, read:
- `pipeline/customer.config.md` — `Platform`, `Short Name`, **UI Language** (every generated user-facing string, label, button text, page title and error message uses this language), **Validation Rule Messages** language, CI skip pattern, `## Folder Paths` (**Implementation Design**, **Deployment Packages**), `## Repository & CI/CD` (branch patterns, Azure DevOps URL, co-author and AI attribution policy), `## Story Backend`, `## Atlassian` (Cloud ID)
- `pipeline/stack.config.md` — naming conventions, API version, `## Org Configuration > Sandboxes` (DEV target = first alias whose purpose contains "Development"), `## Static Analysis` (PMD rules file, Prettier and lint commands), test data factory, source path, Testing Standards
- `pipeline/customer.domain.md` — business logic and field-name pitfalls

**Notes location — `<notes-dir>`:** the **Implementation Design** path from `customer.config.md` with `<story-key>` replaced by `$ARGUMENTS`, relative to the main repository root (e.g. `implementation-design/AP2-1583/`). Never under `pipeline/`.

## Platform Adaptation

This skill contains Salesforce-specific steps (sf CLI, Apex, Flows, LWC, `force-app/`, PMD). Read `Platform` from `customer.config.md`:
- **If `salesforce`:** follow all steps as written.
- **If not `salesforce`:** replace Salesforce tools, commands, paths and metadata types with the equivalents from `stack.config.md`; skip steps without an equivalent (PMD, `sf` commands, `package.xml`, flow activation).

## Story Backend Adaptation

Read `Story Backend` from `customer.config.md` (default `jira`):
- **`jira`:** the story is fetched via the Atlassian MCP tools (`getJiraIssue`, `transitionJiraIssue`) with the Cloud ID from config.
- **`markdown`:** the story is read from `<Stories Path>/<story-key>.md`; status transitions edit the `status` field in the YAML frontmatter. No Atlassian calls.

## Workflow: User Story → Implementation Draft

Generate an implementation for story **$ARGUMENTS**.

### Step 1: Establish the story source — notes first

1. **Check for implementation notes** at `<notes-dir>/implementation-notes.md` and classify:
   - **FINAL** — file exists, contains `**Status:** FINAL`, no `<!-- STATUS: DRAFT -->` marker.
   - **DRAFT** — file exists with a DRAFT marker or `**Status:** DRAFT`.
   - **Missing** — no file.

2. **If FINAL: the notes are the story source. Skip the Jira fetch.** Read from the notes: story title, epic key, requirements, acceptance criteria mapping, affected objects, dependencies, test scenarios, resolved questions, implementation guidance. Print one line: *"Using FINAL implementation notes from `<notes-dir>` as the story source; Jira not fetched."*
   - **Then check the notes for open items:** every non-empty line under `## Open Questions / Assumptions` other than "None" / "Keine", any `<...>` template placeholder, and an empty `## Test Scenarios` table. If any are found: **stop**, list them verbatim, and ask whether to abort and resolve them first (recommended) or proceed anyway. A "proceed anyway" is an explicit override and is recorded in the log as `story-gate: fail (overridden: <items>)`; a clean check is `story-gate: pass`.
   - The status transition to "In Progress" is still attempted for the `jira` backend (Step 1.4), but it is best-effort and never blocks.

3. **If DRAFT or Missing:** fetch the story (see 1.4) and tell the user:
   - DRAFT: *"The implementation notes for $ARGUMENTS are a DRAFT placeholder from story creation. A full design should exist before implementation."* Options: **abort and run the design step first (recommended)** or proceed with the skill's own analysis in Steps 2–3, ignoring the draft.
   - Missing: same options, worded for a missing design.
   - Either way, record `story-gate: fail (no FINAL notes)` if the user proceeds.

4. **Fetch and transition the story** (only when needed):
   - `jira`: `getJiraIssue` with key `$ARGUMENTS` — mandatory when notes are DRAFT or missing, skipped when FINAL. Then, in both cases, try `transitionJiraIssue` to "In Progress" (find the transition id first); if Jira is unreachable or the transition does not exist, note it and continue. When the story was fetched, read `issuelinks`: "is blocked by" links to stories not Done/Closed are listed and the user is asked whether to proceed.
   - `markdown`: read `<Stories Path>/$ARGUMENTS.md` (list available stories if missing), set `status: In Progress`, check `dependencies` for stories still `Open` and ask whether to proceed.

5. **Verify the deploy target** before writing code: resolve the DEV alias from `stack.config.md` and run `sf org display --target-org <alias>`. If it is unauthorized or expired, say so and ask whether to re-authorize, switch target, or run implementation-only (`--skip-deploy` behaviour: deploy, tests and test data are deferred and recorded `unchecked`).

6. **Verify the gate tools**: `pmd` on PATH and the PMD rules file from `stack.config.md` present; `node_modules` installed for Prettier and ESLint (`npm run prettier:verify` runnable). Report each missing tool with its install hint now; the user decides whether to install or proceed with that gate recorded `unchecked`.

### Step 2: Explore Codebase Patterns

Before implementing, understand:
1. Naming patterns from `stack.config.md > Naming Conventions` (class, object, field, LWC, flow patterns)
2. Existing similar implementations for the same type of solution — start from the patterns the notes reference
3. Relevant existing fields, objects and metadata on the affected sObjects
4. Test patterns — the **Test Data Factory** class from `stack.config.md` and the closest existing test class
5. **Conflicting automations** on each affected sObject: triggers and handler classes, record-triggered flows under the source path's `flows/`, validation rules, and any trigger-action custom metadata. Document order-of-execution concerns and factor them into the approach.

With FINAL notes this step is a verification of the notes against the current code, not a fresh analysis. If the code has moved since the notes were written (a referenced class or flow changed), say so and adjust.

### Step 3: Choose Implementation Approach

With FINAL notes: follow the `## Proposed Implementation Approach` and the declarative-vs-programmatic table. Deviate only when Step 2 found a blocker, and record the deviation in the notes (`## Implementation Guidance`, dated line) and in the summary.

Without notes: prefer declarative where it meets the requirement.

- **Declarative:** Flows (record-triggered, screen, scheduled, autolaunched), validation rules, formula and roll-up fields, approval processes, assignment and escalation rules, sharing rules, permission sets and groups, layouts and record types, custom metadata types and custom settings, reports and dashboards, email templates and alerts.
- **Programmatic:** Apex trigger handlers (following the project's existing trigger framework), batch plus schedulable, Apex REST/SOAP services, invocable Apex, Lightning Web Components, Aura only when extending existing Aura.

### Step 4: Feature branch

- Base branch: `az repos show --repository <repo> --org <org-url> --project <project> --query defaultBranch -o tsv` with values derived from the Azure DevOps URL in config (strip `refs/heads/`); fallback `git remote show origin | grep 'HEAD branch'`.
- `git fetch origin <base> && git checkout -b feature/$ARGUMENTS origin/<base>` using the feature branch pattern from config. If the branch already exists locally or remotely, ask whether to reuse it or pick another name.

### Step 5: Generate the implementation

Create the metadata files under the source path from `stack.config.md`. Every generated user-facing string uses the **UI Language**; validation rule messages use the **Validation Rule Messages** language. German text uses proper `ä ö ü ß`, never `ae/oe/ue/ss`.

**Flows** — `.flow-meta.xml` under `flows/`; naming per stack config; subflows for reusable logic; a `<faultConnector>` on every record create/update/delete/lookup and action call; rationale in `<description>` elements, never XML comments; `<apiVersion>NN.0</apiVersion>` from config; do not hand-tune `locationX/Y`.

**Validation rules** — under `objects/<Object>/validationRules/`; clear `errorMessage` in the configured language; `errorDisplayField` set.

**Fields, objects, custom metadata** — `.field-meta.xml` with type, label, description and help text; add new fields to the relevant layouts and permission sets; custom metadata records ship with the values the story intends (an activation flag defaulting to on or off is a business decision, state it).

**Permission sets and sharing rules** — under `permissionsets/` and `sharingRules/`.

**Apex classes**
- Explicit sharing on every class and inner class; `with sharing` unless system context is required and documented in the class header.
- `WITH USER_MODE` on user-context SOQL, `as user` on DML where the existing code base does so; never introduce `WITH SECURITY_ENFORCED`.
- No SOQL, DML or callouts in loops; configuration lookups cached per transaction; no hard-coded IDs or thresholds that exist in configuration.
- Class header with `@description` and `@see <story-key>` (and the epic key), so code links back to the story.
- Test class per production class: use the Test Data Factory; `System.runAs` or ordered DML to avoid mixed-DML errors; **one test method per decision point this story adds or changes**, asserting record state or thrown message, never "no exception"; declarative logic (a new flow decision, validation rule, custom permission check) gets an Apex test that reaches it through DML; target 80 %+ coverage, the branch list is the gate. Keep the branch → test-method list for the summary.
- Batch classes get a schedulable wrapper.

**Lightning Web Components** — under `lwc/`, naming per stack config, `.js`, `.html`, `.css` if needed, `.js-meta.xml`; Apex via `@salesforce/apex/Class.method`.

**All metadata** — `-meta.xml` with the API version from config. Bump the API version of every artifact this story **modifies** as well (flows carry it inside the definition file; Apex in the sibling `-meta.xml`), and only those — never touch files the story does not otherwise change.

Before moving on, self-check the diff against this list and fix what you find; do not hand a known violation to the reviewer.

### Step 6: Review the implementation (independent agent, gated loop)

Review the whole uncommitted change set before static analysis, tests and commit.

1. **Collect the change set:** `git status --porcelain`, `git diff`, `git ls-files --others --exclude-standard`.
3. **Triage every finding:** fix every Blocker and Major in the working tree; apply Minor/Nit when cheap, otherwise note them. Reject a finding only with an evidence anchor (`file:line`, a config section, the story) — a rejection without evidence stays open.
4. **Gate:** if Blockers or Majors remain open after fixes, re-dispatch the review on the updated change set, up to **three rounds** in total. If still open after round three, do not proceed silently: list the open findings, and ask the user whether to iterate further or continue with the gap documented (`review-gate: fail (accepted by user: <items>)`).
5. Save each round's raw output as `<notes-dir>/code-review-round-<n>.md` and record rounds, counts by severity, fixes and the gate outcome for the summary and the log.

### Step 7: Deploy and validate (`salesforce`)

Skip with `--skip-deploy` or when Step 1.5 deferred deployment; record the affected checks as `unchecked`.

1. **API version scan** over every changed flow and Apex artifact:
   ```bash
   for f in $(git diff --name-only --diff-filter=d) $(git ls-files --others --exclude-standard); do
     case "$f" in *.flow-meta.xml|*.cls-meta.xml|*.trigger-meta.xml)
       printf '%-70s %s\n' "$f" "$(grep -m1 -o '<apiVersion>[0-9.]*</apiVersion>' "$f")";; esac; done
   ```
   Every changed artifact must carry the API version from config.

2. **Format and lint gate** on the changed files:
   ```bash
   npx prettier --check <changed files>          # requires @prettier/plugin-xml for XML; run npm install first
   npx eslint <changed lwc/aura js files>        # only when LWC/Aura changed
   xmllint --noout <changed xml files>           # well-formedness
   ```
   Fix and re-run until clean. A tool that is not installed is recorded `unchecked` for that layer, not pass. Additionally, for every changed flow, check by reading it that each data element has a fault connector and that no record IDs or URLs are hard-coded.

3. **PMD gate** on every new or modified Apex class, production and test, before any test run:
   ```bash
   pmd check -d <changed .cls files> -R <PMD rules file from stack.config.md> -f text --minimum-priority 2
   ```
   Block on Priority 1 and 2 on the changed files; fix by editing the code, not by suppression, unless a deliberate exception is documented. Priority 3+ on pre-existing code is out of scope. Save the output to `deployment/$ARGUMENTS/pmd-report.txt`.

4. **Deploy to the DEV org:**
   ```bash
   sf project deploy start --source-dir <changed source dirs> -o <DEV alias> --wait 10
   ```
   On failure: analyse, fix, re-run PMD on the corrected files, retry. Save the output to `deployment/$ARGUMENTS/deploy-output.txt`.

5. **Run Apex tests** for the story's test classes:
   ```bash
   sf apex run test --class-names <TestClass...> --result-format human --code-coverage --synchronous --wait 10 \
     --output-dir deployment/$ARGUMENTS/test-results -o <DEV alias>
   ```
   Present coverage per class in a table. On failure: fix, re-run PMD, redeploy, re-run. The result files on disk are the evidence; no file, no pass.

6. **Flow activation check** — only when the deploy contained at least one flow. Query the org:
   ```bash
   sf data query -o <DEV alias> --use-tooling-api -r csv -q "SELECT Definition.DeveloperName, VersionNumber, Status FROM Flow WHERE Definition.DeveloperName IN ('<Flow1>','<Flow2>') ORDER BY Definition.DeveloperName, VersionNumber DESC"
   ```
   If the newest version of a deployed flow is not `Active`, print a warning that a UI test now would run the old version and show the activation path (Setup → Flows, or `sf project deploy start` with flow deploy-as-active enabled). **Never activate automatically.**

7. **UI tests** — only if `stack.config.md` has a `## Testing` section with an E2E framework; otherwise skip. Run the configured command against the test org, update specs for intentional UI changes, and keep the report as evidence.

For non-Salesforce platforms: run the lint, build and test commands from `stack.config.md` instead, and keep their reports.

### Step 8: Test data in the DEV org

Always create dedicated, reproducible test records for the acceptance scenarios (happy path, edge cases, error conditions), even for bug fixes that name existing records. Follow the test data skill's workflow with `pipeline/customers/<customer>/testdata.config.md`: prefer the presets the notes' `## Test Scenarios` reference, resolve record type and queue IDs, create in dependency order via the Composite Tree API with the config's placeholder tokens, pause between batches, check for duplicates first, verify by query, and present a summary table (sObject, name, record type, Id). If a parent record fails, skip its children and say so.

### Step 8b: Acceptance verification record

Write `<notes-dir>/acceptance-verification.md` with one row per acceptance criterion (from the notes' `## Acceptance Criteria Mapping`, or the story when there are no notes):

```markdown
# Acceptance Verification: $ARGUMENTS

**Story:** $ARGUMENTS
**Verified:** <YYYY-MM-DD>

| # | Acceptance Criterion | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | <criterion> | verified | deployment/$ARGUMENTS/test-results (TestClass.testMethod) |
| 2 | <criterion> | unchecked | <why it could not be verified> |
```

- `Status` is exactly `verified`, `failed` or `unchecked`. Write the truth: a criterion not verified is `unchecked`, never `verified`.
- `Evidence` is mandatory for `verified`: a test result path plus method name, an E2E report, or a concrete manual verification note.
- Criteria only a person can verify (UI layout, login-as behaviour, a manual report) get a numbered protocol in `<notes-dir>/manual-verification.md` — user or role, preparation, click path, expected result, evidence to attach — and the row's Evidence points at `manual-verification.md#<n> — pending`.

### Step 8c: Documentation impact

If topic documentation exists (`pipeline/customers/<customer>/docs/*.md` or documents linked from `customer.domain.md`), grep it for the API names of every component this run created or modified. Do not edit those documents here; list the affected ones in the summary with a recommendation to run `/build-knowledge <topic>` for each, and note any document the design notes did not anticipate. No documentation, nothing to report.

### Step 9: Commit and pull request

- **Diff hygiene:** compare `git diff --stat` with `git diff --ignore-all-space --stat`; any file whose change vanishes under `--ignore-all-space`, or that is not on the Step 5 change list, is churn — restore it with `git checkout -- <file>`. Merge the base branch with a plain `git merge`; never format after merging. A deliberately included out-of-story file needs one line of reason in the PR description.
- **Two commits when both kinds exist:**
  - **Commit 1 — deployable source** (files under the source path): message `$ARGUMENTS <summary>` **without** the CI skip pattern, so the pipeline runs.
  - **Commit 2 — non-deployable artefacts** (`deployment/*`, docs, scripts, notes): message ending with the CI skip pattern from config.
  - No `Co-Authored-By` lines and no AI references, per the config policy and CLAUDE.md.
- **Push** commit 1 on its own first, then commit 2, so the CI delta is built from the deployable tip.
- **Create the pull request** into the base branch unless `--no-pr`: Azure DevOps via `az repos pr create --org <org-url> --project <project> --repository <repo> --source-branch feature/$ARGUMENTS --target-branch <base> --title "$ARGUMENTS <summary>" --description "<text>"`; GitHub via `gh pr create`. The description references the story (`Implements $ARGUMENTS`), summarises the approach, lists manual steps, and states any deviation from the notes. If PR creation fails, ensure the branch is pushed and give the manual PR URL.
- `markdown` backend: set the story file to `status: Done`.

### Step 10: Summary

Present:
- Approach chosen and rationale; deviations from the notes, if any
- Files created and modified, grouped by type
- Branch → test-method list from Step 5
- Review outcome: rounds, findings by severity, what was fixed, gate result — an open gate accepted by the user is stated explicitly
- Gate results: PMD, format/lint, deploy, Apex tests with coverage, flow activation, UI tests — each pass / fail / unchecked with the evidence path
- Test data created (summary table)
- Acceptance verification: verified / unchecked counts, pending manual protocols
- Documentation impact
- Manual deployment steps — ask via `AskUserQuestion` whether to save them to `deployment/<version>/Release-<version>-Manual-Deployment-Steps.md` (version from the story's `fixVersions` when the story was fetched or Jira is reachable, else from a `release/<version>` branch name; if neither, display only). Append a `## $ARGUMENTS` section when the file exists; commit with the CI skip pattern.
- Open questions and assumptions

A story with an open review gate, an unchecked mandatory gate or unverified acceptance criteria is **not** reported as fully implemented; say what is outstanding.

### Step 11: Log

Always the last step, also after an early abort. Create `<YYYY-MM-DD>-<customer-short-name>-$ARGUMENTS-implement-us.json` in `.claude/skills/02-implement-us/logs/` using the CLAUDE.md JSON schema. Extend it with:

```json
"story_source": "final-notes | jira | markdown | none",
"checks": {
  "story-gate": "pass | fail (overridden: ...)",
  "review-gate": "pass | fail (accepted by user: ...)",
  "pmd": "pass | fail | unchecked — deployment/<key>/pmd-report.txt",
  "format-lint": "pass | fail | unchecked",
  "deploy": "pass | fail | unchecked — deployment/<key>/deploy-output.txt",
  "apex-tests": "pass | fail | unchecked — deployment/<key>/test-results",
  "flow-activation": "pass | warn | n/a",
  "e2e-tests": "pass | fail | unchecked | n/a",
  "acceptance": "<verified>/<total> verified"
},
"review": { "rounds": 1, "blockers": 0, "majors": 0, "minors": 0 }
```

Status: `success` only when every mandatory gate passed and all acceptance criteria are verified or covered by a manual protocol; `partial` when any gate is `unchecked`, overridden, or the review gate was accepted open; `failed` when no implementation was produced. `artifacts` lists every created or modified file.

## Important Rules

- **FINAL implementation notes are the story source.** When they exist, do not fetch the story from Jira; the transition to "In Progress" is best-effort only.
- Follow all conventions from CLAUDE.md; no AI attribution anywhere in commits, PRs, code or metadata.
- Prefer declarative solutions when they meet the requirement; follow the notes' approach when notes exist.
- Bump the API version only on artifacts this story creates or modifies.
- `@see <story-key>` in every new class header.
- The review runs before static analysis and commit; every Blocker and Major is fixed or explicitly accepted by the user.
- Green is an artifact: a gate without its output file on disk is `unchecked`, never `pass`.
- Use the naming patterns and test data factory from `stack.config.md`; read org aliases, paths and commands from config, never hardcode.

## Error Handling

- Story cannot be fetched and no FINAL notes exist: report the error and abort.
- Notes exist but are DRAFT or carry open questions: stop and ask (Step 1); a "proceed" is logged as an override.
- Feature branch exists: ask whether to reuse or rename.
- DEV org unauthorized: ask whether to re-authorize, switch, or implement without deploy.
- PMD Priority 1 or 2 on changed files: fix before deploying; never silence with suppressions.
- Deploy or tests fail after three fix attempts: stop, report the last error verbatim, keep the branch, log `partial`.
- PR creation fails: push the branch and provide the manual PR URL.
