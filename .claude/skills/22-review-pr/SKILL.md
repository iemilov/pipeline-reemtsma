---
name: review-pr
description: Fetch a specific pull request from the customer's VCS provider (Bitbucket DC, GitHub, Azure DevOps) and review the changes against the customer's coding conventions and the platform's best practices
argument-hint: <pr-id-or-url> [--post-comment] [--auto-switch | --no-auto-switch] [--no-second-opinion]
preferred-runtime: openai-codex
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`


> **Runtime hint & auto-switch:** This skill prefers `openai-codex` (diff review against conventions). Before any user-visible work, resolve what to do about a runtime mismatch with the shared helper — do not re-derive the gate:
>
> ```bash
> pipeline/bin/runtime-autoswitch --skill review-pr [--auto-switch | --no-auto-switch]
> ```
>
> If the user passed `--auto-switch` or `--no-auto-switch` in `$ARGUMENTS`, forward it to the helper — a per-run flag overrides the customer-config `Auto-Switch Runtime` default (precedence: flag → config → off). Branch on the `decision=` line it prints:
> - **`switch`** — the customer opted into `Auto-Switch Runtime` and the preferred runtime is installed *and* authenticated (subscription reachable). Run the **read-only diff review** (the analysis of the fetched diff against conventions/best-practices) under the preferred runtime using the `dispatch=` command template (the §2a read-only recipe), then keep the PR fetch and any comment-posting on the host runtime. Record the runtime that actually ran the analysis in the log.
> - **`warn`** — print the standardized warning from `pipeline/agent-runtime-access.md` §1a and proceed under the active runtime. This covers auto-switch off, the preferred CLI missing, or no usable credentials/subscription; the `reason=` line says which.
> - **`none`** — preferred runtime already active, or no preference resolved; print nothing.
>
> Always record `active_runtime`, `preferred_runtime`, and `runtime_match` in the execution log. See `pipeline/agent-runtime-access.md` §1a (auto-switch gate) and §2a (read-only dispatch).

## Purpose

Reviews a single pull request against:

1. **Platform best practices** — `pipeline/platforms/<Platform>/best-practices.md` (Platform read from `customer.config.md`)
2. **Customer coding conventions** — `pipeline/coding-conventions.md` (symlink to active customer's conventions)
3. **Customer domain knowledge** — `pipeline/customer.domain.md` (field-name pitfalls, business rules)

Outputs a structured Markdown findings report (severity-classified) and optionally posts a summary back as a PR comment.

When the customer configures an independent `Review Runtime` (see `pipeline/agent-runtime-access.md` §2a), the skill additionally runs a **read-only second-opinion review** under that runtime (Step 4a), displays its raw output to the user, and lets the user decide whether to merge, append, or discard it — the skill never auto-incorporates it.

## Configuration

Read these BEFORE running:

- `pipeline/customer.config.md` — VCS provider URLs, customer identity, **Platform**, locale (including **UI Language** — the language the end-user-facing UI is built in; flag any new UI strings, labels, button text, or error messages introduced by the diff that are not in this language as a finding), **Code Review** folder path
- `pipeline/stack.config.md` — tech stack, commands, libraries (informs which automated checks to run if a clone is available)
- `pipeline/customer.domain.md` — business rules, field naming pitfalls
- `pipeline/coding-conventions.md` — customer-specific conventions
- `pipeline/platforms/<Platform>/best-practices.md` — universal platform rules
- `pipeline/atlassian-access.md` — Bitbucket DC adapter (only relevant when `Bitbucket URL` is set)

## Argument parsing

`$ARGUMENTS` may be:

| Form | Example | Action |
|---|---|---|
| Bare numeric ID | `3455` | Use config defaults for project + repo (Bitbucket) or repo (GitHub/Azure) |
| Full PR URL | `https://bitbucket.acme.com/projects/ACME/repos/acme-crm/pull-requests/3455` | Parse `project_key`, `repo_slug`, `pr_id` from URL |
| GitHub URL | `https://github.com/<org>/<repo>/pull/123` | Parse `owner`, `repo`, `pr_id` |
| Azure DevOps URL | `https://dev.azure.com/<org>/<project>/_git/<repo>/pullrequest/<id>` | Parse `org`, `project`, `repo`, `pr_id` |

