---
name: review-pr
description: Fetch a single pull request from the customer's VCS provider (Azure DevOps, GitHub, Bitbucket DC) and review the diff against the customer's stack conventions, platform best practices and domain pitfalls; produces a severity-classified findings report with verified evidence and can post the summary as a PR comment
argument-hint: <pr-id-or-url> [--post-comment] [--base <branch>]
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

## Purpose

Reviews one pull request against:

1. **Stack conventions** — `pipeline/stack.config.md` (naming conventions, code quality standards, testing standards)
2. **Customer coding conventions** — `pipeline/coding-conventions.md`, if it contains rules
3. **Platform best practices** — `pipeline/platforms/<Platform>/best-practices.md`, if it contains rules
4. **Domain knowledge** — `pipeline/customer.domain.md` (field-name pitfalls, business rules)

Output: a Markdown findings report, severity-classified, every finding with `file:line`, description and fix, plus a list of candidate findings that were checked and rejected. Optionally the summary is posted as a PR comment after confirmation.

## Configuration

Read before running:

- `pipeline/customer.config.md` — `Platform`, `Short Name`, `Documentation Language`, `UI Language`, `## Folder Paths > Code Review`, `## Repository & CI/CD` (`Azure DevOps URL` / `GitHub Repo` / `Bitbucket URL`, branch patterns, `Project Key`), `## Atlassian` (Cloud ID, for reading the story)
- `pipeline/stack.config.md` — naming conventions, code quality standards, testing standards, test data factory, source path
- `pipeline/customer.domain.md` — business rules and field pitfalls
- `pipeline/coding-conventions.md` and `pipeline/platforms/<Platform>/best-practices.md` — read only if present and not empty skeletons; never cite section numbers that do not exist in these files

## Argument parsing

| Form | Example | Action |
|---|---|---|
| Bare numeric ID | `124` | Provider and repository from config |
| Azure DevOps URL | `https://dev.azure.com/<org>/<project>/_git/<repo>/pullrequest/<id>` | Parse org, project, repo, id |
| GitHub URL | `https://github.com/<owner>/<repo>/pull/<id>` | Parse owner, repo, id |
| Bitbucket DC URL | `https://<host>/projects/<key>/repos/<slug>/pull-requests/<id>` | Parse key, slug, id |

Flags: `--post-comment` posts the summary after the user confirms the preview (default off). `--base <branch>` overrides the base for the diff when the PR target differs from what the ref reports.

## VCS provider detection

First key present in `customer.config.md > ## Repository & CI/CD` wins:

| Key | Provider | Transport |
|---|---|---|
| `Azure DevOps URL` | Azure DevOps | `az repos pr`, `az devops invoke`; **always pass `--org <organisation URL>`** derived from the config URL, never rely on the CLI default (it is global per user and may point at another customer) |
| `GitHub Repo` / `GitHub URL` | GitHub | `gh pr view`, `gh pr diff`, `gh pr comment` |
| `Bitbucket URL` | Bitbucket DC | Bitbucket MCP tools if registered, else abort with a note |

None present: abort and ask for the key to be added.

## Workflow

### Step 1: Resolve the PR

**Azure DevOps**

```bash
az repos pr show --id <id> --org <org-url> --query "{title:title,description:description,status:status,src:sourceRefName,tgt:targetRefName,createdBy:createdBy.displayName,repoId:repository.id,projectId:repository.project.id,reviewers:reviewers[].{name:displayName,vote:vote}}" -o json
az devops invoke --org <org-url> --area git --resource pullRequestThreads --route-parameters project=<projectId> repositoryId=<repoId> pullRequestId=<id> --api-version 7.1 -o json   # existing comments
git fetch origin refs/pull/<id>/merge:refs/remotes/origin/pr/<id>
```

The merge ref's second parent is the PR head, its first parent the base. Diff with `git diff --stat <base>...<head>` and `git diff <base>...<head> -- <paths>`.

If `az` is not logged in (`az account show` fails): tell the user to run `! az login`, and continue with the diff from the merge ref alone, marking metadata, description, comments and votes as **not read** in the report and the log as `partial`.

**GitHub**: `gh pr view <id> --json title,body,author,baseRefName,headRefName,state,url,files,commits,labels,reviews`, `gh pr diff <id>`, `gh pr view <id> --comments`.

