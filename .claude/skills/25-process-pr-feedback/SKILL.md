---
name: process-pr-feedback
description: Fetch a pull request from the customer's VCS provider (Azure DevOps, GitHub, Bitbucket DC), enumerate every review remark on it (inline threads, general comments, change requests), and produce a per-remark remediation plan anchored to file and line, with stale-remark detection and reply drafts; writes the plan locally, never modifies code or posts to the PR
argument-hint: <pr-id-or-url> [--include-resolved]
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

## Purpose

Inverse of `/review-pr`. Where that skill produces feedback, this one **consumes** the feedback already on a PR and turns it into a concrete, file-and-line-anchored plan an engineer (or `/implement-us`) can act on. For every reviewer remark the plan answers: what is asked, where it applies in the current code (with stale-comment detection), how to resolve it, why (citing an existing rule when one applies), effort and risk, and a reply draft.

The plan is a local Markdown file. Nothing is changed in the code and nothing is posted to the PR.

## Configuration

Read before running:

- `pipeline/customer.config.md` — `Platform`, `Short Name`, `Documentation Language`, `## Folder Paths > Code Review`, `## Repository & CI/CD` (`Azure DevOps URL` / `GitHub Repo` / `Bitbucket URL`, feature branch pattern, `Project Key`)
- `pipeline/stack.config.md` — naming conventions, code quality and testing standards, source path (tells which fix patterns are idiomatic)
- `pipeline/customer.domain.md` — business rules and field-name pitfalls (a remark may object to a domain-incorrect field)

## Argument parsing

| Form | Example | Action |
|---|---|---|
| Bare numeric ID | `124` | provider and repository from config |
| Azure DevOps URL | `https://dev.azure.com/<org>/<project>/_git/<repo>/pullrequest/<id>` | parse org, project, repo, id |
| GitHub URL | `https://github.com/<owner>/<repo>/pull/<id>` | parse owner, repo, id |
| Bitbucket DC URL | `https://<host>/projects/<key>/repos/<slug>/pull-requests/<id>` | parse key, slug, id |

`--include-resolved` also plans remarks the provider marks resolved, fixed, closed, won't fix, by design or outdated. Default: open remarks only.

## VCS provider detection

First key present in `customer.config.md > ## Repository & CI/CD` wins: `Azure DevOps URL` → Azure DevOps (`az`, always with `--org <organisation URL>` derived from the config URL, never the CLI default); `GitHub Repo` / `GitHub URL` → GitHub (`gh`); `Bitbucket URL` → Bitbucket DC (only if Bitbucket MCP tools are registered, else abort with a note). None present → abort and ask for the key.

## Workflow

### Step 1: Resolve the PR

**Azure DevOps**

```bash
az repos pr show --id <id> --org <org-url> --query "{title:title,description:description,status:status,src:sourceRefName,tgt:targetRefName,createdBy:createdBy.displayName,lastMergeSourceCommit:lastMergeSourceCommit.commitId,repoId:repository.id,projectId:repository.project.id,reviewers:reviewers[].{name:displayName,vote:vote}}" -o json
az repos pr list-commits --id <id> --org <org-url> -o json   # for stale-remark detection
az devops invoke --org <org-url> --area git --resource pullRequestThreads \
  --route-parameters project=<projectId> repositoryId=<repoId> pullRequestId=<id> --api-version 7.1 -o json   # threads: status, comments[].content, threadContext.filePath, rightFileStart.line
git fetch origin refs/pull/<id>/merge:refs/remotes/origin/pr/<id>   # diff: second parent = PR head, first parent = base
```

If `az account show` fails, tell the user to run `! az login` and stop: without the threads there is nothing to plan.

**GitHub**: `gh pr view <id> --json title,body,author,baseRefName,headRefName,state,url,reviews,comments,files,commits`, `gh pr diff <id>`, `gh api repos/<owner>/<repo>/pulls/<id>/comments` (inline), `gh api repos/<owner>/<repo>/issues/<id>/comments` (general), `gh api repos/<owner>/<repo>/pulls/<id>/reviews` (review bodies and states).

**Bitbucket DC**: the registered MCP tools for PR, diff, comments and commits.

Walk every page of a paginated comment list; never plan from page one only.

### Step 2: Normalise remarks

Flatten into one list; each entry: `id`, `author`, `created_at`, `status` (OPEN / RESOLVED / OUTDATED / UNKNOWN), `scope` (INLINE / GENERAL / REVIEW_BODY / CHANGE_REQUEST), `file`, `line`, `anchor_commit`, `text` (verbatim), `thread_id`, `parent_id`.

Provider quirks: Azure DevOps thread `status` values `active` and `pending` → OPEN; `fixed`, `wontFix`, `closed`, `byDesign` → RESOLVED; a thread without `threadContext` is GENERAL; threads whose first comment has `commentType` `system` are skipped. GitHub has three comment surfaces; merge them tagged by scope. Bitbucket comments come as a tree; flatten depth-first keeping `parent_id`.

Skip system and bot posts. Skip remarks by the PR author unless they ask reviewers a question. Skip resolved remarks unless `--include-resolved`. Group replies under their root: the plan addresses one **thread** per entry.

### Step 3: Stale-remark detection

For every inline remark with file and line:

