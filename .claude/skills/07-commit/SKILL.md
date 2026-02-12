---
name: commit
description: Safely commit and push changes to both repositories (submodule + main) in the correct order, enforcing all project rules
argument-hint: [commit-message]
---

## Workflow: Two-Repo Commit & Push

Commit and push changes across the two-repo architecture (submodule `pipeline/` and main repo `Salesforce CICD`), enforcing all project conventions automatically.

**Usage:** `/commit <commit-message>`

The `$ARGUMENTS` string is the commit message. If empty, ask the user for a commit message.

### Step 1: Analyze Changes

1. Run `git status` in the **main repo** (project root) — note modified, staged, and untracked files
2. Run `git status` in the **submodule** (`pipeline/`) — note modified, staged, and untracked files
3. Categorize the changes:
   - **Submodule only**: Changes exclusively in `pipeline/`
   - **Main repo only**: Changes exclusively outside `pipeline/`
   - **Both**: Changes in both locations
4. If **no changes** exist in either repo, inform the user and abort:
   ```
   Keine Änderungen gefunden. Beide Repos sind clean.
   ```
5. Present a clear summary of all changes to the user:
   ```
   Änderungen erkannt:

   📁 Submodule (pipeline/):
     - modified: .claude/skills/07-commit/SKILL.md
     - new file: .claude/skills/07-commit/logs/...

   📁 Hauptrepo (Salesforce CICD):
     - modified: force-app/main/default/classes/MyClass.cls
     - new file: implementation-design/CRM-XXXX/...
   ```

### Step 2: Security Check (Main Repo Only)

Scan all modified/new files **in the main repo** (not the submodule) for sensitive content:

1. **File name patterns** — warn if any of these are staged for the main repo:
   - `.env`, `.env.*`
   - `credentials.*`, `*secret*`, `*token*`
   - Files inside `pipeline/.claude/` or `pipeline/.env`

2. **Content patterns** — scan modified files for:
   - API keys/tokens (strings matching `xox-`, `sk-`, `Bearer `, `AKIA`)
   - Hardcoded passwords (`password=`, `passwd=`, `secret=`)
   - Internal workflow references that should stay in the submodule

3. If sensitive content is detected:
   - **List the files and patterns found**
   - **Ask the user** whether to exclude these files or abort entirely
   - Do NOT proceed without explicit user confirmation

### Step 3: Commit & Push Submodule (if changes exist)

**This step runs FIRST — the submodule must always be committed before the main repo.**

1. **Check HEAD state** in `pipeline/`:
   ```bash
   cd pipeline && git symbolic-ref HEAD 2>/dev/null
   ```
   - If this fails (detached HEAD), recover:
     ```bash
     git checkout main
     git merge <detached-commit-hash>
     ```
   - Inform the user: `Detached HEAD im Submodule erkannt und automatisch behoben.`

2. **Present files to commit** and ask the user for confirmation using `AskUserQuestion`:
   - "Sollen diese Dateien im Submodule committed werden?"
   - Option 1: "Ja, alle Dateien committen"
   - Option 2: "Nein, ich möchte Dateien auswählen"
   - If the user wants to select files, ask which files to include

3. **Stage and commit**:
   ```bash
   cd pipeline
   git add <files>
   git commit -m "<commit-message>"
   ```
   - The commit message is `$ARGUMENTS` as provided by the user
   - Do NOT append `[skip ci]` to submodule commits (no CI pipeline on submodule)
   - Do NOT add `Co-Authored-By` lines

4. **Pull with rebase** (handle remote-ahead):
   ```bash
   git pull --rebase origin main
   ```
   - If conflicts occur, inform the user and abort (do not auto-resolve)

5. **Push**:
   ```bash
   git push origin main
   ```

### Step 4: Commit & Push Main Repo (if changes exist)

1. **Stage the submodule pointer** if Step 3 was executed:
   ```bash
   git add pipeline
   ```

2. **Present files to commit** and ask the user for confirmation using `AskUserQuestion`:
   - "Sollen diese Dateien im Hauptrepo committed werden?"
   - Option 1: "Ja, alle Dateien committen"
   - Option 2: "Nein, ich möchte Dateien auswählen"

3. **Prepare commit message**:
   - Use `$ARGUMENTS` as the base message
   - **Automatically append `[skip ci]`** if not already present in the message
   - Do NOT add `Co-Authored-By` lines
   - Example: `CRM-2992 Datenmodell angepasst [skip ci]`

4. **Stage and commit**:
   ```bash
   git add <files>
   git commit -m "<message> [skip ci]"
   ```

5. **Push**:
   ```bash
   git push origin <current-branch>
   ```
   - Detect the current branch name dynamically (`git branch --show-current`)
   - If push fails (remote ahead), pull with rebase first:
     ```bash
     git pull --rebase origin <branch>
     git push origin <branch>
     ```

### Step 5: Verification & Summary

1. Run `git status` on both repos to confirm clean state
2. Run `git log -1 --oneline` on both repos to show the new commits
3. Present a summary:

   ```
   ✅ Commit & Push abgeschlossen

   Submodule (pipeline/):
     Commit: abc1234 — <message>
     Push: origin/main ✅

   Hauptrepo (Salesforce CICD):
     Commit: def5678 — <message> [skip ci]
     Push: origin/<branch> ✅
   ```

4. If only one repo had changes, adjust the summary accordingly

## Important Rules

- Follow all conventions from CLAUDE.md
- **Order matters**: ALWAYS commit submodule FIRST, then main repo
- **`[skip ci]`**: ALWAYS append to main repo commits (auto-added if missing)
- **No `Co-Authored-By`**: NEVER add co-author attribution to any commit
- **No sensitive data in main repo**: Always run the security check before committing to the main repo
- **Interactive**: Always ask the user for confirmation before committing. Show exactly which files will be included
- **Submodule pointer**: When the submodule is updated, always stage `pipeline` in the main repo too
- **Detached HEAD recovery**: Automatically recover from detached HEAD in the submodule
- ALWAYS create a log file named `<YYYY-MM-DD>-commit.txt` in `.claude/skills/07-commit/logs/` — copy the complete output as text into this file

## Error Handling

- **No changes detected**: Inform the user and exit gracefully — do not create empty commits
- **Detached HEAD in submodule**: Auto-recover by checking out `main` and merging. If merge conflicts occur, inform the user and abort
- **Push rejected (non-fast-forward)**: Automatically attempt `git pull --rebase` once. If rebase conflicts occur, inform the user with details and abort
- **Merge conflicts**: Display the conflicting files and abort. Do NOT attempt to auto-resolve merge conflicts
- **Sensitive content detected**: List the files/patterns and ask the user how to proceed. Never auto-commit sensitive content
- **Submodule push fails**: Do NOT proceed to commit the main repo. The submodule must be pushed successfully before updating the main repo's submodule pointer
