---
name: promote-us
description: Promote a user story through environments (INT/UAT/PROD) — validates locally, generates packages, triggers CI/CD pipeline, monitors result
argument-hint: [story-key] [target-env]
---

## Configuration

Before executing, read `pipeline/customer.config.md` for all customer-specific values (Cloud ID, org aliases, PMD rules file, naming prefixes, deployment folder paths) and review `azure-pipelines.yaml` for pipeline stage structure.

## Workflow: Promote & Deploy

Promote a user story's implementation through environments. This skill prepares deployment packages, validates code quality, pushes to trigger the CI/CD pipeline, and monitors the result.

**Usage:** `/promote-us <story-key> <target-env>`

Parse `$ARGUMENTS` as a space-separated string: the **first word** is the story key (e.g., `CRM-2961`), the **second word** is the target environment (`INT`, `UAT`, or `PROD`). If the target environment is omitted, ask the user which environment to target.

### Environment Flow

| Target | Source Branch | Pipeline Stage | Tests | Description |
|--------|-------------|----------------|-------|-------------|
| `INT` | `feature/<story-key>` | INT | PMD only | Validate feature against integration |
| `UAT` | `release/<version>` | UAT2 + DEV Sync | `RunLocalTests` | Promote to UAT for testing |
| `PROD` | `master` | PROD | `RunLocalTests` | Validate against production |

---

### Step 1: Pre-Flight Checks

1. **Fetch story from Jira** using `getJiraIssue` with the story key and **Cloud ID** from config
2. **Determine the release version**:
   - Read `fixVersions` from the Jira story
   - Fallback: derive from current branch name (`release/<version>` → `<version>`)
3. **Verify branch state** — confirm the correct branch exists and is checked out:
   - `INT`: `feature/<story-key>` must exist
   - `UAT`: `release/<version>` must exist; feature branch must be merged (check if PR is completed)
   - `PROD`: `master` must be the target; release branch must be merged
4. **Check for the Manual Deployment Steps file** at `deployment/<version>/Release-<version>-Manual-Deployment-Steps.md` — if it exists and contains a section for this story, display the steps as a reminder to the user

### Step 2: Identify & Validate Deployment Artifacts

1. **Identify all files** related to this story:
   - Search for the story key in `@see` tags and comments across Apex classes
   - Search for related metadata (Custom Metadata, custom fields, flows, validation rules, LWC, triggers, permission sets)
   - Check `implementation-design/<story-key>/implementation-notes.md` for expected scope
   - If implementation notes exist, cross-reference identified files against expected components — warn if anything appears missing

2. **Run PMD check** on all identified Apex classes (not test classes) using the **PMD rules file** from config:
   ```bash
   pmd check -d <comma-separated-class-files> -R <pmd-rules-file> -f text
   ```
   - **Stop and fix** Priority 1 or Priority 2 violations before proceeding
   - Warn about Priority 3+ violations but allow continuation

3. **Run Apex tests locally** against the DEV org (alias from config):
   ```bash
   sf apex run test --class-names <TestClass1> <TestClass2> --result-format human --code-coverage --synchronous --wait 10 -o <DEV-alias-from-config>
   ```
   - Present code coverage results in a table
   - If tests fail, stop and fix before proceeding

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

The promotion strategy depends on the target environment:

#### INT (Feature → Integration)
1. Ensure all changes on `feature/<story-key>` are committed
2. Push the feature branch:
   ```bash
   git push origin feature/<story-key>
   ```
3. The pipeline automatically triggers the INT stage (PMD + delta deploy to INT)

#### UAT (Release → UAT2)
1. Ensure the feature branch is merged into `release/<version>` (via completed PR)
2. If not yet merged, inform the user that the PR must be completed first and abort
3. Checkout and push the release branch:
   ```bash
   git checkout release/<version>
   git pull origin release/<version>
   ```
4. Ensure the commit message contains the story key (pipeline extracts it via `CRM-XXXX` pattern):
   ```bash
   git add deployment/<story-key>
   git commit -m "<story-key> [skip ci]"
   git push origin release/<version>
   ```
   Note: Remove `[skip ci]` from the commit message to allow the pipeline to trigger, OR push the code change commit (without skip ci) separately
5. The pipeline automatically triggers: UAT2 stage (delta deploy + `RunLocalTests`) → DEV Sync stage

#### PROD (Master → Production)
1. Confirm with the user — this is a production deployment:
   - Ask: "This will validate against PRODUCTION. Are you sure?"
   - Option 1: "Yes, validate against PROD"
   - Option 2: "No, abort"
2. Ensure the release branch is merged into `master` (via completed PR)
3. If the versioned release package exists at `deployment/<version>/package/package.xml`, push it:
   ```bash
   git checkout master
   git pull origin master
   git push origin master
   ```
4. The pipeline triggers: Generate PROD Package → Deploy Validate (with `RunLocalTests`)

### Step 5: Monitor Pipeline

1. **Check pipeline status** via Azure DevOps REST API:
   ```bash
   az pipelines runs list --org https://dev.azure.com/LottoBW --project "Salesforce CICD" --branch <branch> --top 1 --output table
   ```
   If `az` CLI is not available, provide the user with a direct link to the pipeline run:
   ```
   https://dev.azure.com/LottoBW/Salesforce%20CICD/_build
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
- Use the Atlassian MCP tools for all Jira operations
- Read **Cloud ID** from `customer.config.md` — do not hardcode
- Commit messages for pipeline-triggering pushes must contain the story key (`CRM-XXXX`) — the pipeline extracts it
- When test classes are executed, always return the code coverage from the test run in a table
- ALWAYS comment on the related user story in Jira on successful deployment and validation
- ALWAYS create a log file named `<YYYY-MM-DD>-<story-key>-promote-us.txt` in `.claude/skills/03-promote-us/logs/` — copy the complete output as text into this file

## Error Handling
- If the Jira issue cannot be fetched, inform the user with the error details and abort
- If PMD is not available on the system, warn the user and skip the PMD step (do not fail the entire workflow)
- If local tests fail, stop before promoting — do not push broken code to trigger the pipeline
- If the target branch does not exist, inform the user and suggest creating it
- If the PR is not yet merged (for UAT/PROD), inform the user and abort — do not auto-merge
- If the pipeline fails, display the error details and suggest fixes
- If the `az` CLI is not available, skip pipeline monitoring and provide the manual link instead
- If the org alias is not recognized, list available orgs using `sf org list` and ask the user to pick one
