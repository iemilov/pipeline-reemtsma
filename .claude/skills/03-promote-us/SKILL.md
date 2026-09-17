---
name: promote-us
description: Promote a user story through environments (INT/UAT/PROD) — validates locally with PMD and Apex tests, generates the deployment package, pushes to trigger the CI/CD pipeline, monitors the run, validates against production for UAT promotions, and comments the result on the story
argument-hint: [story-key] [target-env]
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

## Configuration

Read `pipeline/customer.config.md`: `Platform`, `Short Name`, `Cloud ID`, `Project Key`, `CI Skip Pattern`, `Branch Pattern: Feature / Release / Production`, `Git Strategy`, `Azure DevOps URL` (derive organisation, project and repository from it; always pass `--org <organisation URL>` to `az`), `## Folder Paths > Implementation Design`, `Deployment Packages`, `## Pipeline Environments`. Read `pipeline/stack.config.md`: `## Org Configuration > Sandboxes` (DEV = first alias whose Purpose contains "Development", UAT = "User Acceptance", PROD = "Production"), `## Static Analysis` (PMD rules file), source path, API version, Testing Standards.

`<notes-dir>` = Implementation Design path with `<story-key>` substituted, relative to the main repository root.

## Platform Adaptation

Salesforce steps as written (`sf` CLI, PMD, Apex tests, `sfdx-git-delta`, `package.xml`). For another `Platform`, replace validation and packaging with the lint, test and build commands from `stack.config.md`; skip steps without an equivalent.

## Environment flow (feature-branch strategy)

| Target | Source → Target branch | Pipeline stage | Tests |
|---|---|---|---|
| `INT` | push `feature/<story-key>` itself | INT | PMD only |
| `UAT` | `feature/<story-key>` → `release/<version>` (PR required) | UAT + DEV sync | `RunLocalTests` |
| `PROD` | `release/<version>` → `master` (PR required) | PROD validate/deploy | `RunLocalTests` |

Branch names come from the patterns in config; the table shows the defaults. If `Git Strategy` is not `feature-branch`, stop and say the skill supports only that preset here.

**Usage:** `/promote-us <story-key> <target-env>`. First word = story key, second = `INT`, `UAT` or `PROD`; ask if the target is missing.

## Workflow

### Step 1: Pre-flight

1. **Fetch the story** with `getJiraIssue` (Cloud ID from config): title, status, `fixVersions`. If `fixVersions` is empty, derive the version from the current `release/<version>` branch; if neither, ask.
2. **Verify the branch state** — the source branch exists (`git fetch origin && git branch -r`). For `UAT` and `PROD`, confirm the PR is completed:
   ```bash
   az repos pr list --org <org-url> --project <project> --repository <repo> --source-branch <source> --target-branch <target> --status all --query "[].{id:pullRequestId,status:status}" -o table
   ```
   If no completed PR exists, abort and print the create command: `az repos pr create --org <org-url> --project <project> --repository <repo> --source-branch <source> --target-branch <target> --title "<story-key> <title>"`.
3. **Close gate — acceptance verification.** Read `<notes-dir>/acceptance-verification.md`. Block when the file is missing, when any row is `failed` or `unchecked` without a manual protocol reference, or when the row count is below the criteria count in the notes' `## Acceptance Criteria Mapping`. Present the findings; only the user may override, and an override is logged as `story-gate-close: fail (overridden: <items>)`. An unattended run aborts.
4. **Manual deployment steps** — if `deployment/<version>/Release-<version>-Manual-Deployment-Steps.md` has a section for the story, show it as a reminder.

### Step 2: Identify and validate the artefacts

1. **Identify files:** grep the source path for `@see <story-key>` in classes and triggers; list metadata (custom metadata, fields, flows, validation rules, LWC, permission sets) changed on the branch: `git diff --name-only origin/<target-or-base>...HEAD -- <source-path>`. Cross-check with the notes' `## Affected Objects & Fields`; warn on anything missing.

2. **PMD** on all identified non-test Apex classes:
   ```bash
   pmd check -d <comma-separated .cls> -R <PMD rules file> -f text
   ```
   Stop on Priority 1 or 2, warn on 3+. Save the output to `deployment/<story-key>/pmd-report.txt`. If `pmd` or the rules file is missing, say so and record the gate `unchecked`.

