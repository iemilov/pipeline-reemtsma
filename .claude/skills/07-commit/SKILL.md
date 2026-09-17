---
name: commit
description: Safely commit and push changes across the three repositories of a checkout (customer config repo, pipeline repo, main project repo) in the correct order, grouping changes into logical commits and enforcing the CI skip pattern, the deployable/non-deployable split, the no-AI-attribution policy and the sensitive-content check
argument-hint: [commit-message] [--no-push] [--repo config|pipeline|main]
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

## Repository model

A checkout consists of three independent git repositories. None is a submodule of another; the outer ones ignore the inner ones via `.gitignore`.

| # | Repository | Location | Remote | Visibility | Commit order |
|---|---|---|---|---|---|
| 1 | **Customer config** | `pipeline/customers/<customer>/` (symlink target of `pipeline/customer.config.md`) | GitHub `pipeline-<customer>-config` | internal | first |
| 2 | **Pipeline** | `pipeline/` | GitHub `pipeline-<customer>` or shared pipeline repo | internal | second |
| 3 | **Main project** | repository root | customer's VCS (from `customer.config.md > Repository & CI/CD`) | **customer can read** | last |

There is no pointer commit between them: committing the pipeline does not change the main repo, and committing the config does not change the pipeline.

## Configuration

Read `pipeline/customer.config.md`: `Short Name`, `Documentation Language` (language of all dialogue in this skill), `## Repository & CI/CD` (CI skip pattern, branch patterns, co-author and AI attribution policy, VCS URL), `## Git Strategy`. Read `pipeline/stack.config.md` for the **Source Path** (deployable metadata) and, if present, a `## Commit Message Constraints` section.

## Communication style

Team members with varying git experience use this skill. Dialogue is in the **Documentation Language** from config. Tone: clear and friendly; git terms get a short plain-language note in parentheses. Every approval goes through `AskUserQuestion` with a consequence in each option's description. The happy path is two interactions: select commits, confirm messages.

## Workflow

### Step 1: Discover, group and propose

**1a. Discover** changes in all three repositories. A repository is recognised by `[ -e <dir>/.git ]` (`-e`, not `-d`: `.git` can be a file in worktrees).

```bash
C=$(readlink pipeline/customer.config.md | sed 's|/config.md$||')     # e.g. customers/reemtsma
[ -e "pipeline/$C/.git" ] && { echo "=== config ($C) ==="; git -C "pipeline/$C" status --short; } || echo "config: not a git repository — see Error Handling"
echo "=== pipeline ==="; git -C pipeline status --short
echo "=== main ($(git branch --show-current)) ==="; git status --short
```

With `--repo <name>` only that repository is considered. If nothing has changed anywhere, say so and stop.

**1b. Group** the changed files into logical commits:

- **Repository boundaries** — files in different repositories are always separate commits.
- **Story references** — a story key in a path or content (`implementation-design/AP2-1583/`, `deployment/AP2-1583/`, class headers) groups its files and goes into the message.
- **Functional grouping** — one topic per commit (a skill, a document, a set of logs).
- **Deployable vs. non-deployable (main repo, critical)** — never mix files under the **Source Path** (e.g. `force-app/`) with anything else. Deployable source gets a commit **without** the CI skip pattern so the pipeline runs; everything else (documentation, `deployment/*`, implementation notes, meetings, scripts, config) gets its own commit **ending with the CI skip pattern**, because a pipeline run over a non-deployable tip commit fails with an empty delta.
- **Logs** — execution logs are one commit per repository.
- If `$ARGUMENTS` carries a message, use it for the largest commit; the others get generated messages.

**1c. Propose.** Print a numbered plan — repository, branch, message, files with count — then ask with `AskUserQuestion` (multiSelect) which commits to execute. First option is always "All commits". Keep at most four options: when more than three commits are proposed, merge the smallest into one option; the user can always answer with free text.

### Step 2: Confirm messages and push

Show the selected commits with their final messages and ask:

- "Yes, commit and push" — changes are saved and uploaded
- "Commit only, do not push" — saved locally; push later or run the skill again
- "Adjust messages" — one follow-up question per commit, original message as first option

`--no-push` preselects commit-only.

### Step 3: Validate silently, then execute

Run these checks without dialogue; interrupt only on a problem.

