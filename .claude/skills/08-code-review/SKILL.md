---
name: code-review
description: Perform a comprehensive code review of the repository or of one story's change set against the customer's stack conventions, platform best practices and domain pitfalls; produces a severity-classified Markdown report with verified findings, saved locally and optionally published to Confluence
argument-hint: [confluence-space-key] [--scope repo|branch|story <key>] [--base <branch>] [--publish]
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

## Purpose

A read-only review of code against the rules this installation actually has. Output is a Markdown report with findings classified HIGH / MEDIUM / LOW, each with `file:line`, description and fix, plus a list of candidate findings that were checked and rejected. The report is always saved locally; publishing to Confluence is optional.

Two scopes:

| Scope | Input | Typical use |
|---|---|---|
| `repo` (default) | the whole source path from `stack.config.md` | periodic health check, audit |
| `branch` / `story <key>` | `git diff <base>...HEAD`, or the files a story touched | pre-merge review of one change set |

For a single pull request use `/review-pr`; it fetches the PR and can post the summary as a comment.

## Configuration

Read before running:

- `pipeline/customer.config.md` — `Platform`, `Short Name`, `Documentation Language`, `UI Language` (flag user-facing strings not in this language), `## Folder Paths > Code Review`, `## Atlassian` (Cloud ID, Confluence Space Key, Confluence Parent Page), `## Quality Gate > Review Max Rounds` (informational here; this skill runs one round)
- `pipeline/stack.config.md` — source path, `## Naming Conventions`, `## Code Quality Standards`, `## Testing Standards`, `## Static Analysis` (PMD rules file, Prettier and lint commands), `## Security Best Practices`, functional domains
- `pipeline/customer.domain.md` — business rules and field-name pitfalls

## Argument parsing

- A bare first token that is not a flag is the Confluence space key for publishing.
- `--scope repo` (default), `--scope branch` (diff of the current branch against `--base`, default the production branch pattern from config), `--scope story <key>` (files referenced by the story key in `@see` tags, `deployment/<key>/package.xml`, or the branch `feature/<key>`).
- `--publish` publishes to Confluence after the user confirms; default is local only.

## Workflow

### Step 1: Establish the review criteria

Build the checklist from what exists, in this priority:

1. **Stack conventions** (HIGH-bias) — every rule in `stack.config.md > Naming Conventions`, `Code Quality Standards`, `Testing Standards`, `Security Best Practices`.
2. **Customer conventions and platform best practices** (HIGH-bias) — only rules that actually exist in those files. If a file is a skeleton, say so in the report's conventions section.
3. **Domain pitfalls** (MEDIUM-bias) — from `customer.domain.md`: derived fields that are overwritten, status codes with special meaning, person-account field naming.
4. **Platform baseline** for `salesforce` (always applied, described in words, no invented section numbers): explicit sharing on every class; CRUD/FLS on user-facing paths; no SOQL, DML or callouts in loops; configuration lookups cached per transaction; no hard-coded IDs, URLs or thresholds that also exist in configuration; no swallowed exceptions; no sensitive values in debug logs; API version consistency; tests assert outcomes, not existence; flows have fault connectors on every data element; validation messages in the configured language.
5. **Security baseline** (HIGH when triggered) — string-concatenated dynamic SOQL, sharing bypass on exposed classes (`@AuraEnabled`, `@RestResource`, guest access), secrets in source or metadata, XSS in Visualforce/LWC, unauthenticated inbound endpoints, over-permissive guest profiles.
6. **UI language** — new user-facing labels, messages and validation texts must be in `UI Language`.

For non-Salesforce platforms replace item 4 with the stack's equivalents from `stack.config.md` (framework rules, database access, auth middleware, error handling).

### Step 2: Collect the scope

- `repo`: list the source path by metadata type (classes, triggers, flows, LWC, Aura, objects, permission sets, custom metadata). For large repositories (> ~1,000 files) sample: every file under `classes/`, `triggers/`, `flows/`, `permissionsets/`, `profiles/` and inbound endpoints in full; other types by count and representative examples, and say so in the report.
- `branch`: `git fetch origin <base> && git diff --stat origin/<base>...HEAD`, then the diff per file.
- `story <key>`: union of `git grep -l "<key>"` under the source path, members of `deployment/<key>/package/package.xml`, and the diff of `feature/<key>` against the base.

