---
name: onboard-pipeline-user
description: Add a GitHub user as collaborator to the pipeline repo and the matching customer config repo so they can work with Claude skills
argument-hint: <github-username> <project-repo>
---

## Configuration

Before executing, read `pipeline/customer.config.md` for customer-specific values. Determine the active customer from the `pipeline/customer.config.md` symlink target (e.g., `customers/cloudrise/config.md` → customer name is `cloudrise`).

## Workflow: Onboard GitHub User to Pipeline

Add a GitHub user as collaborator to the **pipeline repo** and the matching **customer config repo**, so they can work with Claude skills on a customer project. The user is assumed to already have access to the main project repo.

**Usage:** `/onboard-pipeline-user <github-username> <project-repo>`

The `$ARGUMENTS` string contains the GitHub username and the main project repo name (space-separated). If either is missing, ask the user.

### Step 0: Parse Arguments

1. Split `$ARGUMENTS` into `<github-username>` and `<project-repo>`
2. If either value is missing, ask the user to provide it using `AskUserQuestion`

### Step 1: Validate Inputs

1. **Validate GitHub user exists:**
   ```bash
   gh api users/<github-username>
   ```
   - If the user does not exist, inform and abort

2. **Validate the project repo exists and has a pipeline submodule:**
   ```bash
   gh api repos/Lintlinger/<project-repo>/contents/.gitmodules
   ```
   - Parse the response to confirm a `pipeline` submodule pointing to `Lintlinger/pipeline.git`
   - If no pipeline submodule is found, inform the user that this project doesn't use the pipeline and abort

3. **Determine customer config repo** by resolving the active customer:
   - Read the symlink target of `pipeline/customer.config.md` to extract the customer name (e.g., `customers/cloudrise/config.md` → `cloudrise`)
   - OR list `pipeline/customers/*/` directories that contain a `.git` directory and ask the user which one
   - The customer config repo name follows the pattern `pipeline-<name>` (e.g., `pipeline-cloudrise`, `pipeline-lotto-bw`)
   - Verify the repo exists:
     ```bash
     gh repo view Lintlinger/pipeline-<name> --json name
     ```
   - If no matching customer config repo is found, ask the user which customer to use

4. **Determine permission level** — ask the user using `AskUserQuestion`:
   - "Which permission level should the user get on the pipeline repos?"
   - Option 1: "push (read + write) — recommended for developers"
   - Option 2: "pull (read-only) — for reviewers or stakeholders"

### Step 2: Add Collaborator to Pipeline Repos

Add the user to **two repositories** in this order:

1. **Central pipeline repo** (`Lintlinger/pipeline`) — skills, CLAUDE.md, workflow tooling
2. **Customer config repo** (`Lintlinger/pipeline-<customer-name>`) — customer-specific configuration (config.md, domain-knowledge.md, stack.config.md)

For each repo, add the collaborator:
```bash
gh api repos/Lintlinger/<repo>/collaborators/<github-username> -X PUT -f permission=<level>
```

- If the user is already a collaborator, note it and continue (do not error)
- If adding fails (e.g., insufficient permissions), report the error and continue with remaining repos

Present a summary after each addition:
```
Repo: Lintlinger/<repo>
Status: Invitation sent / Already a collaborator / Failed: <reason>
Permission: <level>
```

### Step 3: Generate Onboarding Instructions

Generate setup instructions that can be shared with the new collaborator. These assume the user already has access to the main project repo.

```markdown
# Pipeline Setup: <project-repo>

## 1. Accept GitHub Invitations
Check your email or https://github.com/notifications for repository access invitations.
You need to accept invitations for:
- Lintlinger/pipeline
- Lintlinger/pipeline-<customer-name>

## 2. Initialize Pipeline
If you have already cloned the main project repo:
cd <project-repo>
git submodule update --init pipeline

If not yet cloned:
git clone https://github.com/Lintlinger/<project-repo>.git
cd <project-repo>
git submodule update --init pipeline

## 3. Set Up Claude Code
cd pipeline
./setup.sh <customer-name>
cd ..

The setup script will automatically clone the customer config repo into `pipeline/customers/<customer-name>/`.

## 4. Verify Setup
You should now have:
- `CLAUDE.md` symlinked to `pipeline/CLAUDE.md`
- `.claude/skills/` symlinked to `pipeline/.claude/skills/`
- `.claude/commands/` symlinked to `pipeline/.claude/skills/`
- `pipeline/customer.config.md` pointing to `customers/<customer-name>/config.md`

## 5. Start Working
Open the project in your IDE and run Claude Code. All skills (`/commit`, `/implement-us`, etc.) should be available.
```

Save the instructions to: `pipeline/.claude/skills/14-onboard-pipeline-user/logs/<YYYY-MM-DD>-onboarding-<github-username>-<project-repo>.md`

### Step 4: Summary

Present a clear summary:
- Which repos the user was added to (with status for each)
- Permission level granted
- Path to the saved onboarding instructions
- Remind that the user needs to accept the GitHub invitations before `setup.sh` can clone the customer config repo

## Important Rules

- Follow all conventions from CLAUDE.md
- The GitHub org/user is `Lintlinger` — all repos live under this account
- The central pipeline repo is always `Lintlinger/pipeline`
- Customer config repos follow the naming pattern `pipeline-<customer-folder-name>`
- Determine the active customer from the symlink target of `pipeline/customer.config.md` or by listing cloned directories in `pipeline/customers/`
- Always confirm the permission level with the user before adding collaborators
- **Pipeline first, then customer config** — always add to the pipeline repo before the customer config repo
- This skill does NOT add the user to the main project repo — that is managed separately
- ALWAYS create a log file named `<YYYY-MM-DD>-<customer-short-name>-<github-username>-onboard-pipeline-user.json` in `.claude/skills/14-onboard-pipeline-user/logs/` — use the structured JSON format from CLAUDE.md

## Error Handling

- **GitHub user not found**: Inform the user and abort — do not attempt to add a non-existent user
- **Project repo has no pipeline submodule**: Inform the user that this project doesn't use the pipeline and abort
- **Insufficient permissions**: If `gh api` returns a 403, inform the user that they need admin access to the repo
- **Invitation already pending**: Note it and continue — this is not an error
- **User already a collaborator**: Note it and continue — this is not an error
- **Customer config repo not found**: Warn the user that the new collaborator won't have access to customer config, but continue with the pipeline repo