**Sensitive content (all repositories, strictest for main):** block on staged file names matching `.env*`, `credentials.*`, `*secret*`, `*token*`, `*.pem`, `*.key`, any auth-url or refresh-token file; and on content matching `xox[abpr]-`, `sk-[A-Za-z0-9]{20,}`, `AKIA[0-9A-Z]{16}`, `Bearer [A-Za-z0-9._-]{20,}`, `-----BEGIN .*PRIVATE KEY`, `password\s*=`, `sfdx-auth-url`, `5Aep8` (Salesforce refresh token prefix). Ask whether to exclude the files or abort; never offer "upload anyway" for the main repository.

**Main repository message rules:** the message must not contain AI or tool references (`claude`, `anthropic`, `copilot`, `codex`, `openai`, `gpt`, `llm`, `ai-generated`, `co-authored-by`, `generated by`), skill or pipeline references (`skill`, `slash command`, any `/<skill-name>`, `SKILL.md`, `CLAUDE.md`, `pipeline/`), or characters listed in the stack config's `## Commit Message Constraints`; without such a section, avoid shell metacharacters (`( ) $ ; & | < > ! * ? \` " '`) as a safe default because the CI echoes messages. Safe shapes: `AP2-1583 Add loyalty programme switch`, `Adding deployment file [skip ci]`. On a hit, propose a rephrased message as the first option.

**Co-author and attribution policy:** no `Co-Authored-By` trailers and no AI references in any repository, per `customer.config.md` and CLAUDE.md. If the environment injects an attribution trailer, strip it before committing.

**Execution order:** config → pipeline → main. Only repositories with selected commits are processed. In commit-only mode, skip every pull and push.

**Customer config repository**

```bash
git -C pipeline/<C> add <files>
git -C pipeline/<C> commit -m "<message>"
git -C pipeline/<C> pull --rebase origin main && git -C pipeline/<C> push origin main
```

Direct push to `main`; no CI skip pattern.

**Pipeline repository**

1. Detached HEAD check: `git -C pipeline symbolic-ref -q HEAD`; if detached, check out the branch from `customer.config.md > Submodule Branch` (default `main`) and fast-forward it to the detached commit; if that fails, stop and report.
2. `git -C pipeline add <files> && git -C pipeline commit -m "<message>" && git -C pipeline pull --rebase origin <branch> && git -C pipeline push origin <branch>`

If the pipeline push fails, still continue with the main repository — the two are independent — but say so.

**Main repository**

1. `git add <files>` for the deployable group, commit without the skip pattern; then the non-deployable group, commit with the skip pattern.
2. **Branch guard:** if the current branch matches the production or release pattern from config and the Git Strategy is `feature-branch`, block the push: changes to those branches go through a pull request. Show the command to open one (`az repos pr create ...` for Azure DevOps, `gh pr create` for GitHub) and stop after committing.
3. **Push order with mixed commits:** the CI evaluates the skip pattern on the tip of each push. Push the deployable commit alone first (`git push origin <sha-of-deployable>:refs/heads/<branch>`), then the skip-pattern commits with a normal `git push`. Never let a skip-pattern commit be the tip of a push that also carries deployable source.
4. If the push is rejected because the remote is ahead: `git pull --rebase origin <branch>` once, then retry once. On conflicts, list the files and stop.

### Step 4: Summary

`git log -1 --oneline` per committed repository, then a short list: repository, branch, message, short SHA, pushed or local only. Only repositories that were committed appear.

## Important Rules

- Order: customer config, pipeline, main — always.
- No pointer commits: the main repository ignores `pipeline/`, the pipeline ignores `customers/*/`. Never `git add pipeline` in the main repository.
- CI skip pattern on every main-repository commit that contains no deployable source; never on commits that do. When a commit would mix both, split it; when unsure whether a file is deployable, ask.
- No AI attribution and no `Co-Authored-By` in any repository.
- Never create empty commits; never commit files the user did not select.
- All dialogue in the Documentation Language from config.

## Error Handling

| Situation | Action |
|---|---|
| No changes anywhere | Say so and stop |
| Customer config folder is not a git repository | Stop for that repository and explain: the folder must be a clone of `pipeline-<customer>-config`; offer `git -C pipeline/<C> init` plus `gh repo create` or the clone command from `setup.sh`, and continue with the other repositories |
| Detached HEAD in pipeline | Recover as in Step 3; if it fails, report and skip the pipeline |
| Push rejected, remote ahead | Rebase once, retry once; then report |
| Merge or rebase conflict | List the conflicting files, leave the repository in the conflicted state for manual resolution, stop |
| Sensitive content | Block; exclude or abort |
| Forbidden message content | Block; propose a rephrased message |
| Protected branch | Commit locally, block the push, show the PR command |
| Auth or network failure | Report which repository failed; committed work stays local |
