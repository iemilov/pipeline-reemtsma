---
name: onboard-pipeline-user
description: Add a GitHub user as collaborator to the pipeline repo and the matching customer config repo so they can work with Claude skills
argument-hint: <github-username> <project-repo>
---

## Configuration

Before executing, read `pipeline/customer.config.md` for customer-specific values. Determine the active customer from the `pipeline/customer.config.md` symlink target (e.g., `customers/reemtsma/config.md` → customer name is `reemtsma`).

**Repositories and owner:** resolve from the checkout, never hardcode:
- pipeline repo: `git -C pipeline remote get-url origin` (e.g. `<owner>/pipeline-<customer>` or a shared `<owner>/pipeline`)
- customer config repo: `git -C pipeline/customers/<name> remote get-url origin`, expected pattern `<owner>/pipeline-<name>-config`
- `<owner>` is the account or organisation segment of those URLs (e.g. `iemilov`)
- the main project repo may live on GitHub or on the customer's VCS (`customer.config.md > Repository & CI/CD`); this skill only grants access to the two GitHub repos above.

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

2. **Validate the project uses the pipeline:** the main repository is expected to ignore a nested `pipeline/` folder (`.gitignore` contains `pipeline/`) and to be set up via `pipeline/setup.sh`. If the project is on GitHub, check `gh api repos/<owner>/<project-repo>/contents/.gitignore`; if it is on another VCS, check the local checkout. If no pipeline usage is found, inform the user and abort

3. **Determine customer config repo** by resolving the active customer:
   - Read the symlink target of `pipeline/customer.config.md` to extract the customer name (e.g., `customers/reemtsma/config.md` → `reemtsma`)
   - OR list `pipeline/customers/*/` directories that contain a `.git` directory and ask the user which one
   - The customer config repo name follows the pattern `pipeline-<name>-config` (e.g., `pipeline-reemtsma-config`)
   - Verify the repo exists:
     ```bash
     gh repo view <owner>/pipeline-<name>-config --json name
     ```
   - If no matching customer config repo is found, ask the user which customer to use

4. **Determine permission level** — ask the user using `AskUserQuestion`:
   - "Which permission level should the user get on the pipeline repos?"
   - Option 1: "push (read + write) — recommended for developers"
   - Option 2: "pull (read-only) — for reviewers or stakeholders"

### Step 2: Add Collaborator to Pipeline Repos

Add the user to **two repositories** in this order:

1. **Pipeline repo** (from the pipeline remote, e.g. `<owner>/pipeline-<customer-name>`) — skills, CLAUDE.md, workflow tooling
2. **Customer config repo** (`<owner>/pipeline-<customer-name>-config`) — customer-specific configuration (config.md, domain-knowledge.md, stack.config.md)

For each repo, add the collaborator:
```bash
gh api repos/<owner>/<repo>/collaborators/<github-username> -X PUT -f permission=<level>
```

- If the user is already a collaborator, note it and continue (do not error)
- If adding fails (e.g., insufficient permissions), report the error and continue with remaining repos

Present a summary after each addition:
```
Repo: <owner>/<repo>
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
- <owner>/<pipeline-repo>
- <owner>/pipeline-<customer-name>-config

## 2. Initialize Pipeline
Clone the main project repo (from the customer's VCS) if not done yet, then clone the pipeline into it:
cd <project-repo>
git clone https://github.com/<owner>/<pipeline-repo>.git pipeline

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
- The GitHub owner and repository names are resolved from the remotes of the checkout — never hardcoded
- Customer config repos follow the naming pattern `pipeline-<customer-folder-name>-config`
- Determine the active customer from the symlink target of `pipeline/customer.config.md` or by listing cloned directories in `pipeline/customers/`
- Always confirm the permission level with the user before adding collaborators
- **Pipeline first, then customer config** — always add to the pipeline repo before the customer config repo
- This skill does NOT add the user to the main project repo — that is managed separately
- ALWAYS create a log file named `<YYYY-MM-DD>-<customer-short-name>-<github-username>-onboard-pipeline-user.json` in `.claude/skills/14-onboard-pipeline-user/logs/` — use the structured JSON format from CLAUDE.md

## Error Handling

- **GitHub user not found**: Inform the user and abort — do not attempt to add a non-existent user
- **Project does not use the pipeline**: Inform the user and abort
- **Insufficient permissions**: If `gh api` returns a 403, inform the user that they need admin access to the repo
- **Invitation already pending**: Note it and continue — this is not an error
- **User already a collaborator**: Note it and continue — this is not an error
- **Customer config repo not found**: Warn the user that the new collaborator won't have access to customer config, but continue with the pipeline repo
