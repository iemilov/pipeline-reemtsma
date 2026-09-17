---
name: code-review
description: Perform a comprehensive code review based on the project's tech stack and publish results to Confluence or as local Markdown
argument-hint: [confluence-space-key (optional)] [--auto-switch | --no-auto-switch]
preferred-runtime: openai-codex
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`


> **Runtime hint & auto-switch:** This skill prefers `openai-codex` (diff-walking and code inspection). Before any user-visible work, resolve what to do about a runtime mismatch with the shared helper — do not re-derive the gate:
>
> ```bash
> pipeline/bin/runtime-autoswitch --skill code-review [--auto-switch | --no-auto-switch]
> ```
>
> If the user passed `--auto-switch` or `--no-auto-switch` in `$ARGUMENTS`, forward it to the helper — a per-run flag overrides the customer-config `Auto-Switch Runtime` default (precedence: flag → config → off). Branch on the `decision=` line it prints:
> - **`switch`** — the customer opted into `Auto-Switch Runtime` and the preferred runtime is installed *and* authenticated (subscription reachable). Run the **read-only analysis** (Steps 2–4: scanning frontend/backend and applying the review criteria) under the preferred runtime using the `dispatch=` command template (the §2a read-only recipe, run per its Background dispatch contract — detached, output to a log file, and the `pipeline/bin/review-progress` feed armed so the analysis's reasoning is visible in the session while it runs), composing the dispatched prompt from the versioned brief `pipeline/briefs/code-review-brief.md` (fill its placeholders, `{mode}` per Step 7's scoping mode), then apply the findings and do all Confluence/MCP I/O from the host runtime. Record the runtime that actually ran the analysis in the log. The brief's findings-JSON return format is the Step 7 findings file either way — under `none`/`warn` the host fills it from its own analysis.
> - **`warn`** — print the standardized warning from `pipeline/agent-runtime-access.md` §1a and proceed under the active runtime. This covers auto-switch off, the preferred CLI missing, or no usable credentials/subscription; the `reason=` line says which.
> - **`none`** — preferred runtime already active, or no preference resolved; print nothing.
>
> Always record `active_runtime`, `preferred_runtime`, and `runtime_match` in the execution log. See `pipeline/agent-runtime-access.md` §1a (auto-switch gate) and §2a (read-only dispatch).

## Configuration

Before executing, read `pipeline/customer.config.md` for customer-specific values (Atlassian Deployment Type, customer identity, Confluence Space Key, Confluence parent page, documentation language, **UI Language** — the language the end-user-facing UI is built in; flag any UI strings, labels, button text, or error messages in the codebase that are not in this language as a finding), `pipeline/stack.config.md` for tech stack details (architecture, libraries, conventions, code quality rules), and `pipeline/customer.domain.md` for domain-specific business logic, glossary, and common pitfalls. Also read `pipeline/platforms/<Platform>/best-practices.md` (resolve `<Platform>` via `pipeline/bin/config "Platform"`) for platform-wide coding best practices, and `pipeline/coding-conventions.md` for customer-specific coding conventions. For all Confluence calls, consult the **Atlassian adapter** at `pipeline/atlassian-access.md`.

## Workflow: Codebase → Code Review Report

Perform a thorough code review of the project codebase, evaluating code quality, security, performance, and adherence to conventions defined in the stack and domain configs.

**Scope Guidance:** Focus on actionable findings:
- Prioritize security issues, bugs, and architectural concerns over stylistic preferences
- Group similar issues rather than listing every occurrence
- Provide concrete fix suggestions for each finding
- Skip auto-generated files, build output, and migration files (unless SQL quality is relevant)

### Step 1: Establish Review Criteria

Based on the **tech stack** from `stack.config.md`, build a review checklist covering:

1. **Stack-specific rules** — e.g., React hook rules, Cloudflare Workers constraints, D1/SQLite best practices
2. **Code quality rules** — ESLint config, naming conventions, project structure conventions
3. **Domain conventions** — Field naming pitfalls, business logic patterns from `customer.domain.md`
4. **Security baseline** — OWASP Top 10 relevant to the stack (XSS, injection, auth issues, CORS, secrets exposure)
5. **Platform acceptance standard** — every rule in `pipeline/platforms/<Platform>/best-practices.md`. For `salesforce`, take its **Compliance Gate**, **anti-pattern table**, and **common deployment errors** table as review items verbatim. A Compliance Gate failure is **HIGH** when it is a security or data-integrity rule (user-mode enforcement, sharing declaration, SOQL injection, hardcoded Ids/secrets) and at least **MEDIUM** otherwise (bulkification, missing assertions, missing FLS in a permission set, stale API version) — never LOW. Customer conventions in `coding-conventions.md` override this document on style and naming only, not on correctness, security, or governor limits.
6. **Testdata impact contract (conditional)** — if the active customer has a `testdata.catalog.json` (`pipeline/customers/<customer>/testdata.catalog.json`), the story's effect on the testdata setup (catalog, executors, validator modules, cleanup, documentation) is reviewable evidence, not an afterthought. See Step 5a for the concrete checks.

### Step 2: Analyze Frontend Code

Scan all frontend source files (e.g., `src/` directory):

1. **Component quality**
   - Proper use of React hooks (dependency arrays, no conditional hooks)
   - Component size and responsibility (identify components that should be split)
   - Prop drilling vs. context usage
   - Missing error boundaries
2. **State management**
   - Unnecessary re-renders, missing memoization where impactful
   - State stored at wrong level (local vs. lifted vs. context)
3. **Accessibility**
   - Missing ARIA attributes on interactive elements
   - Keyboard navigation gaps
   - Missing form labels
4. **CSS / Styling**
   - Inconsistent use of CSS custom properties vs. hardcoded values
   - Theme support gaps (light/dark mode)
   - Responsive design issues

### Step 3: Analyze Backend Code

Scan all backend/API source files (e.g., `functions/` directory):

1. **API design**
   - Consistent REST conventions (HTTP methods, status codes, error responses)
   - Missing input validation or sanitization
   - Inconsistent response formats
2. **Database access**
   - SQL injection risks (parameterized queries check)
   - Missing indexes for common query patterns
   - N+1 query patterns
   - Transaction usage where needed
3. **Authentication & Authorization**
   - Auth middleware consistency
   - Token validation completeness
   - Missing auth checks on protected routes
4. **Error handling**
   - Uncaught promise rejections
   - Missing try/catch on async operations
   - Error information leakage to clients

### Step 4: Security Review

1. **Input handling** — All user inputs validated and sanitized before use
2. **Authentication** — JWT/session handling, password hashing, cookie security flags
3. **Secrets management** — No hardcoded secrets, API keys, or credentials in source
4. **CORS / Headers** — Proper CORS configuration, security headers
5. **Dependency risks** — Known vulnerabilities in dependencies (check `package-lock.json` age and known CVEs if detectable)

### Step 5: Architecture & Patterns Review

1. **Separation of concerns** — Business logic in appropriate layers
2. **Code duplication** — Repeated patterns that should be abstracted
3. **Dead code** — Unused imports, unreachable code, commented-out blocks
4. **Naming consistency** — Variables, functions, files follow project conventions
5. **Migration quality** — Schema consistency, foreign keys, indexes

### Step 5a: Testdata Impact Review (conditional)

> Skip this step if the active customer has no `testdata.catalog.json`. Customers without a testdata catalog have no impact contract to review against.

Verify that this change's effect on the testdata setup was honestly and completely declared, using the story's `implementation-design/<story-key>/testdata-impact.json` (VP-09 schema, `pipeline/schemas/testdata-impact.schema.json`) as the artifact under review — not the diff's code quality (that's Steps 2–5), but whether the testdata contract keeps its promises:

1. **Locate and validate the artifact:**
   ```bash
   pipeline/bin/validate-testdata-impact implementation-design/<story-key>/testdata-impact.json
   ```
   Missing or schema-invalid is itself a finding (see severity mapping below).
2. **New/changed capability requirements** — does the diff add or change any object/field/RecordType that a validator module's capability requirements should know about? Is that reflected in `affectedModules` / `requiredCapabilitiesAdded`?
3. **New business rules in the correct rule module** — if the story introduces a new business/validation rule relevant to test data (status transitions, entity relationships), is it declared in `businessRules` and mapped to the right `validator.modules[].id`, not bolted onto an unrelated module?
4. **Affected presets and executors updated** — does `affectedPresets` and `requiredChanges.executors[]` match what the diff actually touches under the customer's executor scripts and `testdata.catalog.json` presets?
5. **New relations in cleanup and manifest** — if the diff introduces a new parent/child or cross-reference relationship, is `requiredChanges.cleanup` `true` and does the cleanup config (deletionOrder / crossReferenceFields) actually reflect it?
6. **Test coverage** — does `tests[]` list concrete positive, negative, and regression cases for the declared impact, not just a placeholder?
7. **Breaking changes versioned** — if the change is breaking for existing consumers of a module/preset, was the module/profile version bumped accordingly?
8. **Pilot and cleanup requirement** — for a non-trivial `change` declaration, is `pilotPreset` set to a concrete preset that exercises the new/changed impact, and is `requiredChanges.cleanup` addressed (not silently left `false` when a new relation was introduced)?

**Severity:** a missing, schema-invalid, or contradicted testdata-impact declaration (e.g. `decision: "none"` where the diff clearly changes testdata-relevant metadata or business rules, or a `decision: "change"` where a declared item was never delivered) is classified **at least HIGH** (`Kritische Befunde`) whenever the story touches testdata-relevant metadata or business rules — this is this skill's ceiling severity and the closest equivalent to "at least Major." Only classify MEDIUM when the gap is genuinely partial/ambiguous and already tracked as an explicit follow-up. File findings from this step under **Correctness / Bugs** in the Scoring Rubric (Step 7) — no separate rubric category is needed.

### Step 6: Run Automated Checks

If available, run linting and type-checking commands from `stack.config.md`:

1. Run ESLint (`npm run lint`) and capture output
2. Note any warnings or errors
3. Include automated findings alongside manual review

### Step 7: Build Review Report

Structure the report in **Markdown** using the **documentation language** from config.

Use the title: `Code Review — <Customer Short Name> <Date>`

**Scoring Rubric (100 points).** The rubric is **computed, never summed in prose**: write the review's findings to a findings file valid against `pipeline/schemas/review-findings.schema.json` (one entry per finding with lowercased severity — HIGH≡`blocker`, MEDIUM≡`major`, LOW≡`minor` — and its rubric category, plus a `coverage` array with one entry per category stating whether the sweep actually assessed it), then score it:

```bash
pipeline/bin/score-rubric --rubric code-review --findings <report-dir>/code-review-round-1.findings.json \
  [--mode whole-repo --kloc <reviewed kLOC>] \
  --out <report-dir>/code-review-round-1.score.txt
