---
name: deploy-us
description: Deploy all metadata related to a user story to a Salesforce org, run Apex tests, and run PMD checks
argument-hint: [story-key] [org-alias]
---

## Workflow: Deploy, Test & Validate

Deploy all implementation artifacts for Jira story **$ARGUMENTS[0]** to org **$ARGUMENTS[1]**:

### Step 1: Identify Story Context
1. Fetch the story details from Jira using `getJiraIssue` with key `$ARGUMENTS[0]`
2. Identify all files related to this story by:
   - Searching for the story key (e.g. `$ARGUMENTS[0]`) in `@see` tags and comments across Apex classes
   - Checking `git status` and `git diff` for uncommitted changes that may belong to this story
   - Searching for related Custom Metadata Types, custom fields, flows, validation rules, LWC, and other metadata created for this story
   - Looking at recently modified files that match the story's naming patterns
3. Present the list of identified files to the user and ask for confirmation before proceeding

### Step 2: PMD Check (Pre-Deploy)
1. Run PMD on all identified Apex classes (not test classes) using the project's `apex-rules.xml`:
   ```
   pmd check -d <comma-separated-class-files> -R apex-rules.xml -f text
   ```
   If `pmd` is not available, try alternative paths or inform the user to run it manually.
2. If PMD violations are found:
   - Display all violations grouped by file
   - **Stop and fix** any Priority 1 or Priority 2 violations before deploying
   - Warn about Priority 3+ violations but allow deployment to proceed

### Step 3: Deploy to Org
1. Build the deployment command with all identified source files:
   ```
   sf project deploy start --source-dir <file1> --source-dir <file2> ... -o $ARGUMENTS[1] --wait 10
   ```
2. Deploy metadata in the correct order (dependencies first):
   - **First:** Custom Objects, Custom Fields, Custom Metadata Types (schema)
   - **Second:** Custom Metadata records, Permission Sets, Sharing Rules
   - **Third:** Apex Classes, Triggers, Flows, Validation Rules, LWC
3. If deployment fails, analyze the error and suggest fixes
4. ALWAYS do a deploy validate against LottoPROD for the the deployment

### Step 4: Run Apex Tests
1. Identify all test classes related to the deployment:
   - Test classes with matching naming (e.g. `STLG_QNovaSubmissionBatchTest` for `STLG_QNovaSubmissionBatch`)
   - Search for `@see` references to the story key in test classes
2. Run the tests with code coverage:
   ```
   sf apex run test --class-names <TestClass1> <TestClass2> --result-format human --code-coverage --synchronous --wait 10 -o $ARGUMENTS[1]
   ```
3. Present results as a table:

   | Class | Coverage | Uncovered Lines |
   |-------|----------|-----------------|
   | ... | ...% | ... |

### Step 5: Summary Report
Present a deployment report:

| Step | Status | Details |
|------|--------|---------|
| PMD Check | Pass/Fail | Number of violations by priority |
| Deployment | Success/Failed | Components deployed count |
| Apex Tests | Pass/Fail | Pass rate, total tests |
| Code Coverage | ...% | Per-class breakdown |

If any step failed:
- Provide the specific error details
- Suggest concrete fixes
- Offer to re-run after fixes are applied

## Important Rules
- Follow all conventions from CLAUDE.md
- Always confirm the file list with the user before deploying
- Never deploy to production (`master` org) without explicit user confirmation
- Do NOT commit or push — this skill only deploys
- Use the Atlassian MCP tools for all Jira operations
- The cloudId for Jira is `2a9f60f6-99f9-4ab6-aedd-ea0fc09fe2d4`
- When test classes are executed, always return the code coverage from the test run in a table
- ALWAYS Comment on the related user story in jira on successful deployment and validation
- ALWAYS Create a package.xml, which contains all metadata files and store this package.xml under /deployment/<user story Id>
