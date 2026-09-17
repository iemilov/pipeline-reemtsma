---
name: commit
description: Safely commit and push changes to all repositories (customer configs + pipeline + main) in the correct order, enforcing all project rules
argument-hint: [commit-message]
preferred-runtime: openai-codex
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`


> **Runtime hint:** This skill prefers `openai-codex` (git mechanics, message drafting from diffs). If the active `Agent Runtime` (from `customer.config.md`) differs after applying any `## Skill Runtime Overrides`, print the standardized warning from `pipeline/agent-runtime-access.md` §1a and proceed. Record `active_runtime`, `preferred_runtime`, and `runtime_match` in the execution log.

## Configuration

Before executing, read `pipeline/customer.config.md` for customer-specific values (CI skip pattern, co-author policy, submodule branch, branch patterns), and `pipeline/stack.config.md` for stack-specific values. For all git workflow mechanics — pull strategy, PR-required gates, branch role resolution — consult the **Git Strategy adapter** at `pipeline/git-access.md` (branches on `Git Strategy` in `customer.config.md > ## Repository & CI/CD`; defaults to `feature-branch` if missing).

## Communication Style

This skill is used by team members with varying levels of Git experience. All user-facing output MUST follow these rules:

- **Language:** German for ALL interactions (AskUserQuestion prompts, explanations, error messages, summaries)
- **Tone:** Friendly, clear, confident — like a helpful colleague, not a technical manual
- **Jargon:** Avoid Git terminology where possible. When Git terms are needed, add a brief plain-language note in parentheses
- **AskUserQuestion:** ALWAYS use `AskUserQuestion` for approvals — never just text questions. Each option must have a `description` that explains the consequence in plain language

## Workflow: Multi-Repo Commit & Push

Commit and push changes across the full repository tree (customer config repos + pipeline submodule + main project repo), enforcing all project conventions automatically.

**Usage:** `/commit [commit-message]`

---

### Step 1: Discover, Analyze & Propose Commits

**Goal:** Find all changes, group them into logical commits, and present a ready-to-go proposal — all in one step.

#### 1a. Discover all changes

Scan all repositories for changes:

```bash
# Customer config repos — print the repo path before its status so multi-repo
# output stays attributable
for d in pipeline/customers/*/; do
  [ -e "$d.git" ] || continue          # -e, NOT -d: see note below
  s=$(git -C "$d" status --short)
  [ -n "$s" ] && printf '=== %s ===\n%s\n' "$d" "$s"
done
# Pipeline submodule
git -C pipeline status --short
# Main repo
git status --short
```

> **Use `-e`, never `-d`, to detect a repo.** `.git` is only a *directory* in a standalone clone. In a submodule or a `git worktree` checkout it is a **file** containing a `gitdir:` pointer, so `[ -d "$d/.git" ]` is false and the repo is skipped **silently** — the skill then reports "Keine Änderungen gefunden" while real commits are pending. Since customer config repos are commonly wired in as submodules, and they are the repos this skill must commit *first*, that failure mode hides exactly the changes that matter most. `-e` matches both shapes.

**Never trust an empty discovery result on its own.** If the loop yields nothing but the active customer is known (resolve it from the `pipeline/customer.config.md` symlink target), check that one repo explicitly before reporting "no changes":

```bash
c=$(pipeline/bin/config --customer-dir)          # symlink target, else Short Name
[ -n "$c" ] && git -C "$c" status --short
```

If **no changes** exist anywhere, inform the user and stop:
```
Keine Änderungen gefunden — alle Bereiche sind auf dem neuesten Stand.
```

#### 1b. Analyze and group into logical commits

Analyze the changed files and group them into **logical commits**. Each commit should be a coherent unit of work. Consider:

- **Jira story references** in file paths or content (e.g., `implementation-design/CRM-3315/` → CRM-3315)
- **Functional grouping** (e.g., all LMS-related files together, all SAP files together, all test data logs together)
- **Repo boundaries** — files in different repos are always separate commits (customer config, pipeline, main)
- **Log files** — group execution logs into a single commit per repo
- **Deploy vs. non-deploy split (main repo, CRITICAL)** — NEVER mix deployable platform source (files under the **Source Path** from `stack.config.md`, e.g. `force-app/`) and non-deployable files (docs, `scripts/`, `deployment/*.md`, design notes, configs) in one commit. Always split them into two commits, even when they belong to the same story.
- **Pipeline pointer** — if the pipeline submodule has changes, the main repo gets a pointer update. If the main repo has no other changes, use `Update pipeline [skip ci]` as the message
- **Changelog guard (pipeline repo)** — the pipeline repo is a versioned product (see `CLAUDE.md > ## Versioning & Releases`). If a pipeline commit contains **substantive product changes** (skills, adapters, platform docs, `bin/` tools, config schemas) and `pipeline/CHANGELOG.md` has no matching bullet under `## [Unreleased]`, draft one and include `CHANGELOG.md` in the same commit — show the drafted entry as part of the proposal in Step 1c. Execution logs, typo fixes, and internal design notes (`implementation-design/`) need no entry.