```

The canonical rubric is `pipeline/rubrics/code-review.rubric.json` — on any divergence from the compact table below, the JSON wins. A category the sweep did not assess is `"reviewed": false`, comes back as a `null` axis, and makes the total `unknown` (`verdict=incomplete`) — never silently full marks. The categories are stack-neutral; fill in stack-specific checks from `stack.config.md`.

**First pick the scoring mode, and state it in the report header** — the deduction weights below are calibrated for the amount of code under review, so applying the wrong mode makes the score meaningless:

| Mode | When | Deductions |
|---|---|---|
| **Story** (default) | One story's diff, a PR, a handful of files | Table below, as written |
| **Whole-repo** | A full-repository sweep, an audit, anything over ~1 kLOC | Table below, but **divide every deduction by the reviewed kLOC** (round the divisor to 1 decimal, minimum 1.0) |

| Category | Weight | Deduction guide (Story mode) |
|----------|:------:|-----------------|
| Security | 30 | −15 per HIGH, −5 per MEDIUM |
| Correctness / Bugs | 25 | −12 per HIGH, −4 per MEDIUM |
| Architecture & Patterns | 15 | −5 per issue |
| Error Handling | 15 | −5 per gap |
| Conventions & Naming | 10 | −2 per violation (grouped) |
| Documentation | 5 | −1 per gap |

Floor each category subscore at 0, sum to the total, and band it: 🟢 ≥90 (ship) · 🟡 70–89 (review) · 🔴 <70 (block).

> **Why the whole-repo mode exists.** Story-mode weights assume a small diff. Applied unchanged to a multi-kLOC sweep, every category floors at 0 and the total collapses toward 0 — a number that says nothing about a codebase whose tests pass and whose architecture is sound. Normalising per kLOC keeps the score comparable across review scopes. If the normalised score still looks implausible against the qualitative read, report the **severity-classified findings as the signal** and say the score is not meaningful at this scope, rather than publishing a misleading number.

The rubric **complements** the severity-classified findings — it summarizes health, it does not replace or override the finding list. A hard severity gate (no open Blocker/Major) still governs go/no-go.

**Severity → gate input mapping.** The gate takes `--blockers` and `--majors`; this skill classifies findings as HIGH / MEDIUM / LOW. The translation is **mechanical, never an estimate** — take both numbers from the `blockers=` / `majors=` lines of the `bin/score-rubric` run above (they count the open findings in the published findings file), which must match the row counts of the report sections below, so that anyone holding the report can recompute the gate inputs and arrive at the same verdict:

| Report section (below) | Severity | Gate input | Blocks? |
|---|---|:---:|:---:|
| Kritische Befunde | HIGH | `--blockers` | yes |
| Wichtige Befunde | MEDIUM | `--majors` | yes |
| Verbesserungsvorschläge | LOW | not passed to the gate | no |

`/implement-us` Step 6 feeds the same gate from its reviewer's own Blocker / Major / Minor / Nit vocabulary: **Blocker ≡ HIGH** and **Major ≡ MEDIUM**, so both skills count the same things and their verdicts stay directly comparable.

> **Never downgrade a finding to obtain a passing gate.** A HIGH you chose not to report as a Blocker is still `--blockers 1`. If a HIGH turns out to be wrong, remove it from the report and state the evidence that refutes it — a finding must never sit in the report and out of the count at the same time. Since the gate blocks on `blockers + majors`, a single open HIGH makes `decision=pass` unreachable regardless of the score.

**Quality gate.** A customer may promote the score from an advisory number to a real exit condition by setting `Quality Gate Score` in `customer.config.md > ## Quality Gate`. Resolve and evaluate it with the shared helper — never re-derive the arithmetic, and never substitute your own judgement of "good enough":

