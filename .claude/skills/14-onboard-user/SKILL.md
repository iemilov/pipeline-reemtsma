---
name: onboard-user
description: Add a GitHub user as collaborator to a customer project and all required repos so they can work with Claude skills from the central pipeline
argument-hint: <github-username> <project-repo>
---

## Configuration

Before executing, read `pipeline/customer.config.md` for customer-specific values and `pipeline/.gitmodules` for the customer submodule mapping.

## Workflow: Onboard GitHub User to Customer Project

Add a GitHub user as collaborator to all repositories required for working with Claude skills on a customer project: the main project repo, the central pipeline repo, and the customer-specific pipeline config repo.

**Usage:** `/onboard-user <github-username> <project-repo>`

The `$ARGUMENTS` string contains the GitHub username and the main project repo name (space-separated). If either is missing, ask the user.

### Step 0: Parse Arguments

1. Split `$ARGUMENTS` into `<github-username>` and `<project-repo>`
2. If either value is missing, ask the user to provide it using `AskUserQuestion`
3. `<project-repo>` is the **main project repo** name on GitHub (e.g., `CloudRise`, `Lotto`, `LottoCRM`) — NOT the pipeline customer config repo (like `pipeline-cloudrise`). The customer config repo is auto-derived from `.gitmodules`.

### Step 1: Validate Inputs

1. **Validate GitHub user exists:**
   ```bash
   gh api users/<github-username>
   ```
   - If the user does not exist, inform and abort

2. **Validate customer repo exists:**
   ```bash
   gh repo view Lintlinger/<project-repo> --json name
   ```
   - If the repo does not exist, list available repos and ask the user to pick one

3. **Determine customer folder name** by inspecting the customer repo's `.gitmodules` to find the pipeline submodule, then inspecting `pipeline/.gitmodules` to find the matching customer config submodule:
   ```bash
   gh api repos/Lintlinger/<project-repo>/contents/.gitmodules
   ```
   - Parse the pipeline submodule URL to confirm it points to `Lintlinger/pipeline.git`
   - Then read the local `pipeline/.gitmodules` to find which `customers/<name>` submodule corresponds to this customer
   - The customer config repo name follows the pattern `pipeline-<name>` (e.g., `pipeline-cloudrise`, `pipeline-lotto-bw`)
   - If no matching customer config submodule is found, ask the user which customer folder to use

4. **Determine permission level** — ask the user using `AskUserQuestion`:
   - "Which permission level should the user get?"
   - Option 1: "push (read + write) — recommended for developers"
   - Option 2: "pull (read-only) — for reviewers or stakeholders"
   - Option 3: "admin — full control including settings"

### Step 2: Add Collaborator to All Repos

The user needs access to **three repositories** to work with the full pipeline:

1. **Customer main repo** (`Lintlinger/<project-repo>`) — the project code
2. **Central pipeline repo** (`Lintlinger/pipeline`) — skills, CLAUDE.md, workflow tooling
3. **Customer config repo** (`Lintlinger/pipeline-<customer-name>`) — customer-specific configuration

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

Generate setup instructions that can be shared with the new collaborator. Output them clearly and also save to a file.

The instructions should include:

```markdown
# Project Setup: <project-repo>

## 1. Accept GitHub Invitations
Check your email or https://github.com/notifications for repository access invitations.
You need to accept invitations for:
- Lintlinger/<project-repo>
- Lintlinger/pipeline
- Lintlinger/pipeline-<customer-name>

## 2. Clone the Repository
git clone https://github.com/Lintlinger/<project-repo>.git
cd <project-repo>

## 3. Initialize Submodules
git submodule update --init --recursive

## 4. Set Up Claude Code Symlinks
cd pipeline
./setup.sh <customer-name>
cd ..

## 5. Verify Setup
You should now have:
- `CLAUDE.md` symlinked to `pipeline/CLAUDE.md`
- `.claude/skills/` symlinked to `pipeline/.claude/skills/`
- `.claude/commands/` symlinked to `pipeline/.claude/skills/`
- `pipeline/customer.config.md` pointing to `customers/<customer-name>/config.md`

## 6. Start Working
Open the project in your IDE and run Claude Code. All skills (`/commit`, `/implement-us`, etc.) should be available.
```

Save the instructions to: `pipeline/.claude/skills/14-onboard-user/logs/<YYYY-MM-DD>-onboarding-<github-username>-<project-repo>.md`

### Step 4: Summary

Present a clear summary:
- Which repos the user was added to (with status for each)
- Permission level granted
- Path to the saved onboarding instructions
- Remind that the user needs to accept the GitHub invitations before they can clone

## Important Rules

- Follow all conventions from CLAUDE.md
- The GitHub org/user is `Lintlinger` — all repos live under this account
- The central pipeline repo is always `Lintlinger/pipeline`
- Customer config repos follow the naming pattern `pipeline-<customer-folder-name>`
- Never hardcode customer names — always derive from `.gitmodules`
- Always confirm the permission level with the user before adding collaborators
- ALWAYS create a log file named `<YYYY-MM-DD>-<customer-short-name>-<github-username>-onboard-user.json` in `.claude/skills/14-onboard-user/logs/` — use the structured JSON format from CLAUDE.md

## Error Handling

- **GitHub user not found**: Inform the user and abort — do not attempt to add a non-existent user
- **Repository not found**: List available repos under `Lintlinger/` and ask the user to select
- **Insufficient permissions**: If `gh api` returns a 403, inform the user that they need admin access to the repo
- **Invitation already pending**: Note it and continue — this is not an error
- **User already a collaborator**: Note it and continue — this is not an error
- **Customer config repo not found**: Warn the user that the new collaborator won't have access to customer config, but continue with the other repos
