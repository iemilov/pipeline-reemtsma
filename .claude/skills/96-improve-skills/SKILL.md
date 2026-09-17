---
name: improve-skills
description: Mine skill execution logs and review reports for recurring failure modes, then propose concrete, evidence-backed edits to the skills, conventions, and best-practices they came from
argument-hint: "[--skill <name>] [--days <N>] [--min-occurrences <N>] [--apply] [--dry-run]"
preferred-runtime: claude-code
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

> **Runtime hint:** This skill prefers `claude-code` (cross-document synthesis and judgement over many small evidence fragments). If the active `Agent Runtime` differs after applying any `## Skill Runtime Overrides`, print the standardized warning from `pipeline/agent-runtime-access.md` §1a and proceed. Record `active_runtime`, `preferred_runtime`, and `runtime_match` in the execution log.

## When to Use / When NOT to Use

- **Use** to close the *outer* loop: after a stretch of pipeline work, ask what the accumulated execution logs and review reports say about the **skills themselves** — which ones need several review rounds to converge, which produce the same finding over and over, which keep exhausting their quality-gate budget.
- **Use** when a recurring annoyance is suspected but not yet evidenced ("the reviewer keeps flagging the same thing") and you want the log history to confirm or refute it before editing anything.
- **Do NOT use** to review code — that is `/code-review` (this skill consumes its reports, it does not produce them).
- **Do NOT use** to read out metrics — that is `/pipeline-stats`. This skill reads the same logs but answers a different question: *what should change*, not *what happened*.
- **Do NOT use** to create or restructure a skill from scratch — write the `SKILL.md` directly following `CLAUDE.md > Creating New Skills`. This skill proposes **targeted edits to existing** documents.
- **Do NOT use** to fill knowledge gaps from user questions — that is `/build-knowledge`, fed by the `/ask` gap log.

## Related Skills

| Need | Use instead | Why |
|------|-------------|-----|
| Metrics, rates, timelines from the logs | `/pipeline-stats` | Reports the numbers; this skill acts on them |
| Review a codebase or a diff | `/code-review` | Produces the findings this skill mines |
| Decide when a review loop may exit | `pipeline/bin/quality-gate` | The gate itself; this skill studies its outcomes |
| Build/refresh domain documentation | `/build-knowledge` | Documents the customer's domain, not the harness |
| Commit and push the applied edits | `/commit` | This skill never commits |

## Configuration

Read `pipeline/customer.config.md` for **Short Name**, **Platform**, **Agent Runtime**, **Documentation Language**, and the **Code Review** folder path. German output uses proper Umlaute (ä, ö, ü, ß).

Evidence sources, all read-only:

| Source | Path | What it contributes |
|--------|------|---------------------|
| Execution logs | `pipeline/customers/*/logs/*.json` | Status, summaries, and the `loop` object (rounds, score, exit reason) |
| Review reports | `<Code Review path>/*-review.md` | Concrete findings with severity, file location, and rule cited. The glob is deliberately the broad one: it matches both `/code-review` output (`*-code-review.md`) and `/review-pr` output (`*-pr<id>-review.md`) |
| Skills | `pipeline/.claude/skills/*/SKILL.md` | The instructions that produced the above |
| Customer conventions | `pipeline/coding-conventions.md` | Style/naming rules the findings cite |
| Platform best practices | `pipeline/platforms/<Platform>/best-practices.md` | Correctness/security/limits rules the findings cite |

## Workflow: Evidence → Clustered Failure Modes → Proposed Edits

### Step 0: Parse Arguments

- `--skill <name>` — restrict the analysis to one skill (partial match, e.g. `implement` matches `implement-us`)
- `--days <N>` — only consider evidence newer than N days (default: all)
- `--min-occurrences <N>` — minimum independent occurrences before a pattern is reported (default: **3**)
- `--apply` — after the approval gate, apply the approved edits to the working tree
- `--dry-run` — analyse and report only; never write the proposal file, never edit anything

### Step 1: Collect Evidence