```bash
pipeline/bin/quality-gate --check                                   # what is the gate here?
# <b> = number of HIGH findings, <m> = number of MEDIUM findings (mapping above)
pipeline/bin/quality-gate --round 1 --blockers <b> --majors <m> --score <total>
```

This skill is a **reporting** skill: it does not fix code, so it runs a single round and does not loop. Report the gate outcome in the Executive Summary alongside the score — `decision=pass` (with `clean`, `score-threshold`, or `score-unmeasured` — the last means the severity gate passed but a configured score threshold could not be applied) or `decision=continue` / `stop`, which for a report means *this codebase does not currently clear the customer's gate*. The looping consumer of the same gate is `/implement-us` Step 6, which re-reviews after fixing; both read the identical configuration, so a story that passed there and a sweep that fails here are directly comparable. When no threshold is configured (the default), the helper reports `threshold=off` and the severity gate alone decides — unchanged behavior.

1. **Zusammenfassung (Executive Summary)**
   - **Bewertung (Score):** overall score /100 with band (🟢 ≥90 / 🟡 70–89 / 🔴 <70), plus the per-category subscores and the **scoring mode** used (Story or Whole-repo, with the kLOC divisor when normalised)
   - **Quality Gate:** the configured threshold (or "nicht konfiguriert" when `threshold=off`) and the helper's verdict — pass, or not passed with the reason. Omit this line entirely when no threshold is configured and no Blocker/Major findings exist
   - Overall code health assessment (traffic light: green/yellow/red)
   - Total findings by severity
   - Top 3 most important recommendations