Optional flag `--post-comment`: when present and a comment-write op is available for the resolved provider, post the executive summary as a PR comment after the user confirms. Default off — the skill saves the review locally only.

Optional flags `--auto-switch` / `--no-auto-switch`: per-run override of the customer-config `Auto-Switch Runtime` setting for this skill. Strip them from `$ARGUMENTS` before PR-id parsing and forward them verbatim to `pipeline/bin/runtime-autoswitch` (see the **Runtime hint & auto-switch** block above). Default: use the customer-config value.

Optional flag `--no-second-opinion`: skip Step 4a (the independent read-only second-opinion review) for this run. Default: the step runs whenever the customer configures an independent `Review Runtime`.

## VCS provider detection

Inspect `customer.config.md` for the FIRST field present (in this priority order):

| Config field present | Provider | Transport |
|---|---|---|
| `Bitbucket URL` (e.g. `https://bitbucket.acme.com`) | **Bitbucket DC** | `mcp__bitbucket__*` MCP tools — see `pipeline/atlassian-access.md §5` |
| `GitHub Repo` or `GitHub URL` | **GitHub** | `gh` CLI (`gh pr view`, `gh pr diff`, `gh pr comment`) |
| `Azure DevOps URL` or `AzureDevOps URL` | **Azure DevOps** | `az repos pr` CLI (or a customer-local MCP if registered) |

If none match: abort with a clear message asking the user to add a `Bitbucket URL`, `GitHub Repo`, or `Azure DevOps URL` field to `customer.config.md`.

## Workflow

### Step 1: Resolve the PR

Based on detected provider:

**Bitbucket DC**
- If `$ARGUMENTS` is a URL, parse `project_key` + `repo_slug` + `pr_id` from the path.
- If `$ARGUMENTS` is bare numeric, look for `Default Bitbucket Project Key` + `Default Bitbucket Repo Slug` in `customer.config.md`. If neither is set, ask the user.
- Fetch metadata: `mcp__bitbucket__get_pull_request_by_id(pr_id=<id>, project_key=<k>, repo_slug=<r>)`
- Fetch diff: `mcp__bitbucket__get_pull_request_diff(project_key=<k>, repo_slug=<r>, pr_id=<id>)`
- Fetch existing comments (for context, to avoid duplicating prior review notes): `mcp__bitbucket__get_pull_request_comments(project_key=<k>, repo_slug=<r>, pr_id=<id>)`
- Fetch commits (to surface squash-vs-merge intent and authorship): `mcp__bitbucket__get_pull_request_commits(project_key=<k>, repo_slug=<r>, pr_id=<id>, limit=25)`

**GitHub**
- Use `gh pr view <id> --json title,body,author,baseRefName,headRefName,state,url,files,commits,labels`
- Use `gh pr diff <id>` to capture the unified diff
- Use `gh pr view <id> --comments` to capture inline + general comments

**Azure DevOps**
- Use `az repos pr show --id <id>` for metadata
- Use `az repos pr show --id <id> --output json` plus `az repos pr list-commits` and the diff endpoint via `az rest`
- If the customer ships a local MCP server for Azure DevOps, prefer it over `az` (mention this when documenting the customer)