1. Parse every `pipeline/customers/*/logs/*.json`. Skip malformed files with a warning rather than failing; validate any suspicious one with `pipeline/bin/log-skill --validate <file>`.
2. From each log take `skill`, `identifier`, `timestamp`, `status`, `summary`, `output`, and the optional `loop` object (`iterations`, `final_score`, `exit_reason`).
3. Read every review report under the **Code Review** path — everything matching `*-review.md`. Extract findings with their severity, cited rule, and file location. Do **not** narrow the glob to one skill's naming: `/review-pr` reports usually outnumber `/code-review` reports in that folder by an order of magnitude, and a glob that misses them shrinks the evidence base without raising anything.
4. Apply the `--skill` and `--days` filters.
5. **State the evidence base up front** — number of logs, number of reports, date range, and how many logs carry a `loop` object. If the base is thin (< 10 logs, or < 3 for the filtered skill), say so plainly and continue; every conclusion drawn from it inherits that caveat. State the **log-to-report ratio** alongside: logs from a review skill with no matching reports is the signature of a glob that does not fit the folder, not of a customer who never reviewed anything.

### Step 2: Cluster Failure Modes

Group the evidence into candidate patterns. A pattern needs **at least `--min-occurrences` independent occurrences** (different stories, not the same story retried) before it is reported — one bad run is an anecdote, and editing a skill to fix an anecdote makes it worse for every other run.

Cluster along these axes:

1. **Recurring review findings** — the same rule or finding type cited across stories. The strongest signal: the reviewer keeps catching what the implementer keeps doing.
2. **Slow convergence** — skills whose mean `loop.iterations` is high or rising. Each extra round is a fix the skill should have gotten right the first time.
3. **Non-convergence** — runs ending in `budget-exhausted` or `no-progress`. Read the `output` of those runs: what was still open when the budget ran out?
4. **Score drift** — `loop.final_score` trending down for a skill, or clustering in the 🟡/🔴 bands.
5. **Repeated failures and partials** — `status` of `failed`/`partial` with similar summaries; group by cause, not wording.
6. **Logging gaps** — looping skills whose logs carry no `loop` object, or logs missing runtime fields. These weaken every other conclusion here, so report them as their own finding.

For each cluster record: a one-line description, occurrence count, the specific evidence (log filenames, report sections, story keys), and the **suspected cause**.

### Step 3: Attribute Each Cluster to a Target Document

A pattern is only actionable once it names the document that should change. Attribute by asking *where the rule should have been stated*:

| Symptom | Likely target |
|---------|---------------|
| The skill's steps are ambiguous, out of order, or missing a check | that skill's `SKILL.md` |
| The code is correct but written in the wrong house style | `pipeline/coding-conventions.md` |
| The code is wrong on correctness, security, limits, or deployability | `pipeline/platforms/<Platform>/best-practices.md` |
| A business rule or field pitfall was missed | `pipeline/customer.domain.md` |
| A tool/command/alias was wrong or missing | `pipeline/stack.config.md` |
| The gate passed on work that should not have | `## Quality Gate` config, **as a question to the user** (see Step 5) |

Respect the precedence in `CLAUDE.md > Coding Standards`: customer conventions override platform best practices on **style and naming**; platform best practices win on **correctness, security, resource/governor limits, and deployability**. If a cluster's fix would have a customer convention waive a correctness or security rule, do **not** propose it — report it as a documentation bug in the customer's conventions, exactly as that rule requires.

### Step 4: Draft Concrete Proposals

For each attributed cluster, write a proposal containing:

1. **Title** — the failure mode in one line
2. **Evidence** — occurrence count, story keys, log filenames, report sections. Every claim traceable to a file
3. **Suspected cause** — why the current instructions permitted this
4. **Proposed edit** — the **exact** text change: target file, anchor (section/step), and old → new wording. Not "clarify the deployment step" but the sentence that replaces it
5. **Expected effect** — which metric should move (rounds-to-green, non-convergence rate, that finding's recurrence) and roughly by how much
6. **Risk & blast radius** — which other skills or customers this text also governs. A change to a platform best-practices file reaches every customer on that platform; a change to a customer's conventions reaches one
7. **Confidence** — high / medium / low, from the evidence count and how directly it points at the cause

Rank proposals by (occurrences × severity) ÷ blast radius — frequent, serious, narrowly-scoped fixes first.

### Step 4.5: Verify Every Citation (MANDATORY, before the gate)

A proposal is a claim about what a file says. Verify each claim against the file **before** it reaches the approval gate — a fabricated or mis-filed quote that survives into Step 5 asks the user to approve an edit for a problem that does not exist, and the user has no practical way to catch it there.

Parsing the evidence is not verifying it: Step 1 confirms that logs are well-formed and says nothing about whether a quoted finding exists.

For **every** quote, finding ID, and file reference in every proposal:

1. **The quote exists in the cited file.** Grep a distinctive verbatim substring against that exact path — never from recollection, never from a summary written earlier in this run. Search the whole file, not the region you expect it in.
2. **The finding ID resolves in that file.** Reports use different schemes (`L-1`, `M1`, `K-2`, `P-6`). An ID that does not occur in the cited file means the citation points at the wrong report, even when the quoted text is real somewhere else.
3. **The quote sits in a findings section.** Review reports also carry *accepted*, *praise*, *verified* and *adversarially dismissed* sections. Text lifted out of one of those is evidence **against** the proposal, not for it — read the nearest enclosing heading and record it next to the quote.
4. **An explicit absence is counter-evidence.** A report recording that it checked for the pattern and did not find it lowers the occurrence count; it never leaves it unchanged.

Record an outcome per citation:

| Outcome | Action |
|---|---|
| **verified** — quote, ID and enclosing section all check out | keep, and cite the heading alongside the quote |
| **mis-attributed** — the text is real but lives in another file or under another ID | correct the citation, then re-run checks 3 and 4 against the *correct* file before keeping it |
| **mis-classified** — the text is real and in the cited file, but under an accepted/praise/dismissed heading | drop the citation and subtract it from the occurrence count |
| **unsupported** — no verbatim match anywhere in the evidence base | drop the citation, and drop the **whole proposal** with it: evidence that was reconstructed rather than read makes its remaining citations untrustworthy too |

Then **re-count and re-rank**. A proposal that falls below `--min-occurrences` after verification is withdrawn before the gate — not presented with a lowered confidence, since the Step 4 ranking was computed from counts that no longer hold.

Publish the result in the proposal document: per proposal, the citations checked and their outcomes, so a reader can recompute the evidence base from the reports themselves. Report a withdrawn proposal **with its reason** rather than omitting it silently — otherwise the next run has no record that the pattern was investigated and failed verification, and will surface it again.

### Step 5: Human Approval Gate (MANDATORY)

Present the ranked proposals as a compact table (title, target file, occurrences, confidence), then the full text of the top proposals.

Ask with `AskUserQuestion` which to apply — approval is **per proposal**, never all-or-nothing. Under a runtime without an interactive question primitive, print the numbered list and ask in plain text (see `pipeline/agent-runtime-access.md`).

Three categories **always** require an explicit, separately-confirmed decision and are never applied as part of a batch:

- **Edits to this skill or to `CLAUDE.md`** — a skill proposing changes to its own instructions or to the global rules. Show these last, flagged, and only apply on a standalone confirmation.
- **Anything that weakens a check** — lowering `Quality Gate Score`, raising `Review Max Rounds`, removing a review step, adding a rule suppression, relaxing a validation. These may be **surfaced** when the evidence genuinely points at an over-strict rule, but they must be labelled `⚠️ WEAKENS A CHECK` and argued explicitly. **A loop that keeps exhausting its budget is evidence that the skill needs fixing, not that the cap needs raising** — propose the cap change only when the evidence shows the *work* was sound and the *gate* was miscalibrated.
- **Edits to platform best practices** — they reach every customer on that platform. Require confirmation that the rule is genuinely universal and not this customer's preference.

### Step 6: Apply (only with `--apply` and only what was approved)

1. Apply each approved edit exactly as it was presented and approved — no silent scope expansion, no adjacent cleanup (`CLAUDE.md > Scope of Changes`).
2. After each edit, re-read the changed section to confirm it still reads coherently in context.
3. Run `pipeline/tests/run-tests.sh` when any `bin/` tool or skill structure was touched.
4. **Never commit and never push.** Report the modified files and hand off to `/commit`.

Without `--apply`, change nothing — the proposal document is the deliverable.

### Step 7: Save the Proposal Document

Unless `--dry-run`, save the full analysis to:

```
pipeline/customers/<customer>/skill-improvements/<YYYY-MM-DD>-skill-improvements.md
```

Create the directory if needed. **Never write it to `logs/`** — that directory is reserved for execution logs and every `*.json` in it is schema-validated (`CLAUDE.md > Data Remediation`).

Structure: evidence base and caveats → ranked proposal table → full proposals → citation-verification result per proposal (Step 4.5), including any withdrawn ones and why → applied/deferred/rejected status per proposal → open questions.

Note in the document which proposals were applied, so the next run does not re-propose them. Before proposing, **read the previous document in that folder** and skip patterns already rejected there, unless new evidence materially strengthens the case — re-proposing something the user already declined is noise.

### Step 8: Log Execution

ALWAYS write the execution log with `pipeline/bin/log-skill` — never hand-author the JSON:

```bash
pipeline/bin/log-skill --skill improve-skills --identifier <YYYY-MM-DD | skill filter> \
  --status <success|partial|failed> \
  --preferred-runtime claude-code \
  --summary "<1–2 sentence result>" \
  --artifact <proposal doc path> --artifact <each applied file> \
  --check "citations:<pass|fail|unchecked>:<proposal doc path>" \
  --output "<full run text>"
```

The `citations` check is the Step 4.5 verdict over the run as a whole: `pass` only when every citation in every presented proposal verified, `fail` when any proposal was dropped or corrected, `unchecked` when the evidence files could not be re-read. It is a mandatory check — per `CLAUDE.md > Quality Gate & Loop Engineering` rule 2a a `fail` or `unchecked` here is not a pass, and a run that presented unverified citations caps its status at `partial`.

This skill analyses loops but does not run one, so it writes **no** `loop` object — omit the loop flags entirely rather than passing `not-applicable`.

## Important Rules

1. **Evidence or silence** — every proposal cites concrete logs or report sections, and every citation is verified against the file it names (Step 4.5) before it reaches the gate. A pattern below `--min-occurrences` is not reported as actionable, however plausible it sounds. Never invent a trend to justify an edit, and never quote a finding you have not just re-read: a plausible paraphrase of what a report *should* have said is a fabrication, not evidence — and it is indistinguishable from a real quote by the time it reaches the user.
2. **Propose, never impose** — no file is modified without explicit per-proposal approval, and never with `--dry-run`. This skill never commits, never pushes, never opens a PR.
3. **Never weaken a check to make numbers look better** — the point is fewer real findings, not fewer reported ones. Gate thresholds, review steps, and validations may only be relaxed through an explicitly flagged, separately-confirmed proposal.
4. **Stay inside the harness** — targets are skills, conventions, best practices, domain and stack config. Never propose edits to customer application code; a code change is `/implement-us`'s job.
5. **Respect the precedence rules** — `CLAUDE.md > Coding Standards`. A customer convention cannot waive a correctness, security, or governor-limit rule.
6. **Platform- and customer-agnostic** — read `Platform` and all paths from config; never hardcode a customer name, a platform, or an org-specific value. A proposal derived from one customer's logs must be scoped to that customer's documents unless the evidence shows the rule is universal.
7. **No AI attribution and no pipeline references in customer-visible output** — proposal documents live in the customer's **config** repo (no customer access) and may reference skills freely; anything destined for the main repo, Jira, or Confluence may not (`CLAUDE.md > Global Rules`).
8. **Small, reversible edits** — prefer several narrow proposals over one sweeping rewrite. A proposal that rewrites a whole skill is almost always mis-scoped.

## Error Handling

- **No logs found** — report that the evidence base is empty and stop. Do not fall back to reviewing skills by reading them: that produces opinion, not evidence, and this skill's entire value is that its proposals are grounded.
- **Logs exist but none carry a `loop` object** — proceed with the status/summary/report evidence, and report the missing loop data as its own finding (looping skills should record it; see `CLAUDE.md > Quality Gate & Loop Engineering`).
- **Malformed log files** — skip with a warning, name the files, and continue. Report how many were skipped, since they narrow the evidence base.
- **Code Review path missing or empty** — continue with logs alone and say so; review reports are the richest source, and conclusions are weaker without them.
- **The path holds files but the glob matches none (or far fewer than there are review-skill logs)** — report it as a defect in this skill's evidence glob, naming both counts, and continue on the evidence that did match. Staying silent here presents "the customer has no review reports" as a finding, which is the one conclusion the evidence cannot support.
- **A cited evidence file cannot be read** — the citation is `unchecked`, never verified. Drop the proposal if it has no other verified citation, and record the unreadable path; a citation that could not be checked is an open question, not a pass.
- **A proposal's target file cannot be read** — report the proposal as blocked with the reason rather than guessing at its content.
- **`--apply` given but an edit no longer matches** (the file changed since analysis) — abort that edit, report it, and continue with the rest. Never force a fuzzy match.
