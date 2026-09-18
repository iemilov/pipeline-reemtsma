---
name: improve-skills
description: Mine the skill execution logs and the review reports for recurring failure modes, then propose concrete, evidence-backed edits to the skills, conventions, stack config and domain knowledge they came from — as a proposal document, never as automatic edits
argument-hint: "[--skill <name>] [--days <N>] [--min-occurrences <N>] [--dry-run]"
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

## When to Use / When NOT to Use

- **Use** after a stretch of pipeline work to ask what the accumulated logs and review reports say about the **skills themselves**: which ones need several review rounds, which produce the same finding repeatedly, which fail or end `partial` for the same reason.
- **Use** when a recurring annoyance is suspected but not yet evidenced, and the history should confirm or refute it before anything is edited.
- **Do NOT use** to review code (`/code-review`, `/review-pr` produce the findings this skill mines).
- **Do NOT use** to write a new skill — follow `CLAUDE.md > Creating New Skills` directly. This skill proposes targeted edits to existing documents.
- **Do NOT use** to document the customer's domain (`/build-knowledge`).

## Configuration

Read `pipeline/customer.config.md` for `Short Name`, `Platform`, `Documentation Language` and `## Folder Paths > Code Review` (default `code-review/`). `<customer>` is the symlink target of `pipeline/customer.config.md`.

Evidence sources, all read-only:

| Source | Path | Contributes |
|---|---|---|
| Execution logs | `pipeline/.claude/skills/*/logs/*.json` | `skill`, `identifier`, `timestamp`, `status`, `summary`, `output`, and where present `checks`, `review` (rounds, counts by severity), `story_source` |
| Code and PR review reports | `<Code Review>/*-review.md` | findings with severity, `file:line`, rule cited; "checked and rejected" tables |
| Design review outputs | `implementation-design/*/design-review-*.md`, `implementation-design/*/code-review-round-*.md` | findings per round on notes and implementations |
| Skills | `pipeline/.claude/skills/*/SKILL.md` | the instructions that produced the above |

Output: `pipeline/improvements/<YYYY-MM-DD>-improve-skills.md` (create the folder if missing). Never write into a `logs/` folder.

## Workflow

### Step 0: Parse arguments

- `--skill <name>` — restrict to one skill (partial match: `implement` matches `implement-us`)
- `--days <N>` — only evidence newer than N days (default: all)
- `--min-occurrences <N>` — minimum independent occurrences before a pattern is reported (default **3**)
- `--dry-run` — analyse and print only; write no proposal file

### Step 1: Collect evidence

1. Parse every JSON log under `.claude/skills/*/logs/`. Skip malformed files with a warning naming them. Some older logs are `.txt` — read them as free text and count them separately.
2. Take per log: `skill`, `identifier`, `timestamp`, `status`, `summary`, `output`, `checks`, `review`, `story_source` where present.
3. Read every `*-review.md` under the Code Review folder and every design or code review round file under `implementation-design/*/`. Extract findings with severity, cited rule and location, and — separately — the entries of "checked and rejected" tables (rejected findings are evidence *against* a pattern).
4. Apply the `--skill` and `--days` filters.
5. **State the evidence base up front:** number of logs per skill, number of reports, date range, how many logs carry a `review` or `checks` object. A base under 10 logs, or under 3 for the filtered skill, is thin; say so, and every conclusion inherits the caveat. If a review skill has logs but the folder holds no matching reports, report that as a folder or naming mismatch, not as "no reviews happened".

### Step 2: Cluster failure modes

A pattern needs at least `--min-occurrences` **independent** occurrences (different stories or runs, not one story retried). Cluster along:

1. **Recurring review findings** — the same rule or finding type across stories.
2. **Slow convergence** — skills whose review rounds are high or rising.
3. **Non-convergence** — runs whose review gate ended open (`review-gate: fail`, "accepted by user") — read the `output` for what was still open.
4. **Repeated failures and partials** — `failed` or `partial` with similar causes; group by cause, not wording.
5. **Unchecked gates** — checks recorded `unchecked` repeatedly (a tool never installed, an org never reachable) — infrastructure gaps, not skill text.
6. **Fallback usage** — logs that state a skeleton helper fallback was used; if the same fallback appears in most runs, the helper or the skill text is the thing to fix.
7. **Logging gaps** — skills that log without `checks` or `review` objects although they run gates; report as their own finding since they weaken every other conclusion.

Per cluster: one-line description, occurrence count, the specific evidence (log file names, report sections, story keys), suspected cause.

### Step 3: Attribute each cluster to a target document

| Symptom | Likely target |
|---|---|
| steps ambiguous, out of order, or a missing check | that skill's `SKILL.md` |
| a business rule or field pitfall missed | `pipeline/customer.domain.md` or a topic document under `customers/<customer>/docs/` |
| a tool, command or alias wrong or missing | `pipeline/stack.config.md` |
| a gate passed on work that should not have | `customer.config.md > Quality Gate` — as a question to the user, never as a silent proposal |
| a step is described but no tooling exists for it | the skill text — propose implementing it, with the interface the skills expect |