**Commit message conventions:**
- Main repo: Must reference Jira ticket if applicable (e.g., `CRM-3315 Implementation Notes`). Never include AI/pipeline/skill references (see §Security below)
- **CI skip pattern (main repo, CRITICAL):** every commit that contains NO deployable platform source MUST end with the **CI skip pattern** from `customer.config.md` (e.g. `[skip ci]`) so the CI pipeline is not triggered at all — an empty delta fails the deploy stage (`NothingToDeploy`). Commits that contain deployable source never carry the pattern.
- Customer config / pipeline: Can use descriptive messages freely
- If `$ARGUMENTS` is provided as a commit message, use it for the primary commit (the one with the most substantive changes). Still split other unrelated changes into separate commits with auto-generated messages.

#### 1c. Present the proposal

Show the commit plan as a numbered list, then let the user **select which commits to execute** via `AskUserQuestion` with `multiSelect: true`:

**Text output format (before the question):**
```
Ich schlage folgende Commits vor:

① Kunden-Config: "LMS: Umsetzungsdoku und INDEX aktualisiert"
   → business/LMS/LMS-INDEX.md, business/LMS/Umsetzung/ (23 Dateien)

② Kunden-Config: "SAP: Offene Punkte aktualisiert"
   → business/SAP/Operativ/SAP-Offene-Punkte.md

③ Kunden-Config: "Execution Logs 12.06.2026"
   → logs/2026-06-12-* (6 Dateien)

④ Hauptprojekt (release/1.12.1): "CRM-3315 Implementation Notes [skip ci]"
   → implementation-design/CRM-3315/, pipeline
```

Then ask via `AskUserQuestion` (multiSelect):
- Question: "Welche Commits sollen ausgeführt werden?"
- One option per proposed commit, label = the commit message, description = repo + file count
- **Always include** an "Alle Commits" option as the first choice with description "Alle oben aufgelisteten Änderungen werden gesichert und hochgeladen"

> **Important:** Keep the number of options at 4 or fewer (AskUserQuestion limit). If there are more than 3 proposed commits, consolidate the smallest ones into one option or present "Alle Commits" plus the 3 most distinct groups. The user can always type "Other" to customize.

---

### Step 2: Confirm Commit Messages & Push Option

**Goal:** Let the user adjust the commit messages and decide whether to push.

After the user selects which commits to make, present the selected commits with their messages for final confirmation. Use `AskUserQuestion`:

- Question: "Commit-Nachrichten bestätigen — soll ich so committen?"
- Option 1: "Ja, committen und pushen" — description: "Änderungen werden gesichert und hochgeladen"
- Option 2: "Nur committen, nicht pushen" — description: "Änderungen werden lokal gesichert, aber noch nicht hochgeladen. Du kannst später manuell pushen oder `/commit` erneut ausführen"
- Option 3: "Messages anpassen" — description: "Du kannst die Nachrichten im nächsten Schritt ändern"

If the user chooses "Messages anpassen", ask for the new messages via `AskUserQuestion` — one question per commit that needs adjustment. Offer the original message as the first option plus one alternative. After adjustment, ask again whether to push or commit-only.

---

### Step 3: Execute Selected Commits

**Goal:** Commit (and optionally push) each selected repo in the correct order, with progress updates.

If the user chose **"Nur committen, nicht pushen"** in Step 2, skip all pull and push commands below — only stage and commit. The PR-required guard is also skipped in commit-only mode.

**Before executing, run these checks silently (no user interaction unless a problem is found):**

#### Silent Security Check (Main Repo Only)

1. **File name patterns** — warn if any of these are staged:
   - `.env`, `.env.*`, `credentials.*`, `*secret*`, `*token*`
   - Files inside `pipeline/.claude/` or `pipeline/.env`

