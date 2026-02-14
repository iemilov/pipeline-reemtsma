---
name: release-notes
description: Generate release notes based on the last merge commit in master branch by resolving all referenced Jira stories
argument-hint: [version (optional)]
---

## Configuration

Before executing, read `pipeline/customer.config.md` for customer-specific values (Cloud ID, release notes language, date format), and `pipeline/stack.config.md` for Salesforce-specific values (functional domains with release notes section headers, deployment folder path).

## Workflow: Master Merge Commit → Release Notes

Generate release notes from the latest merge commit on the `master` branch. If a version is provided as **$ARGUMENTS**, use it as the release title; otherwise, detect the version from the latest deployment folder.

### Step 1: Identify the Last Merge Commit

1. Run `git log master --oneline -1` to get the last commit on master
2. If it is a merge commit (e.g. "Merged PR ..."), extract the full commit message including all referenced Jira story keys
3. If the last commit is a hotfix/skip-ci commit, walk back through `git log master --oneline -10` to find the most recent merge commit with Jira keys
4. Collect all unique Jira story keys from the merge commit message

### Step 2: Fetch Story Details from Jira

1. For each Jira story key found in Step 1, fetch full details using `getJiraIssue` with the **Cloud ID** from config
2. Extract for each story:
   - Key and Summary
   - Issue Type (Bug, Story, Task, etc.)
   - Status
   - Component
   - Priority
   - Parent/Epic link (if available)
3. Group stories by component using the **functional domains** from config, then by issue type

### Step 3: Determine Version

1. If `$ARGUMENTS` is provided, use it as the version
2. Otherwise, list all version directories in the **deployment folder** from config (exclude non-version folders like `CRM-*` and `Archive`), sort them by semantic version (use `sort -V` or equivalent to correctly order versions like 1.9.0 < 1.10.0 < 1.10.2), and pick the latest
3. Use this version as the release title

### Step 4: Generate Release Notes

Create a Markdown document in the **release notes language** from config, using the **date format** from config and the **release notes section headers** from the functional domains in config:

```markdown
# Release Notes – Version <version>

**Release Date:** <current date in configured format>
**Branch:** master
**Merge Commit:** <short hash> – <commit message first line>

---

## Summary

<2-3 sentence overview of what this release contains: number of stories, key themes, affected areas>

---

## Changes

### <Domain 1 Release Notes Header>

#### New Features / Enhancements
- **<KEY-XXXX>**: <Summary> *(Story/Task)*

#### Bug Fixes
- **<KEY-XXXX>**: <Summary> *(Bug)*

### <Domain 2 Release Notes Header>

#### New Features / Enhancements
- **<KEY-XXXX>**: <Summary> *(Story/Task)*

#### Bug Fixes
- **<KEY-XXXX>**: <Summary> *(Bug)*

---

## Story Details

### <KEY-XXXX>: <Summary>
- **Type:** Story | Bug | Task
- **Component:** <component>
- **Status:** <Jira status>
- **Description:** <Brief description from Jira, 1-2 sentences>

(repeat for each story)

---

## Deployment Information

- **Deployment Package:** deployment/<version>/
- **Package XML:** deployment/<version>/package/package.xml (if exists)
- **Destructive Changes:** deployment/<version>/destructiveChanges/destructiveChanges.xml (if exists)
```

### Step 5: Save Release Notes

1. Save the generated release notes to `deployment/<version>/RELEASE-NOTES.md`
2. If the deployment version folder does not exist, ask the user where to save

### Step 6: Summary

Present:
- The version number
- Total number of stories/bugs included
- Breakdown by component
- File path of the generated release notes

## Important Rules
- Follow all conventions from CLAUDE.md
- Output text in the release notes uses the **release notes language** from config
- Use the Atlassian MCP tools for all Jira operations
- Read **Cloud ID** from `customer.config.md` — do not hardcode
- If no Jira keys are found in the merge commit, inform the user and abort
- ALWAYS create a log file named `<YYYY-MM-DD>-<version>-release-notes.txt` in `.claude/skills/06-release-notes/logs/` — copy the complete output as text into this file
- If a story cannot be fetched from Jira (e.g. permissions), list it with just the key and note that details were unavailable

## Error Handling
- If no merge commit with Jira keys is found in the last 10 commits on master, inform the user and abort
- If a specific Jira story cannot be fetched (permissions, deleted), list it with just the key and note that details were unavailable
- If the deployment version folder does not exist, ask the user for the version or offer to create the folder
- If `git log master` fails (e.g., no master branch locally), suggest running `git fetch origin master` first