2. **Kritische Befunde (Critical Findings)** — Severity: HIGH
   - Security vulnerabilities
   - Data loss risks
   - Authentication/authorization gaps
   - Missing, invalid, or contradicted testdata-impact declaration on a story that touches testdata-relevant metadata or business rules (Step 5a)
   - Each finding: description, location (file:line), impact, fix suggestion

3. **Wichtige Befunde (Important Findings)** — Severity: MEDIUM
   - Performance issues
   - Missing error handling
   - Architectural concerns
   - Each finding: description, location, impact, fix suggestion

4. **Verbesserungsvorschläge (Improvements)** — Severity: LOW
   - Code quality improvements
   - Accessibility gaps
   - Convention inconsistencies
   - Each finding: description, location, suggestion

5. **Automatisierte Prüfungen (Automated Checks)**
   - ESLint results summary
   - Any other tool output

6. **Architektur-Bewertung (Architecture Assessment)**
   - Strengths of the current architecture
   - Areas for improvement
   - Scalability considerations

7. **Empfehlungen (Recommendations)**
   - Prioritized action items (numbered list)
   - Quick wins vs. longer-term improvements
   - Suggested next steps

### Step 8: Save & Publish

1. **Always save locally:** Read the `Code Review` folder path from `customer.config.md`. Save the generated Markdown to `<Code Review path>/<YYYY-MM-DD>-code-review.md`. Create the directory if it does not exist.
2. **Check Atlassian connection:** Resolve the Confluence connection via the Atlassian adapter (`pipeline/atlassian-access.md` §1–§2). If `Deployment Type` is missing, OR (Cloud path) `Cloud ID`/`Confluence URL` is empty, OR (DC path) `Confluence URL` is empty OR no Confluence MCP server is registered for this customer (`mcp__confluence__*` tools not callable), skip Confluence publishing. Inform the user that the review was saved locally only because no Atlassian connection is configured.
3. If Atlassian is configured and `Confluence Parent Page` is set:
   - Use the adapter's `searchConfluenceUsingCql` operation to check if a page with the review title already exists
   - If it exists, update the page via the adapter's `updateConfluencePage` operation (on DC: bump `version.number`, send XHTML storage format — see adapter §4)
   - If it does not exist, create a new page via the adapter's `createConfluencePage` operation
     - If `$ARGUMENTS` contains a non-flag value, use it as the space key (strip any `--auto-switch` / `--no-auto-switch` flag first — those are forwarded to the runtime-autoswitch helper, not used as the space key)
     - Otherwise, ask the user which Confluence space to use
   - Add the page as a subpage of the **Confluence parent page** from config
   - Present the Confluence page URL to the user