If the provider is **Bitbucket DC** but the MCP tool returns `Authentication failed` or `Unauthorized`, follow `pipeline/atlassian-access.md §6` (refresh once, then ask the user to set `BITBUCKET_USERNAME`/`BITBUCKET_PASSWORD` and restart Claude Code if the refresh doesn't recover).

### Step 2: Build the review checklist

From the configs read in §Configuration, assemble a **prioritized checklist**:

1. **Platform best practices** (HIGH-bias) — every numbered rule in `pipeline/platforms/<Platform>/best-practices.md`. For Salesforce specifically: §7.1 (no inline SOQL/DML, TDGW + DI), §7.2 (interface stays SOQL/DML-free), §7.3 (`inherited sharing` default + `WithoutSharing` inner class), `with sharing` placement, security/FLS, governor limits, bulkification, test coverage rules.
2. **Customer conventions** (HIGH-bias) — every rule in `pipeline/coding-conventions.md`, especially naming conventions, layering rules, exception-handling policies, and any "MUST"/"NEVER" wording.
3. **Domain pitfalls** (MEDIUM-bias) — field naming traps and business rules from `pipeline/customer.domain.md` (e.g., custom field that looks generic but has a specific meaning).
4. **Code-quality baseline** (LOW-bias unless severe) — naming, dead code, unhandled errors, missing test coverage for changed Apex / TS.
5. **Security baseline** (HIGH severity when triggered) — OWASP-style: injection (SOQL string concat), authn/authz gaps, secrets in source, CORS, XSS, FLS bypass without justification.

When customer conventions and platform best-practices conflict, customer conventions win (per `pipeline/CLAUDE.md > Coding Standards`).

### Step 3: Walk the diff

For each file in the diff, classify by what it is from the path/extension:

- Apex class / trigger / test (Salesforce): file under `classes/`, `triggers/`
- LWC: bundle under `lwc/<name>/`
- Aura: under `aura/<name>/`
- Flow / Process Builder XML: `flows/`, `flowDefinitions/`
- Permissionset / Profile / Role / SharingRules: `permissionsets/`, `profiles/`, `sharingRules/`
- Object / Field / Validation Rule metadata: `objects/.../*.field-meta.xml`, `validationRules/`
- Custom Metadata Type record / CMT definition
- TS/JS source (Node/Cloudflare): `src/**/*.ts`, `functions/**/*.ts`
- SQL migration: `migrations/*.sql`
- Test file (any platform)

For each file, evaluate against the relevant subset of the checklist. Cite `file:line` from the diff hunks. **Group recurring patterns** (e.g. "5 controllers still use `new XxxImpl()` — §7.1") rather than 5 separate findings.

For Apex specifically, run these targeted greps over the diff (capture before commenting):

| Pattern | Likely violation |
|---|---|
| `\\bnew \\w+TdgwImpl\\(\\)` outside `Static\\w*DependencyContainer` / test files | §7.1 — bypassing the container |
| `\\[SELECT ` inside `classes/.*Controller\\.cls` or `classes/.*Service\\.cls` (non-test) | §7.1 — inline SOQL outside TDGW |
| `\\b(insert\\|update\\|upsert\\|delete\\|undelete\\|merge) ` in non-test, non-TDGW class | §7.1 — inline DML outside TDGW |
| `@SuppressWarnings\\('PMD.ApexCRUDViolation'\\)` newly added | Justify or remove |
| Missing `WITH USER_MODE` on user-context SOQL | FLS bypass risk |
| `Database.query\\(.*\\+.*\\)` (string-concat dynamic SOQL) | SOQL injection risk |
| `System.debug` left in production code | Remove or downgrade |
| `String\\.escapeSingleQuotes` absent on dynamic SOQL with non-whitelisted fragments | Defense-in-depth gap |
| `try { ... } catch (Exception ex) { }` (empty catch) | Swallowed exceptions |
| `with sharing` on a TDGW `*Impl` class (should be `inherited sharing`) | §7.3 |

For TS/JS:

| Pattern | Likely violation |
|---|---|
| `process.env.\\w+` referenced from a Worker handler (Cloudflare bindings live on `env`, not `process.env`) | Platform best practice |
| `as any` introduced in the diff | Type-safety regression |
| `console.log` in source (not tests) | Logging hygiene |
| Missing `await` on a function returning `Promise<...>` | Race / dropped error |
| Unbounded loops over D1 results without pagination | Worker CPU-time limit risk |

If a customer convention contradicts an item in the table above, defer to the convention.

### Step 4: Severity classification

Use this rubric — same for every finding:

| Severity | Trigger |
|---|---|
| **HIGH** | Security risk; data loss / corruption risk; violates a "MUST"/"NEVER" rule in conventions or §7.x; missing or wrong sharing on a class touching shared data; hardcoded secret. |
| **MEDIUM** | Architectural concern (layering, DI, separation of concerns); silently-swallowed errors; missing FLS check with no documented PSG-gated rationale; missing test coverage for the changed code path; bulkification gap. |
| **LOW** | Naming / convention drift; dead code or noisy logging; minor docstring or comment issues; duplicated logic that doesn't justify a refactor in this PR. |

If a finding could go either way, default to the lower severity and explain *why* it might escalate ("MEDIUM — would be HIGH if `<X>` were exposed publicly").

### Step 4a: Independent second-opinion review (read-only, user decides)

Run this step unless `--no-second-opinion` was passed.

1. **Resolve the reviewer runtime** via `pipeline/bin/review-runtime` (the `agent-runtime-access.md` §2a resolver — reads `customer.config.md > ## Agent Runtime > Review Runtime`; e.g. `openai-codex` → Codex). Skip this step with a one-line note when:
   - no independent reviewer resolves (reviewer equals the active runtime and no explicit `Review Runtime` row exists), or
   - the auto-switch gate (see the **Runtime hint & auto-switch** block) already ran the primary analysis under this same reviewer runtime — a second pass by the same model adds nothing.
   If `pipeline/bin/review-runtime --check` fails (reviewer CLI missing or unauthenticated), **warn** with the graceful-degradation message from §2a — never silently skip — and continue without the second opinion.
2. **Dispatch read-only in the background** per the §2a table and its **Background dispatch contract** — write the prompt to `review-prompt.txt` first, then e.g. for `openai-codex`:
   ```bash
   codex exec --sandbox read-only -c model_reasoning_summary=detailed -- "$(cat review-prompt.txt)" < /dev/null
   ```
   (The `-c` flag is the registry's `exec_flags`: `pipeline/bin/runtimes --dispatch-review openai-codex` prints the line with the customer's `Reasoning Summary` level resolved, and its summaries arrive on stderr — the `2>&1` of the §2a recipe is what makes the reviewer's thinking readable from the log while it runs.) Launch detached with output to a log file (under Claude Code: Bash `run_in_background: true`), arm the §2a progress feed (`pipeline/bin/review-progress review-out.log`, under Claude Code as a Monitor — each reasoning headline and command the reviewer runs then lands in the session while it works), and wait for the §2a exit marker — **never foreground with a fixed timeout**: thorough reviews legitimately exceed 10 minutes, and foreground shell calls are killed at the host's 10-minute cap while the reviewer is still working. While waiting, check liveness (log growth), not elapsed time; on a genuine hang apply the §2a recovery (`codex exec resume --last ...`).
   The prompt must be self-contained (the reviewer has no MCP access): PR metadata (title, branches, story key), the full unified diff from Step 1, and the review criteria — the Step 2 checklist essence from `coding-conventions.md`, `platforms/<Platform>/best-practices.md`, and the domain pitfalls. Instruct it explicitly: *report findings only — severity, `file:line`, description, suggested fix; do not modify any files; do not run write commands.* The read-only sandbox enforces this regardless.
3. **Display the output verbatim** to the user in a clearly marked block (`## Second Opinion — <reviewer runtime>`) — unedited, no pre-filtering, no merging yet.
4. **Ask the user how to proceed** — the user decides, never the skill:
   - **Merge** — fold the second-opinion findings into the Step 5 report, deduplicated against the host findings; tag each merged finding with its source runtime.
   - **Append** — keep the host report as-is and attach the second-opinion output verbatim as a final report section ("Second Opinion — <runtime>").
   - **Discard** — continue with the host findings only; note the discard in the log.
5. Record for Step 8: the reviewer runtime that ran, whether it produced output, and the user's decision (`merged` / `appended` / `discarded` / `skipped: <reason>`).

### Step 5: Build the review report

Use the **Documentation Language** from `customer.config.md` for prose. Title:

```
PR Review — <Customer Short Name> #<pr-id> — <YYYY-MM-DD>
```

Sections (Markdown):

1. **Summary** — PR title, author, base/head branches, JIRA story key (parse from branch name pattern in config), overall traffic-light assessment (green/yellow/red), counts by severity, top 3 actions.
2. **Critical Findings (HIGH)** — each: `file:line`, description, why it matters, **concrete fix snippet** (Apex/TS/etc.).
3. **Important Findings (MEDIUM)** — same structure as HIGH.
4. **Improvements (LOW)** — same structure, can be terser.
5. **Adherence to Conventions** — explicitly call out which numbered rules were checked and which were violated. Reference convention rule by section number where possible.
6. **Test Coverage Notes** — for each non-test file changed, state whether a corresponding test file is part of the diff. Flag gaps as MEDIUM unless trivial config.
7. **Existing Comments** — short note if the PR already has prior review comments; do not duplicate findings someone else already raised, but DO escalate severity if a previous reviewer raised something and it wasn't addressed.
8. **Recommendations** — prioritized action list. Quick wins first.

Every finding MUST include: severity, `file:line`, description, fix suggestion. No bare opinions.

### Verify before reporting — mandatory

A finding is not a finding until it has been checked against the branch. This applies to everything you did not derive yourself, and doubly to output from a reviewer runtime without repository access — such a model reasons from the diff text alone and will produce confident, well-formatted, false claims. Measured on one PR: an agentic reviewer scored 2 of 2 accurate, a diff-only reviewer 8 of 48.

Cheap checks that settle most disputes outright:

| Claim shape | How to settle it |
|---|---|
| "X is missing / not declared" | Open the whole file; `git show <branch>:<path>` |
| "identifier exceeds the length limit" | Count it — do not eyeball it |
| "formatting violates the standard" | Run the project's formatter in check mode against the branch content |
| "this convention is violated" | `git grep` the convention across the repo first — if the codebase does it the same way everywhere, it is not this PR's finding |
| "this rule applies here" (API/version-gated rules) | Read the per-file version marker; PR-wide statements about API versions are usually wrong for pre-existing files the PR merely touches |
| platform semantics (NULL handling, limits, defaults) | Query a sandbox or cite the platform doc — never answer from memory |

Report the *outcome* of these checks, not just the surviving findings: a short "checked and rejected" list with the evidence keeps the same wrong claims from returning in the next round, and lets the author see what was actually examined.

When you supply context to a reviewer runtime, state per-file facts per file. A blanket "all classes in this PR are on API version X" is false as soon as the PR touches one older file, and the reviewer will faithfully derive wrong findings from it.

### Step 6: Save locally

1. Read the **Code Review** folder path from `customer.config.md > Folder Paths`.
2. Save to `<Code Review path>/<YYYY-MM-DD>-pr<id>-review.md`. Create the directory if missing.
3. Surface the local file path to the user.

### Step 7: Optional PR comment

If `$ARGUMENTS` includes `--post-comment` AND the resolved provider has a comment-write op:

- **Bitbucket DC**: typically not exposed by a customer-local Bitbucket MCP server (per `pipeline/atlassian-access.md §5` — only `get_*` ops). Inform the user and suggest extending the server with a `add_pull_request_comment` wrapper, then skip the post.
- **GitHub**: `gh pr comment <id> --body-file <path-to-review.md>` after user confirmation.
- **Azure DevOps**: `az repos pr update --id <id>` does not post comments; use `az devops invoke` with the threads endpoint, or `gh pr comment` if the customer mirrors to GitHub. Skip if neither is available.

Always show the user the rendered comment preview and ask for explicit confirmation before posting. Never post a HIGH-severity-laden comment without a confirmation.

### Step 8: Log

- ALWAYS write the execution log with `pipeline/bin/log-skill` — never hand-author the JSON. Run:
  ```bash
  pipeline/bin/log-skill --skill review-pr --identifier pr<id> --status <success|partial|failed> \
    --preferred-runtime openai-codex \
    --summary "<1–2 sentence result>" \
    --artifact <path> \
    --output "<full run text>"
  ```
  It guarantees a schema-valid document and writes it to `pipeline/customers/<customer>/logs/<YYYY-MM-DD>-<customer-short-name>-pr<id>-review-pr.json` (customer, active runtime, and timestamp resolve from config automatically; pass `--artifact` once per created/modified file; the directory is created if needed).
- Include the Step 4a outcome in the `--output` text: the second-opinion reviewer runtime, its finding count, and the user's decision (`merged` / `appended` / `discarded` / `skipped: <reason>`), so the second opinion stays auditable.

### Step 9: Final summary to user

Print:
- Local review file path
- Findings by severity (Critical / Important / Improvement)
- Top 3 actions
- Overall traffic-light health
- Second opinion (if Step 4a ran): reviewer runtime, finding count, and the user's decision — or the skip reason
- If `--post-comment`: posting result or skip reason

## Important Rules

- Follow all conventions from `pipeline/CLAUDE.md` — no AI attribution in any output written into customer-visible artifacts (the review .md is local-only and may reference Claude in dev tooling notes; the PR comment must NOT mention AI).
- Use the Atlassian adapter for Bitbucket; never hardcode URLs or auth.
- For other providers (GitHub / Azure DevOps), use the official CLI (`gh`, `az`) — do not invent direct REST calls.
- Do not invent rule numbers — only cite §7.1, §7.2 etc. when they actually appear in `coding-conventions.md` or `platforms/<Platform>/best-practices.md`. If you can't find the source, drop the section reference and just describe the rule.
- Do not duplicate findings already raised in existing PR comments — escalate them if unaddressed instead.
- Skip findings in test files unless they are security risks (e.g. hardcoded credentials in a test) or would mask a real bug.
- Group recurring patterns into one finding with a count; never produce a wall of identical bullets.
- Output report prose in the **Documentation Language** from `customer.config.md`; code snippets stay in the source language.
- The second-opinion reviewer (Step 4a) is **always dispatched read-only** and its output is **never auto-merged** — display it verbatim and let the user decide (merge / append / discard). If the configured reviewer CLI is unavailable, warn and continue without it; never let the reviewer write to the working tree.

## Error Handling

- **PR not found / 404**: re-prompt for the correct ID; do not guess.
- **Auth failure on the VCS provider**: follow the adapter's §6 once; if still failing, abort with the actionable env-var message.
- **Diff is huge (> ~3000 changed lines)**: warn the user, then sample — review every file in the security-relevant directories (`classes/`, `triggers/`, `permissionsets/`, `profiles/`, `objects/`, `src/api/`, `migrations/`) in full and summarize the rest.
  - If you split the diff into chunks for a reviewer with a limited context window, **never accept an "X is missing" finding at face value** — a chunked reviewer cannot see the rest of its own file. Absence claims (missing `apiVersion`, missing fault handler, missing declaration) must be re-checked against the complete file before they reach the report. This produced two false findings in one run.
  - Never split a single file across chunks without saying so in the prompt, and prefer whole files over line-bounded slices wherever the file fits.
- **No coding-conventions.md or platform/best-practices.md**: surface the missing file path and abort — the skill cannot review meaningfully without them.
- **`gh` or `az` CLI not installed for the resolved provider**: abort with the install instruction; do not silently fall back to `git` clone parsing.
- **Customer config missing a VCS provider URL**: see §VCS provider detection — abort with the field-add instruction.