**Bitbucket DC**: use the registered MCP tools; if none, abort.

Read the story key from the source branch using the feature branch pattern in config and fetch the story with `getJiraIssue` (Cloud ID from config) for scope context. If Jira is unreachable, continue without it and say so.

### Step 2: Build the review checklist

From the configuration, in priority order:

1. **Stack conventions** (HIGH-bias): every rule in `stack.config.md > Naming Conventions`, `Code Quality Standards`, `Testing Standards` (coverage floor, test data factory, LWC test expectation, Prettier, ESLint).
2. **Customer conventions and platform best practices** (HIGH-bias): only rules that actually exist in those files. Skeleton files contribute nothing.
3. **Domain pitfalls** (MEDIUM-bias): from `customer.domain.md`.
4. **Platform baseline** (applied always, cited as general practice, no section numbers): bulkification and SOQL/DML in loops, sharing keyword present, CRUD/FLS on user-facing paths, no hard-coded IDs or thresholds that exist in configuration, no secrets, no `System.debug` of sensitive values, exception handling not swallowed, API version consistency, test assertions on outcomes rather than existence.
5. **Security baseline** (HIGH when triggered): injection via string-concatenated dynamic SOQL, sharing bypass on exposed classes, secrets in source, XSS in VF/LWC, unauthenticated inbound endpoints.
6. **UI language**: new user-facing labels, messages or validation texts must be in `UI Language`; admin-facing metadata labels follow the existing convention in the repo.

Customer conventions win over the general baseline where they conflict.

### Step 3: Walk the diff

Classify each file by path (Apex class/trigger/test, LWC, Aura, flow, permission set/profile, object/field/validation rule, custom metadata type and records, deployment package, documentation) and apply the relevant subset. Cite `file:line` from the branch, not from the diff hunk offset. **Group recurring patterns** into one finding with a count.

Targeted greps over the changed Apex (non-test):

| Pattern | Likely issue |
|---|---|
| `[SELECT` or DML inside a `for` loop, or in a method called per record | SOQL/DML in loop |
| `Database.query(` with `+` | injection |
| `getInstance(` with a literal developer name where several records exist per key | non-deterministic configuration lookup |
| `LIMIT 1` on a query that can match several configuration records | non-deterministic lookup |
| numeric literals that also exist as configuration values (thresholds, points, months) | duplicated configuration |
| `catch (Exception` followed by an empty block | swallowed exception |
| `System.debug(` with token/password/secret | logging hygiene |
| class without `with`/`without`/`inherited sharing` | sharing not declared |
| `@TestVisible` statics used as production switches | test-only override leaking into runtime |

For flows: check that record lookups filter on the same activation flags the Apex uses, that new decision elements have a default outcome, and that thresholds match the configuration. For custom metadata: check record values shipped with the PR (e.g. an activation flag defaulting to on or off) against the story's intent. For deployment packages: API version consistency, empty destructive changes, members not in the diff.

### Step 4: Severity classification

| Severity | Trigger |
|---|---|
| **HIGH** | Security risk; data loss or corruption; violates a MUST/NEVER rule in the stack or customer conventions; missing or wrong sharing on a class touching shared data; hard-coded secret |
| **MEDIUM** | Architectural concern; behaviour change beyond the story; non-deterministic configuration lookup; swallowed errors; missing FLS without rationale; missing or assertion-free test coverage for the changed path; bulkification gap |
| **LOW** | Naming or convention drift; dead code; noisy logging; package or version inconsistencies; unrelated files in the PR |

If a finding could go either way, take the lower severity and say why it might escalate.

### Step 5: Verify before reporting — mandatory

A finding is not a finding until checked against the branch. For every candidate:

| Claim shape | How to settle it |
|---|---|
| "X is missing" | `git show <head>:<path>` and read the whole file |
| "identifier too long / name wrong" | count or grep, do not eyeball |
| "convention violated" | `git grep` the convention across the repo; if the codebase does it the same way everywhere, it is not this PR's finding, at most a note |
| "rule applies here" (version-gated) | read the per-file API version |
| "configuration lookup ambiguous" | list the actual metadata records on the branch |
| "behaviour changed" | diff the specific method against the base branch and state old vs. new |
| platform semantics | cite documentation or query a sandbox, never answer from memory |