3. **Apex tests** against the DEV org:
   ```bash
   sf apex run test --class-names <Test1> <Test2> --result-format human --code-coverage --synchronous --wait 10 \
     --output-dir deployment/<story-key>/test-results -o <DEV alias>
   ```
   Show coverage per class in a table; stop on failures. No result files on disk → `unchecked`.

   UI tests only if `stack.config.md` has a `## Testing` section with an E2E framework; run the configured command and keep the report.

4. **Present the validation summary** (file list, PMD, tests) and ask via `AskUserQuestion`: "Validation passed. Promote to <target>?" — yes / abort.

### Step 3: Prepare the deployment package

```bash
mkdir -p deployment/<story-key>
sf sgd:source:delta --from origin/<target-branch> --to HEAD -o deployment/<story-key> --json
```

Falls back to a hand-written `package.xml` (API version from config) collecting the identified metadata when `sfdx-git-delta` is not installed. Show `deployment/<story-key>/package/package.xml` and, if non-empty, `destructiveChanges/destructiveChanges.xml`. For `PROD`, merge the story package into `deployment/<version>/package/package.xml` (add members, keep existing ones) so the release package accumulates all stories.

### Step 4: Promote

**INT**
```bash
git push origin feature/<story-key>
```
The pipeline triggers the INT stage.

**UAT** — PR completed (Step 1.2), then:
```bash
git checkout release/<version> && git pull origin release/<version>
git add deployment/<story-key> && git commit -m "<story-key> deployment package <CI skip pattern>"
git push origin release/<version>
```
The merged source commit already triggered the UAT stage; the package commit carries the skip pattern. Never put the skip pattern on a commit containing deployable source.

**PROD** — confirm via `AskUserQuestion`: "This targets PRODUCTION. Continue?" Then, with the PR completed:
```bash
git checkout master && git pull origin master
git add deployment/<version> && git commit -m "<story-key> release package <version> <CI skip pattern>"
git push origin master
```
The pipeline runs the PROD validate stage from the merged source. Direct pushes of source to `master` are never made by this skill.

### Step 5: Monitor the pipeline

```bash
az pipelines runs list --org <org-url> --project <project> --branch <branch> --top 1 -o table
az pipelines runs show --org <org-url> --project <project> --id <run-id> --query "{status:status,result:result,url:_links.web.href}" -o json
```
Poll every 30 seconds up to 10 minutes; report succeeded / failed / cancelled with the run link. If `az` is unavailable or not logged in, print the pipeline URL `<org-url>/<project>/_build` and record the check `unchecked`. On failure, fetch the logs (`az pipelines runs show` → log URL), analyse, propose fixes, offer a re-run.

### Step 6: Post-deployment

1. **Jira comment** via `addOrEditJiraIssueComment`: environment, pipeline result and link, commit hash, branch. No AI attribution.
2. **UAT only — production validation dry run:**
   ```bash
   sf project deploy validate -x deployment/<story-key>/package/package.xml -o <PROD alias> --verbose -l RunLocalTests
   ```
   Report separately; save the output to `deployment/<story-key>/prod-validation.txt`.
3. **Deployment report** table: PMD, local tests, package generated (component count), pipeline triggered (branch, commit), pipeline status (link), PROD validation (UAT only) — each pass / fail / unchecked / n/a.
4. Remind about manual deployment steps if the release file has a section for the story.

### Step 7: Log

Create `<YYYY-MM-DD>-<customer-short-name>-<story-key>-promote-us.json` in `.claude/skills/03-promote-us/logs/` per the CLAUDE.md JSON schema, with a `checks` object: `story-gate-close`, `pmd`, `apex-tests`, `e2e-tests` (or n/a), `ci-pipeline`, `prod-validation` (UAT only), each with pass / fail / unchecked and the evidence path or link. Status `success` only with every applicable check passed; `partial` on any `unchecked` or override; `failed` when nothing was promoted.

## Important Rules

- Always confirm the file list before promoting; always confirm PROD explicitly.
- Never push source directly to the release or production branch; PRs are the gate.
- CI skip pattern only on non-deployable commits (packages, notes).
- Always pass `--org` to `az`; never rely on CLI defaults.
- Green is an artefact: a gate without its output on disk is `unchecked`, never `pass`.
- No AI attribution in commits, comments or reports.

## Error Handling

- Story not fetchable: show the error and abort.
- PR not completed for UAT/PROD: abort with the create command.
- PMD or rules file missing: warn, record `unchecked`, continue only if the user agrees.
- Tests fail: stop before promoting.
- Target branch missing: report and suggest creating it.
- Pipeline fails: show the error, propose fixes, offer re-run.
- Org alias unknown: `sf org list` and ask.