4. If Atlassian is configured but `Confluence Parent Page` is `—`, save locally and inform the user.

### Step 9: Summary

Present:
- Link to the Confluence page (if published) or path to the local Markdown file
- Rubric score (/100) and band (🟢/🟡/🔴)
- Findings count by severity (Critical / Important / Improvement)
- Top 3 action items
- Overall health assessment

## Important Rules
- Follow all conventions from CLAUDE.md
- Compute and report the **Scoring Rubric** total (/100), per-category subscores, and band (🟢/🟡/🔴) in the Executive Summary — it complements the severity-classified findings, it does not replace them
- Output text in the review report uses the **documentation language** from config
- Use the Atlassian adapter (`pipeline/atlassian-access.md`) for all Confluence operations — branch on `Deployment Type` from `customer.config.md`; never hardcode URLs, Cloud IDs, or PAT env var names
- ALWAYS write the execution log with `pipeline/bin/log-skill` — never hand-author the JSON. Run (use the story key or branch under review as `<review-target>`):
  ```bash
  pipeline/bin/log-skill --skill code-review --identifier <review-target> --status <success|partial|failed> \
    --preferred-runtime openai-codex \
    --summary "<1–2 sentence result>" \
    --artifact <path> \
    --iterations 1 --verifier "bin/quality-gate" \
    --score-report-file <report-dir>/code-review-round-1.score.txt \
    --exit-reason <clean|score-threshold|score-unmeasured|budget-exhausted> \
    --output "<full run text>"
  ```
  The score is never typed: `--score-report-file` hands `bin/log-skill` the `bin/score-rubric` report, from which it parses `final_score`, the per-axis `loop.axes`, and `loop.unscored_axes` (a conflicting `--final-score` is a usage error; a `score=unknown` report leaves `final_score` null). Record the gate verdict as `--exit-reason` (`clean` / `score-threshold` when it passed, `score-unmeasured` when it passed on severity while the score was unmeasured — a `verdict=incomplete` report logs `score-unmeasured` even under the threshold-off default, where the gate itself says `clean` — and `budget-exhausted` when this single round did not clear the gate; a report skill has no further rounds to spend). This is what lets `/pipeline-stats` plot the score history over time, aggregate axis coverage, and `/improve-skills` correlate recurring findings with the skills that produced them. Omit the loop flags only when no score was computed at all (see the whole-repo caveat above); then the `loop` object is simply absent.
  It guarantees a schema-valid document and writes it to `pipeline/customers/<customer>/logs/<YYYY-MM-DD>-<customer-short-name>-<review-target>-code-review.json` (customer, active runtime, and timestamp resolve from config automatically; pass `--artifact` once per created/modified file; the directory is created if needed).
- Focus on actionable findings — avoid nitpicking or stylistic opinions unless they violate project conventions
- Every finding MUST include: severity, file location, description, and a concrete fix suggestion
- Do not report findings in test files unless they represent security risks
- Group recurring patterns (e.g., "missing error handling in 5 API endpoints") rather than listing each individually
- Run the **Testdata Impact Review** (Step 5a) whenever the active customer has a `testdata.catalog.json` — a missing or contradicted testdata-impact declaration on a testdata-relevant story is at least a HIGH finding, never silently omitted

## Error Handling
- If the repository structure cannot be read, inform the user and abort
- If no Atlassian connection is resolvable per the adapter (`pipeline/atlassian-access.md` §1–§2) — `Deployment Type` missing; Cloud path with empty `Cloud ID`/`Confluence URL`; or DC path with no Confluence MCP server registered or an MCP call that fails auth — save the review as a local Markdown file and inform the user. Do not attempt further Confluence API calls.
- If Confluence page creation or update fails, save the generated Markdown content locally in the logs folder and inform the user
- If linting commands fail or are not configured, note this in the report and continue with manual review
- If the codebase is very large, focus on the most critical areas (API endpoints, auth, data access) and summarize others at a higher level