Keep a **checked and rejected** list with the evidence; it goes into the report.

### Step 6: Build the report

Documentation Language from config. Title `PR Review — <Short Name> #<id> — <YYYY-MM-DD>`. Sections:

1. **Summary** — PR link, branches, story key, merge/base commits reviewed, files changed by type, traffic light (green: no MEDIUM or HIGH; yellow: MEDIUM only; red: any HIGH), counts by severity, top 3 actions, and a note on what could not be read (metadata, comments, tooling).
2. **Critical Findings (HIGH)** — each with `file:line`, description, why it matters, concrete fix snippet.
3. **Important Findings (MEDIUM)** — same structure.
4. **Improvements (LOW)** — same, terser.
5. **Adherence to Conventions** — table of rules checked with ✅ / ⚠️ / n/a; name the source file of each rule; state which convention files were skeletons.
6. **Test Coverage Notes** — one row per changed non-test file: test in diff, what it asserts, gaps.
7. **Existing Comments** — prior reviewer remarks; do not duplicate, escalate if unaddressed; or "not read" with the reason.
8. **Recommendations** — prioritised, quick wins first.
9. **Checked and rejected** — table of candidate findings with the evidence that dismissed them.

Every finding: severity, `file:line`, description, fix. No bare opinions.

### Step 7: Save

Path from `customer.config.md > Folder Paths > Code Review` (default `code-review/`): `<folder>/<YYYY-MM-DD>-pr<id>-review.md`. Create the folder if missing.

### Step 8: Optional PR comment (`--post-comment`)

Build a short summary: traffic light, counts, each MEDIUM and HIGH in one or two sentences, LOW as bullets, path of the full report. **No AI attribution, no internal paths other than the report path.** Show the preview and ask for confirmation. Then:

- **Azure DevOps**: write the thread JSON to the scratchpad and post:
  ```bash
  az devops invoke --org <org-url> --area git --resource pullRequestThreads \
    --route-parameters project=<projectId> repositoryId=<repoId> pullRequestId=<id> \
    --http-method POST --api-version 7.1 --in-file <thread.json> --query "{threadId:id,status:status}"
  ```
  with body `{"comments":[{"parentCommentId":0,"commentType":1,"content":"<markdown>"}],"status":1}`.
- **GitHub**: `gh pr comment <id> --body-file <file>`.
- **Bitbucket DC**: only if a comment-write MCP tool exists; otherwise say so and skip.

Report the thread or comment id.

### Step 9: Log and summary

Create `<YYYY-MM-DD>-<customer-short-name>-pr<id>-review-pr.json` in `.claude/skills/22-review-pr/logs/` per the CLAUDE.md JSON schema. Status `success` when metadata, diff and comments were all read; `partial` when any of them was not (say which in `summary`); `failed` when no report was written. Include in `output`: provider, commits reviewed, counts per severity, rejected candidates count, comment posted or not.

Print to the user: report path, counts by severity, top 3 actions, traffic light, what was not read, comment result.

## Important Rules

- Never post a comment without showing the preview and getting confirmation; the comment carries no AI attribution.
- Always pass the organisation explicitly to `az`; never depend on `az devops configure` defaults.
- Only cite convention rules that exist in the configuration files you read; describe general practice in words without invented section numbers.
- Group recurring patterns; skip findings in test files unless they hide a real bug or a security issue.
- Read-only towards the repository: the skill never edits code, never pushes, never changes PR state or votes.
- Report prose in the Documentation Language; code snippets in the source language.

## Error Handling

- **PR not found**: ask for the correct id, do not guess.
- **`az` not installed**: abort with the install instruction. **`az` not logged in**: continue from the merge ref, mark metadata as not read, log `partial`.
- **Merge ref cannot be fetched** (conflicts, PR abandoned): diff `origin/<source>` against `origin/<target>` instead and say so.
- **Diff over ~3,000 changed lines**: review `classes/`, `triggers/`, `flows/`, `permissionsets/`, `profiles/`, `objects/` in full, summarise the rest, and never accept an "X is missing" claim from a partial read.
- **Prettier or PMD not available locally**: mark formatting/static analysis as not verified rather than guessing.
- **Convention files empty**: say so in section 5 and review against the stack config and the general baseline only.
