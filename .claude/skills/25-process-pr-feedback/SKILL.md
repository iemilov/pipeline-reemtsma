---
name: process-pr-feedback
description: Fetch a specific pull request from the customer's VCS provider (Bitbucket DC, GitHub, Azure DevOps), enumerate every review remark on it (inline + general + change-request), and produce a per-remark action plan describing how to resolve each one
argument-hint: <pr-id-or-url> [--include-resolved] [--auto-switch | --no-auto-switch]
preferred-runtime: openai-codex
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`


> **Runtime hint & auto-switch:** This skill prefers `openai-codex` (per-remark code remediation plans). Before any user-visible work, resolve what to do about a runtime mismatch with the shared helper — do not re-derive the gate:
>
> ```bash
> pipeline/bin/runtime-autoswitch --skill process-pr-feedback [--auto-switch | --no-auto-switch]
> ```
>
> If the user passed `--auto-switch` or `--no-auto-switch` in `$ARGUMENTS`, forward it to the helper — a per-run flag overrides the customer-config `Auto-Switch Runtime` default (precedence: flag → config → off). Branch on the `decision=` line it prints:
> - **`switch`** — the customer opted into `Auto-Switch Runtime` and the preferred runtime is installed *and* authenticated (subscription reachable). Run the **read-only analysis** (enumerating remarks and producing the per-remark action plan) under the preferred runtime using the `dispatch=` command template (the §2a read-only recipe, run per its Background dispatch contract — detached, output to a log file, and the `pipeline/bin/review-progress` feed armed so the analysis's reasoning is visible in the session while it runs), then keep the PR fetch and Markdown write on the host runtime. Record the runtime that actually ran the analysis in the log.
> - **`warn`** — print the standardized warning from `pipeline/agent-runtime-access.md` §1a and proceed under the active runtime. This covers auto-switch off, the preferred CLI missing, or no usable credentials/subscription; the `reason=` line says which.
> - **`none`** — preferred runtime already active, or no preference resolved; print nothing.
>
> Always record `active_runtime`, `preferred_runtime`, and `runtime_match` in the execution log. See `pipeline/agent-runtime-access.md` §1a (auto-switch gate) and §2a (read-only dispatch).

## Purpose

Inverse of `/review-pr`. Where `/review-pr` produces feedback, this skill **consumes** existing feedback on a PR and turns it into a concrete, file-and-line-anchored remediation plan that an engineer (or `/implement-us`) can act on.

For every reviewer remark found on the PR, the output plan answers:

1. **What** the reviewer is asking for (one-sentence restatement)
2. **Where** in the current code it applies (file, line, function, with stale-comment detection)
3. **How** to resolve it — concrete change description, with code snippets where the change is small enough to inline
4. **Why** that approach (citing the relevant rule from `coding-conventions.md`, `platforms/<Platform>/best-practices.md`, or `customer.domain.md` when the remark touches a known rule)
5. **Effort + risk** classification (trivial / small / medium / large; isolated / cross-cutting)
6. **Reply draft** — short text the engineer can paste back as a comment to acknowledge the resolution

The plan is saved as a Markdown file. It does **not** modify code and does **not** post anything back to the PR.

## Configuration

Read these BEFORE running:

- `pipeline/customer.config.md` — VCS provider URLs, customer identity, **Platform**, **Documentation Language**, **Code Review** folder path
- `pipeline/stack.config.md` — tech stack, layering rules, naming conventions (informs which fix patterns are idiomatic)
- `pipeline/customer.domain.md` — business rules, field naming pitfalls (a remark may be objecting to a domain-incorrect field choice)
- `pipeline/coding-conventions.md` — customer-specific conventions (a remark often references a convention rule by name or implication)
- `pipeline/platforms/<Platform>/best-practices.md` — universal platform rules
- `pipeline/atlassian-access.md` — Bitbucket DC adapter (only when `Bitbucket URL` is set)

## Argument parsing

`$ARGUMENTS` may be:

| Form | Example | Action |
|---|---|---|
| Bare numeric ID | `3455` | Use config defaults for project + repo |
| Bitbucket DC URL | `https://bitbucket.acme.com/projects/ACME/repos/acme-crm/pull-requests/3455` | Parse `project_key`, `repo_slug`, `pr_id` from URL |
| GitHub URL | `https://github.com/<org>/<repo>/pull/123` | Parse `owner`, `repo`, `pr_id` |
| Azure DevOps URL | `https://dev.azure.com/<org>/<project>/_git/<repo>/pullrequest/<id>` | Parse `org`, `project`, `repo`, `pr_id` |