### Step 3: Walk the code

Classify each file by path and apply the relevant subset of the checklist. Cite `file:line` from the file on disk, not from diff offsets. **Group recurring patterns** into one finding with a count.

Targeted greps for Apex (non-test) and metadata:

| Pattern | Likely issue |
|---|---|
| `[SELECT` or DML inside a `for` loop, or in a helper called per record | SOQL/DML in loop |
| `Database.query(` with `+` | injection |
| `without sharing` on a class reachable from `@AuraEnabled`, `@RestResource`, `@InvocableMethod` | sharing bypass on an exposed path |
| class file without `with`/`without`/`inherited sharing` | sharing not declared |
| `getInstance(` with a literal, or `LIMIT 1` on a configuration query that can match several records | non-deterministic configuration lookup |
| numeric literals that also exist as configuration values | duplicated configuration |
| `catch (Exception` followed by an empty block | swallowed exception |
| `System.debug(` with token/password/secret/iban | logging hygiene |
| `@TestVisible` statics used as production switches | test-only override in runtime path |
| flows: `recordLookups`/`recordUpdates`/`recordCreates` without `<faultConnector>` | missing fault path |
| flows: literal 15/18-character IDs or `https://` in `<value>` | hard-coded ID or URL |
| `-meta.xml` API version below the version in `stack.config.md` on files the scope changed | stale API version |

Test files: report only security issues or tests that would mask a real bug (assertion-free tests, `Test.isRunningTest()` branches that skip logic).

### Step 4: Automated checks

Run what `stack.config.md > Static Analysis` names and is installed:

```bash
pmd check -d <apex files in scope> -R <PMD rules file> -f text --minimum-priority 3   # if pmd is on PATH and the rules file exists
npm run lint                                                                             # if node_modules exists and LWC/Aura are in scope
npx prettier --check <files in scope>                                                    # if node_modules exists
```

A tool that is not installed or a rules file that does not exist is recorded as **unchecked**, never as pass. Save raw outputs under `<Code Review folder>/<date>-automated/`.

### Step 5: Independent review pass

Dispatch **one read-only review** via the `Agent` tool (fresh general-purpose agent) with: the scope file list or diff, the checklist essence from Step 1 (stack rules, existing convention rules, domain pitfalls), and the instruction: *report only — do not modify files; findings with severity (HIGH / MEDIUM / LOW), file:line, rule, concrete fix; prioritise security, correctness and architecture over style; verify each claim by reading the whole file; end with a per-category "assessed / not assessed" line for Security, Correctness, Architecture, Error handling, Conventions, Documentation.*

Merge the agent's findings with your own, deduplicated. This is a reporting skill: it runs one round and does not fix code. If the merged findings contain open HIGH or MEDIUM items, the codebase does not clear the gate; that is the result, not a reason to loop.

### Step 6: Verify before reporting — mandatory

A finding is not a finding until checked against the code on disk:

| Claim shape | How to settle it |
|---|---|
| "X is missing" | open the whole file, not the excerpt |
| "convention violated" | `git grep` the convention across the repository; if the whole codebase does it that way, it is a repository-level observation, not a per-file finding |
| "rule applies here" (version-gated) | read the file's API version |
| "configuration lookup ambiguous" | list the actual metadata records |
| "unreachable / unused" | grep flows, quick actions, LWC templates and communities before calling anything dead |
| platform semantics | cite documentation or query a sandbox; never from memory |

Keep a **checked and rejected** list with the evidence; it goes into the report.

### Step 7: Severity classification

| Severity | Trigger |
|---|---|
| **HIGH** | Security risk; data loss or corruption; sharing bypass on an exposed path; hard-coded secret; a MUST/NEVER rule in the stack or customer conventions |
| **MEDIUM** | Architectural concern; non-deterministic configuration lookup; swallowed errors; missing FLS without documented rationale; missing or assertion-free tests for a changed path; bulkification gap; stale API version on changed files |
| **LOW** | Naming or convention drift; dead code; noisy logging; duplicated configuration values; documentation gaps |