2. **Content patterns** — scan modified files for:
   - API keys/tokens (`xox-`, `sk-`, `Bearer `, `AKIA`)
   - Hardcoded passwords (`password=`, `passwd=`, `secret=`)

3. **If issues found:** BLOCK and ask via `AskUserQuestion` — "Sensible Inhalte gefunden in: <files>. Ausschließen oder trotzdem hochladen?"

#### Silent Commit Message Validation (Main Repo Only)

The commit message for the main repo must NEVER contain:
- AI tool references: `claude`, `.claude`, `ai-project`, `anthropic`, `co-authored-by`, `generated by`, `codex`, `openai`, `gemini`, `opencode`, `co-pilot`, `copilot`, `gpt`, `llm`, `ai-generated`, `ai-assisted`
- Skill names: `skill`, `slash command`, `/commit`, `/implement`, `/promote`, `/create-story`, `/create-testdata`, `/cleanup-testdata`, `/design-us`, `/08-document`, `/document-us`, `/release-notes`, `/architecture-overview`, `/create-business-manual`, `/code-review`, `/build-knowledge`, `/write-crm-doc`, `/onboard-pipeline-user`, `/create-customer`
- Internal tooling terms: `commands symlink`, `skills directory`, `submodule`, `pipeline setup`, `SKILL.md`, `CLAUDE.md`
- File references inside `pipeline/`
- Skill identifiers from folder names: `01-create-us`, `03-implement-us`, etc.
- **Characters that break the customer's CI (customer-specific):** if the active customer's `stack.config.md` defines a **Commit Message Constraints** section, enforce it verbatim. It lists characters that fail the customer's pipeline when the CI echoes the commit message through a shell. Typical example — a customer whose Azure pipeline runs `echo <message>` **unquoted** forbids parentheses `(` `)` and other shell metacharacters (`` ` `` `$ ; & | < > ! * ?`, quotes), because those tokens raise `syntax error near unexpected token '('` and fail the run before deployment. When no such section exists, still prefer messages free of shell metacharacters as a safe default.

**If a forbidden pattern is detected:** BLOCK and ask for an alternative message via `AskUserQuestion`. For character-constraint hits, offer a rephrased message that drops the offending characters (e.g. replace `... Logging (X + Y)` with `... Logging via X und Y`) as the first option.

**Safe message patterns** for the main repo:
- Jira ticket references: `CRM-1234 description of change`
- Neutral descriptions: `Adding deployment file`, `Update configuration`, `Fix validation rule`
- Pipeline-pointer-only commits: Always use `Update pipeline [skip ci]`
- Stick to letters/digits, spaces, and `- : , . / + =`; rephrase rather than using parentheses or other shell metacharacters

#### Execution Order

**Order matters:** Customer config repos FIRST, then pipeline, then main repo. Only process repos that have selected commits.

##### Customer Config Repos (`pipeline/customers/<name>/`)

```bash
git -C pipeline/customers/<name> add <files>
git -C pipeline/customers/<name> commit -m "<message>"
# Pull command resolved per git-access.md §3
git -C pipeline/customers/<name> pull --rebase origin main
git -C pipeline/customers/<name> push origin main
```
- Push directly to `main` (standalone clones, not subject to PR gates)
- Do NOT append CI skip pattern
- Follow the **co-author policy** from config

##### Pipeline Submodule (`pipeline/`)

1. **Check HEAD state** — if detached HEAD, recover:
   ```bash
   git -C pipeline symbolic-ref HEAD 2>/dev/null
   # If detached: checkout tracked branch and merge
   ```
   If recovery fails: "Die interne Konfiguration ist in einem unerwarteten Zustand (detached HEAD). Bitte informiere Benjamin."

2. **Stage, commit, pull, push:**
   ```bash
   git -C pipeline add <files>
   git -C pipeline commit -m "<message>"
   git -C pipeline pull --rebase origin <submodule-branch-from-config>
   git -C pipeline push origin <submodule-branch-from-config>
   ```

##### Main Project Repo

1. **Stage pipeline pointer** if pipeline was committed:
   ```bash
   git add pipeline
   ```

2. **Stage and commit:**
   ```bash
   git add <files>
   git commit -m "<message>"
   ```
   - Follow the **co-author policy** from config

3. **PR-required guard** — consult `pipeline/git-access.md` §4:
   - Determine branch role from `Branch Pattern: *` rows
   - Call `is-pr-required(source-role, target-role)` per adapter §4A
   - **If true**: BLOCK the push. Show: "Auf diesem Branch (`<branch>`) muss die Änderung über einen Pull Request gehen." Show the open-PR command from adapter §4C.
   - **If false/n/a**: push.

4. **Push:**
   ```bash
   git push origin <current-branch>
   ```
   - If push fails (remote ahead), auto-pull with rebase and retry once
   - **Push order with mixed commits:** the CI evaluates the skip pattern and builds its delta from the **tip commit of a push**. When both a deployable commit and skip-pattern commits exist, push the deployable commit **on its own first** (as the tip of its own push), then push the skip-pattern commits in a second push. Never let a skip-pattern commit sit on top of an unpushed deployable commit in the same push — the whole push would be skipped.

---

### Step 4: Summary

**Goal:** Confirm everything worked — short and clean.

Run `git log -1 --oneline` on each committed repo and present:

**If pushed:**
```
Erledigt!

① Kunden-Config: "LMS: Umsetzungsdoku und INDEX aktualisiert" (4de5562) ✓ gepusht
② Kunden-Config: "SAP: Offene Punkte aktualisiert" (6e27190) ✓ gepusht
③ Hauptprojekt (release/1.12.1): "CRM-3315 Implementation Notes [skip ci]" (7d0569e) ✓ gepusht
```

**If commit-only:**
```
Erledigt — lokal gesichert, noch nicht hochgeladen!

① Kunden-Config: "LMS: Umsetzungsdoku und INDEX aktualisiert" (4de5562)
② Kunden-Config: "SAP: Offene Punkte aktualisiert" (6e27190)
③ Hauptprojekt (release/1.12.1): "CRM-3315 Implementation Notes [skip ci]" (7d0569e)

Zum Hochladen: `/commit` erneut ausführen oder manuell pushen.
```

Only show repos that were actually committed.

---

## Important Rules

- Follow all conventions from CLAUDE.md
- Read all CI/CD and policy values from `customer.config.md` — do not hardcode
- **Order matters**: ALWAYS commit customer config repos FIRST, then pipeline, then main repo
- **Customer configs are independent**: Committing them does NOT affect the pipeline repo's git state
- **Pipeline pointer**: Stage via `git add pipeline` in the main repo when the pipeline submodule was committed
- **CI skip pattern**: For main repo commits, decide based on content. **Default to `[skip ci]`** — only omit it when the commit contains Salesforce metadata that requires deployment (Apex classes, LWC, Flows, Objects, Validation Rules, Permission Sets, etc.). Scripts, Markdown, Implementation Notes, logs, config, and documentation are NOT code and always get `[skip ci]`. Present the decision in the proposal (Step 1c). **When in doubt** (mixed content, unclear scope), ask the user via `AskUserQuestion` instead of guessing.
- **Co-author policy**: Follow the policy from config
- **Security + message validation**: Run silently before execution. Only interrupt the user if there's a problem.
- **Only process changed repos**: Skip repos with no changes — never create empty commits
- **Minimal interaction**: The entire happy path is 2 interactions: (1) select commits, (2) confirm messages. Do not add extra confirmation steps.

## Error Handling

All error messages MUST be in German, clear, and actionable. Never show raw Git error output.

| Situation | User-facing message |
|-----------|-------------------|
| No changes | "Keine Änderungen gefunden — alle Bereiche sind auf dem neuesten Stand." |
| Detached HEAD in pipeline | "Die interne Konfiguration ist in einem unerwarteten Zustand. Ich versuche das automatisch zu beheben..." (if auto-fix fails: "Bitte informiere Benjamin — er kann das schnell beheben.") |
| Push rejected (remote ahead) | "Jemand anderes hat in der Zwischenzeit auch Änderungen gemacht. Ich versuche, beides zusammenzuführen..." (auto-rebase, then retry) |
| Merge/rebase conflict | "Es gibt widersprüchliche Änderungen in folgenden Dateien: <list>. Das muss manuell gelöst werden — bitte informiere Benjamin." |
| Sensitive content detected | "Achtung: Sensible Inhalte in: <list>. Diese sollten nicht ins Hauptprojekt." |
| Auth/permission failure | "Die Verbindung zum Server ist fehlgeschlagen. Bitte prüfe deine Internetverbindung und versuche es erneut." |
| Pipeline push fails | "Das Hochladen der internen Konfiguration ist fehlgeschlagen. Die Projekt-Dateien werden NICHT hochgeladen, bis das Problem gelöst ist." — Do NOT proceed to main repo |
| Customer config push fails | Report error. Does NOT block pipeline or main repo commits |