Optional flag `--include-resolved`: also process remarks the provider marks as `RESOLVED` / `OUTDATED` / `addressed`. Default off — only open / actionable remarks are planned.

Optional flags `--auto-switch` / `--no-auto-switch`: per-run override of the customer-config `Auto-Switch Runtime` setting for this skill. Strip them from `$ARGUMENTS` before PR-id parsing and forward them verbatim to `pipeline/bin/runtime-autoswitch` (see the **Runtime hint & auto-switch** block above). Default: use the customer-config value.

## VCS provider detection

Same precedence as `/review-pr` — inspect `customer.config.md` for the FIRST field present:

| Config field | Provider | Transport |
|---|---|---|
| `Bitbucket URL` | **Bitbucket DC** | `mcp__bitbucket__*` MCP tools — see `pipeline/atlassian-access.md §5` |
| `GitHub Repo` or `GitHub URL` | **GitHub** | `gh` CLI |
| `Azure DevOps URL` or `AzureDevOps URL` | **Azure DevOps** | `az repos pr` CLI (or customer-local MCP if registered) |

If none match: abort with a clear message asking the user to add the missing field to `customer.config.md`.

## Workflow

### Step 1: Resolve the PR

Same as `/review-pr §Step 1`. Fetch metadata, the diff, the commit list, and the comments.

**Bitbucket DC**
- `mcp__bitbucket__get_pull_request_by_id(pr_id, project_key, repo_slug)` — title, author, branches, state
- `mcp__bitbucket__get_pull_request_diff(project_key, repo_slug, pr_id)` — for context on what was changed
- `mcp__bitbucket__get_pull_request_comments(project_key, repo_slug, pr_id)` — **the primary input for this skill**
- `mcp__bitbucket__get_pull_request_commits(project_key, repo_slug, pr_id, limit=50)` — for stale-remark detection

**GitHub**
- `gh pr view <id> --json title,body,author,baseRefName,headRefName,state,url,reviews,comments,files,commits`
- `gh pr diff <id>`
- `gh api repos/<owner>/<repo>/pulls/<id>/comments` — inline review comments (line-anchored)
- `gh api repos/<owner>/<repo>/issues/<id>/comments` — general PR comments
- `gh api repos/<owner>/<repo>/pulls/<id>/reviews` — review summaries (CHANGES_REQUESTED, COMMENTED, APPROVED) and per-review bodies

**Azure DevOps**
- `az repos pr show --id <id>`
- `az repos pr list-commits --id <id>`
- Comments: `az devops invoke --area git --resource pullRequestThreads --route-parameters repositoryId=<repo> pullRequestId=<id> --org <org>` (returns thread + comment trees including `status`, `comments[].content`, `threadContext.filePath`, `rightFileStart.line`)

If the provider is **Bitbucket DC** and the MCP returns `Authentication failed`, follow `pipeline/atlassian-access.md §6`.

### Step 2: Normalize remarks into a flat list

Build an internal list where every entry has at minimum:

```
{
  id: "<provider remark id>",
  author: "<reviewer>",
  created_at: "<iso8601>",
  status: "OPEN | RESOLVED | OUTDATED | UNKNOWN",
  scope: "INLINE | GENERAL | REVIEW_BODY | CHANGE_REQUEST",
  file: "<path or null>",
  line: "<int or null>",
  anchor_commit: "<sha or null>",
  text: "<verbatim remark text>",
  thread_id: "<for replies>",
  parent_id: "<for nested replies; null for top-level>"
}
```

Provider-specific quirks:
- **Bitbucket DC** comments come as a tree; flatten depth-first but keep `parent_id` so nested replies stay grouped under their root remark.
- **GitHub** has THREE comment surfaces (PR-review inline, PR-review body, issue-style general); merge all three, tagged by `scope`.
- **Azure DevOps** threads have `status` (`active`, `fixed`, `wontFix`, `closed`, `pending`, `byDesign`); map to the normalized `status` above.

Skip system-generated remarks (build status posts, auto-merge bot messages). Skip remarks authored by the PR author themselves unless they explicitly ask a question of reviewers.

By default, skip remarks where `status` is `RESOLVED` / `OUTDATED` / `closed` / `fixed`. Include them only when `--include-resolved` is set.

Group nested replies under their root remark. The plan addresses one **thread** per entry (the root + the conversation), not each individual comment.

### Step 3: Stale-remark detection

For every inline remark with a `file` and `line`:

1. If `anchor_commit` is set and is **not** the current head commit, mark the remark as `STALE_ANCHOR` — the reviewer commented on a version of the file that has since changed.
2. Read the current file at the cited line (use the local clone if available; otherwise fetch via the provider API).
3. If the current line content has materially diverged from what the remark text references, surface this in the plan as `Possibly addressed — verify` and shift the plan toward "confirm the change resolves it" rather than "make the change".
4. If the file no longer exists at that path, mark as `FILE_REMOVED`; the plan becomes "verify removal aligns with the remark's intent".

### Step 4: Categorize each remark

Assign one **kind** per remark thread:

| Kind | Trigger phrasing | Plan emphasis |
|---|---|---|
| **CHANGE_REQUEST** | "please change", "must", "this needs to", "rename to", or `CHANGES_REQUESTED` review status | Concrete code change |
| **QUESTION** | "why?", "what about?", "is this intentional?", trailing `?` | Written reply OR a code change if the answer reveals a missing safeguard |
| **SUGGESTION** | "consider", "could", "maybe", "nit:" prefix, "what if" | Optional change — flag as LOW unless cumulative |
| **NIT** | explicit `nit:` / `nitpick:` prefix, formatting / typo / naming polish | Trivial cluster |
| **BLOCKER** | reviewer set "needs work" / "request changes" AND the comment cites a security / data-loss concern | Cannot merge until resolved |
| **PRAISE** | "nice", "+1", "lgtm", positive emoji-only | Skip — no plan needed; mention in summary count |
| **DISCUSSION** | back-and-forth thread with no clear ask | Plan = read the thread + decide the outcome |

When the thread has multiple replies, the **kind is determined by the latest substantive comment**, not the root.

### Step 5: Build a remediation plan per remark

For every remark thread that is not `PRAISE`, produce a plan block with this exact structure:

```markdown
#### Remark <N> — <Kind> — <file>:<line>  *(or "general" if no anchor)*

**Reviewer:** <author> · <iso-date> · status: <OPEN|RESOLVED|STALE_ANCHOR|FILE_REMOVED>

**Quote:**
> <verbatim remark text, trimmed; collapse very long quotes with `[…]` after the relevant phrase>

**Restated ask:** <one sentence — what the reviewer wants>

**Current state:** <what the cited code currently does, in 1-2 sentences>

**Proposed resolution:**
<concrete change — file:line, what to add/remove/rename, with a small code snippet inline if the change is < ~15 lines. For larger changes, describe the shape and point to the file>

**Rule reference:** <if the remark touches a documented rule, cite it: e.g. "coding-conventions.md §4.2 — TDGW layer", "platforms/Salesforce/best-practices.md §7.1". Omit if no rule applies.>

**Effort / risk:** <trivial | small | medium | large> · <isolated | cross-cutting>

**Reply draft:**
> <2-3 sentences the engineer can paste back as the resolution comment, in the Documentation Language>
```

Special handling:
- **QUESTION → answer with a code change** (e.g. "is this null-safe?" → "no; add the guard"): produce both a reply draft AND a proposed change.
- **CHANGE_REQUEST that conflicts with conventions**: state the conflict explicitly. Recommend pushing back with a citation rather than making the change. The reply draft should be a polite challenge with the rule reference.
- **NIT clusters** (e.g. 6 typo / formatting nits in different files): collapse into ONE plan block titled `Remark N–M — NIT cluster` with a bullet list of `file:line` items and a single "address all in one cleanup commit" plan.
- **DISCUSSION threads with no clear ask**: plan = "summarize the thread, propose a decision, post the decision back as a reply". Provide the proposed decision.

### Step 6: Group and order

Order the final plan by:

1. BLOCKER (any) — must-do before merge
2. CHANGE_REQUEST — open items requiring code
3. QUESTION — open items requiring a code change OR a written answer
4. SUGGESTION — optional improvements, ordered by effort ascending
5. DISCUSSION — needs a decision
6. NIT cluster — last, single block
7. PRAISE summary — count only

Within each section, order by **file path** so an engineer can work file-by-file.

If two remarks describe the same underlying issue (e.g. two reviewers both flagged the same SOQL-in-controller line), merge them into one plan block with both reviewers cited under `Reviewer`.

### Step 7: Build the plan document

Use the **Documentation Language** from `customer.config.md` for prose. Title:

```
PR Feedback Plan — <Customer Short Name> #<pr-id> — <YYYY-MM-DD>
```

Sections:

1. **PR Summary** — title, author, base/head branches, JIRA story key (parse from branch name), current PR state, commit count, last commit SHA used for stale-remark detection.
2. **Feedback Overview** — counts by Kind and by Status. Reviewer roster. Highlight any BLOCKERs.
3. **Action Plan** — the ordered remark blocks from §Step 5/6.
4. **Stale Remarks** — list of `STALE_ANCHOR` / `FILE_REMOVED` items that may already be addressed. For each: short note + verification step.
5. **No-Action Items** — PRAISE count + skipped system messages, one line.
6. **Suggested Commit Strategy** — group plan items into proposed commits (e.g. "Commit 1: address BLOCKER + CHANGE_REQUESTs in `classes/`; Commit 2: NIT cleanup; Commit 3: reply-only on questions"). Reference each remark by its number.
7. **Open Questions for the User** — anything ambiguous: remarks that contradict each other, remarks where the right resolution depends on product intent, remarks asking for a design decision.

Every plan block MUST have a concrete `Proposed resolution`. If you genuinely cannot tell what to do, the plan is "ask the reviewer for clarification" and the reply draft is a clarifying question — never an empty `TODO`.

### Step 8: Save locally

1. Read the **Code Review** folder path from `customer.config.md > Folder Paths` (same folder `/review-pr` writes to — keeps PR-related artifacts colocated).
2. Save to `<Code Review path>/<YYYY-MM-DD>-pr<id>-feedback-plan.md`. Create the directory if missing.
3. Surface the local file path to the user.

### Step 9: Log

- ALWAYS write the execution log with `pipeline/bin/log-skill` — never hand-author the JSON. Run:
  ```bash
  pipeline/bin/log-skill --skill process-pr-feedback --identifier pr<id> --status <success|partial|failed> \
    --preferred-runtime openai-codex \
    --summary "<1–2 sentence result>" \
    --artifact <path> \
    --output "<full run text>"
  ```
  It guarantees a schema-valid document and writes it to `pipeline/customers/<customer>/logs/<YYYY-MM-DD>-<customer-short-name>-pr<id>-process-pr-feedback.json` (customer, active runtime, and timestamp resolve from config automatically; pass `--artifact` once per created/modified file; the directory is created if needed).

### Step 10: Final summary to user

Print:
- Local plan file path
- Counts by Kind and by Status
- Top action (most urgent BLOCKER or first CHANGE_REQUEST)
- Number of stale / possibly-addressed remarks needing verification
- Open questions for the user (if any)

## Important Rules

- Follow all conventions from `pipeline/CLAUDE.md` — no AI attribution in any output. The plan file is local-only; no posting to the PR happens here.
- Use the Atlassian adapter for Bitbucket; never hardcode URLs or auth.
- For other providers, use the official CLI (`gh`, `az`) — do not invent direct REST calls.
- Do not modify any source files. This skill produces a plan only; resolving the remarks is a separate step (typically `/implement-us` or a manual edit by the engineer).
- Do not post replies to the PR. Reply drafts are inside the local plan; the engineer decides when and how to send them.
- Verbatim quote every remark — paraphrasing loses the reviewer's intent.
- When a remark cites a coding convention, cite the same convention back in the plan — do not invent rule numbers; if you cannot locate the cited rule, drop the section reference and describe it in plain language.
- Output prose in the **Documentation Language** from `customer.config.md`; code snippets stay in the source language.
- Never silently drop a remark. If you decide a remark is irrelevant (system bot, duplicate of another remark already planned, the author's own self-note), record it in §No-Action Items with a one-line reason.

## Error Handling

- **PR not found / 404**: re-prompt for the correct ID; do not guess.
- **Auth failure on the VCS provider**: follow the adapter's §6 once; if still failing, abort with the actionable env-var message.
- **PR has zero remarks**: write a minimal plan file stating "no actionable feedback found" with the PR summary section, log `status: success`, and tell the user the PR is review-clean. Do not invent remarks.
- **PR is merged or closed**: still produce the plan — the user may be back-porting fixes — but flag the PR state prominently in §PR Summary and skip §Suggested Commit Strategy.
- **Provider returns a paginated comment list**: walk all pages; never produce a partial plan from page 1 only.
- **A remark references a file outside the diff** (e.g. reviewer asked about adjacent code): include it in the plan but flag `out-of-diff` so the engineer knows the change exceeds the original PR scope.
- **`gh` or `az` CLI not installed for the resolved provider**: abort with the install instruction.
- **Customer config missing a VCS provider URL**: abort with the field-add instruction (same as `/review-pr`).