When a finding could go either way, take the lower severity and say why it might escalate. Never downgrade a finding to improve the overall picture; if a finding is wrong, remove it and record the refuting evidence in the rejected list.

### Step 8: Build the report

Documentation Language from config. Title: `Code Review — <Short Name> — <YYYY-MM-DD> — <scope>`.

1. **Summary** — scope and base, files reviewed (by type, sampled or full), traffic light (green: no HIGH or MEDIUM; yellow: MEDIUM only; red: any HIGH), counts by severity, top 3 actions, what could not be checked (tools missing, files skipped).
2. **Critical Findings (HIGH)** — each with `file:line`, description, impact, concrete fix snippet.
3. **Important Findings (MEDIUM)** — same structure.
4. **Improvements (LOW)** — same, terser.
5. **Automated Checks** — PMD, lint and Prettier results, or `unchecked` with the reason.
6. **Adherence to Conventions** — table of rules checked with ✅ / ⚠️ / n/a and the source file of each rule; state which convention files were skeletons.
7. **Architecture Assessment** — strengths, weaknesses, scalability and maintainability notes; only for `repo` scope or when the change set touches architecture.
8. **Test Coverage Notes** — per changed production file (branch/story scope) or per functional domain (repo scope): tests present, what they assert, gaps.
9. **Recommendations** — prioritised, quick wins first, with effort (S/M/L).
10. **Checked and rejected** — candidate findings with the evidence that dismissed them.

Every finding: severity, `file:line`, description, fix. No bare opinions.

### Step 9: Save and publish

1. **Save** to `<Code Review folder>/<YYYY-MM-DD>-code-review[-<scope>].md` (folder from config, default `code-review/`; create if missing).
2. **Publish** only with `--publish` and only when `customer.config.md > Atlassian` has a Cloud ID and a Confluence Parent Page:
   - `searchConfluence` for the report title in the space (argument or `Confluence Space Key` from config; if neither, ask).
   - Exactly one hit: `updateConfluenceContent`; none: `createConfluenceContent` under the parent page; several: ask which.
   - Show the page URL. Publication failures never cost the report: it is already on disk.
3. Without a Cloud ID or parent page, say the review was saved locally only.

### Step 10: Log and summary

Create `<YYYY-MM-DD>-<customer-short-name>-<scope-identifier>-code-review.json` in `.claude/skills/08-code-review/logs/` per the CLAUDE.md JSON schema. Add:

```json
"scope": "repo | branch | story AP2-xxxx",
"findings": { "high": 0, "medium": 0, "low": 0, "rejected": 0 },
"checks": { "pmd": "pass | fail | unchecked", "lint": "pass | fail | unchecked | n/a", "prettier": "pass | fail | unchecked" },
"published": "<url> | skipped | failed"
```

Status `success` when the report was written and every automated check ran; `partial` when a check was `unchecked` or publishing failed; `failed` when no report was written.

Print: report path (and Confluence URL), counts by severity, traffic light, top 3 actions, which checks were unchecked and why.

## Important Rules

- Read-only towards code and org: never edit, never deploy, never change a PR.
- Only cite convention rules that exist in the configuration files; describe general practice in words.
- Group recurring patterns; report test files only for security issues or masked bugs.
- Report prose in the Documentation Language; code snippets in the source language.
- No AI attribution in the report, the Confluence page or the log.
- Publishing always requires `--publish` and a confirmation of the page title and space.

## Error Handling

- **Source path missing or empty**: say so and abort; nothing to review.
- **`--base` branch not on the remote**: list candidates from `git branch -r` and ask.
- **PMD, ESLint or Prettier not available**: record the check as `unchecked`, continue with the manual review.
- **Confluence unreachable or page write fails**: keep the local report, mark `published: failed`, log `partial`.
- **Repository very large**: sample as in Step 2 and state the sampling in the summary.