Customer conventions win over platform practice on style and naming; platform practice wins on correctness, security, limits and deployability. Never propose a customer convention that waives a correctness or security rule; report it as a documentation bug instead.

### Step 4: Draft proposals

Per attributed cluster:

1. **Title** — the failure mode in one line
2. **Evidence** — occurrence count, story keys, log file names, report sections; every claim traceable to a file
3. **Suspected cause** — why the current text permitted it
4. **Proposed edit** — target file, anchor (section or step), exact old → new wording; not "clarify the deploy step" but the replacement sentence
5. **Expected effect** — which number should move (rounds, partial rate, recurrence of the finding)
6. **Blast radius** — which other skills or customers the text governs; a platform file reaches every customer on that platform
7. **Confidence** — high / medium / low from count and directness

Rank by (occurrences × severity) ÷ blast radius.

### Step 5: Verify every citation — mandatory

For every quote, finding id and file reference in every proposal:

1. The quote exists verbatim in the cited file — grep a distinctive substring against that exact path; never from memory or from an earlier summary.
2. The finding id resolves in that file (reports use different schemes: `M1`, `L-2`, `#3`).
3. The quote sits in a findings section, not under *checked and rejected*, *accepted* or *verified* — read the nearest heading and record it.
4. An explicit "checked and rejected" entry for the same pattern lowers the occurrence count.

| Outcome | Action |
|---|---|
| verified | keep, cite the heading with the quote |
| mis-attributed (real text, other file or id) | correct the citation and re-check 3 and 4 there |
| mis-classified (under a rejected or accepted heading) | drop the citation, subtract from the count |
| unsupported (no verbatim match anywhere) | drop the citation **and the whole proposal**; reconstructed evidence taints the rest |

Re-count and re-rank. A proposal that drops below `--min-occurrences` is withdrawn before the gate and listed as withdrawn with the reason, so the next run does not re-surface it.

### Step 6: Human approval gate — mandatory

Present a compact table (title, target, occurrences, confidence), then the full text of the top proposals. Ask with `AskUserQuestion` which proposals the user **accepts as proposals**; acceptance is per proposal, never all-or-nothing.

Three categories are always shown last, flagged, and confirmed separately:
- edits to this skill or to `CLAUDE.md`
- anything that **weakens a check** (raising max rounds, lowering a threshold, removing a review step, adding a suppression) — label `⚠️ WEAKENS A CHECK`; a loop that keeps exhausting its budget is evidence that the skill needs fixing, not that the cap is too low
- edits to platform best practices — reach every customer on the platform

**This skill never edits a skill, convention or config file.** Accepted proposals are marked *accepted* in the proposal document; the user applies them, or asks in a separate turn to apply a named proposal.

### Step 7: Write the proposal document

Unless `--dry-run`, write `pipeline/improvements/<YYYY-MM-DD>-improve-skills.md`:

evidence base and caveats → ranked table → full proposals → citation verification per proposal, including withdrawn ones with reason → accepted / deferred / rejected per proposal → open questions.

Before proposing, read the previous documents in `pipeline/improvements/` and skip patterns already rejected there unless new evidence materially strengthens the case.

### Step 8: Log

Create `<YYYY-MM-DD>-<customer-short-name>-<date or skill filter>-improve-skills.json` in `.claude/skills/96-improve-skills/logs/` per the CLAUDE.md JSON schema. `summary` starts with `[logs=<n>] [reports=<n>] [proposals=<n>] [withdrawn=<n>] [citations=pass|fail|unchecked]` — `pass` only when every citation in every presented proposal verified; `fail` when any was dropped or corrected; `unchecked` when evidence files could not be re-read. `fail` or `unchecked` caps the status at `partial`. `artifacts` holds the proposal document.

## Important Rules

1. **Evidence or silence** — every proposal cites files, every citation is verified against the file it names. Below `--min-occurrences` nothing is actionable, however plausible.
2. **Propose, never impose** — this skill never modifies skills, conventions, config or code; never commits; never opens a PR.
3. **Never weaken a check to improve numbers** — relaxations only as flagged, separately confirmed proposals.
4. **Stay inside the harness** — targets are skills, conventions, stack and domain config, helper interfaces. Never propose application code changes.
5. **Small, reversible edits** — several narrow proposals over one rewrite.
6. **No AI attribution** — the proposal document is internal and may name skills freely; nothing from it goes to the main repository, Jira or Confluence unchanged.

## Error Handling

- No logs found: report an empty evidence base and stop; do not fall back to reviewing skills by reading them.
- Logs without `checks` or `review` objects: proceed on status, summary and reports; report the gap as a finding.
- Malformed logs: skip with a warning, name them, report the count.
- Code Review folder missing or empty: continue with logs and design reviews; say so.
- Folder holds files but none match `*-review.md`: report the naming mismatch with both counts; continue on what matched.
- A cited file cannot be read: the citation is `unchecked`; drop the proposal if it has no other verified citation.