1. If `anchor_commit` differs from the current head, mark `STALE_ANCHOR`.
2. Read the current file at that line from the PR head (`git show origin/pr/<id>^2:<path>`).
3. If the line content diverges materially from what the remark references, mark `Possibly addressed — verify` and turn the plan into a verification step.
4. If the file no longer exists, mark `FILE_REMOVED`.

### Step 4: Categorise each thread

| Kind | Trigger | Plan emphasis |
|---|---|---|
| **BLOCKER** | reviewer vote is "rejected" or "waiting for author" and the remark cites security or data loss | must be resolved before merge |
| **CHANGE_REQUEST** | "please change", "must", "rename to", vote "waiting for author" | concrete code change |
| **QUESTION** | "why", "is this intentional", trailing `?` | written reply, or a change if the answer reveals a gap |
| **SUGGESTION** | "consider", "could", "maybe", "what if" | optional change, LOW unless cumulative |
| **NIT** | `nit:` prefix, formatting, typo, naming polish | trivial cluster |
| **DISCUSSION** | back-and-forth without a clear ask | read the thread, propose a decision |
| **PRAISE** | "nice", "+1", "lgtm" | skip; count only |

With several replies, the kind follows the latest substantive comment.

### Step 5: Plan per thread

For every thread that is not PRAISE:

```markdown
#### Remark <N> — <Kind> — <file>:<line>   (or "general")

**Reviewer:** <author> · <date> · status: <OPEN|RESOLVED|STALE_ANCHOR|FILE_REMOVED>

**Quote:**
> <verbatim, long quotes trimmed with […]>

**Restated ask:** <one sentence>

**Current state:** <what the cited code does now, 1–2 sentences, verified in the file>

**Proposed resolution:** <file:line, what to add, remove or rename; inline snippet when under ~15 lines>


**Effort / risk:** <trivial | small | medium | large> · <isolated | cross-cutting>

**Reply draft:**
> <2–3 sentences in the Documentation Language, no AI attribution>
```

Special cases: a QUESTION whose answer reveals a missing safeguard gets both a reply and a change; a CHANGE_REQUEST that conflicts with a documented convention gets a polite push-back with the citation instead of a change; NIT threads across files collapse into one `NIT cluster` block with a `file:line` list and one cleanup commit; DISCUSSION threads get a summary plus a proposed decision to post back.

**Verify before planning:** every "current state" and "proposed resolution" is checked against the file on the PR head, not derived from the diff excerpt or the remark alone. Two remarks on the same underlying issue are merged into one block citing both reviewers.

### Step 6: Order

BLOCKER → CHANGE_REQUEST → QUESTION → SUGGESTION (effort ascending) → DISCUSSION → NIT cluster → PRAISE count. Within a section, by file path.

### Step 7: Write the plan

Documentation Language. Title `PR Feedback Plan — <Short Name> #<id> — <YYYY-MM-DD>`. Sections:

1. **PR Summary** — title, author, branches, story key from the branch name, state, commit count, head SHA used for stale detection, reviewer votes.
2. **Feedback Overview** — counts by kind and status, reviewer roster, blockers highlighted.
3. **Action Plan** — the ordered blocks.
4. **Stale Remarks** — `STALE_ANCHOR` / `FILE_REMOVED` items with a verification step each.
5. **No-Action Items** — praise count, skipped system posts, duplicates merged, each with a one-line reason.
6. **Suggested Commit Strategy** — plan items grouped into proposed commits, each referencing remark numbers; deployable source and non-deployable files in separate commits per the commit skill's rule. Omitted for merged or abandoned PRs.
7. **Open Questions for the User** — contradictory remarks, product-intent decisions, design questions.

Every block has a concrete resolution; when the ask is unclear, the resolution is "ask the reviewer" with a clarifying question as the reply draft, never an empty placeholder.

### Step 8: Save, log, summarise

Save to `<Code Review folder>/<YYYY-MM-DD>-pr<id>-feedback-plan.md` (folder from config, default `code-review/`; create if missing).

Create `<YYYY-MM-DD>-<customer-short-name>-pr<id>-process-pr-feedback.json` in `.claude/skills/25-process-pr-feedback/logs/` per the CLAUDE.md JSON schema; `summary` starts with the counts by kind and status. Status `success` when all threads were read; `partial` when pagination or a provider call failed for part of them; `failed` when no plan was written.

Print: plan path, counts by kind and status, the top action, number of stale or possibly addressed remarks, open questions.

## Important Rules

- Never modify source files; never post to the PR. Reply drafts stay in the plan.
- Always pass the organisation explicitly to `az`.
- Quote every remark verbatim.
- Cite only rules that exist in the configuration files; otherwise describe the practice in words.
- Never silently drop a remark; irrelevant ones are listed under No-Action Items with a reason.
- Prose in the Documentation Language, code in the source language, no AI attribution.

## Error Handling

- **PR not found**: ask for the correct id.
- **`az` or `gh` not installed**: abort with the install instruction. **`az` not logged in**: ask for `! az login` and stop.
- **Zero remarks**: write a minimal plan stating no actionable feedback, log `success`.
- **PR merged or abandoned**: still plan, flag the state, skip the commit strategy.
- **Remark references a file outside the diff**: include it, flagged `out-of-diff`.
- **Config has no VCS key**: abort with the instruction to add `Azure DevOps URL`, `GitHub Repo` or `Bitbucket URL`.
