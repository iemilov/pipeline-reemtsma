---
name: analyze
description: Analyze requirements and the codebase before creating stories, producing a reviewed concept with evidence and a proposed story split
argument-hint: "<topic-slug> [--from-transcript <path>]"
preferred-runtime: claude-code
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

> **Runtime hint:** This skill prefers `claude-code` for requirements synthesis.
> Resolve customer overrides and print any mismatch warning per
> `pipeline/agent-runtime-access.md` §1a. Continue under the active runtime;
> record `active_runtime`, `preferred_runtime`, and `runtime_match` in the log.

## When to Use / When NOT to Use

- Use for requirements, feasibility, codebase exploration, sizing and a story
  split **before** tickets exist. Input can be a transcript or the current chat.
- An existing story needs story-specific design: use `/design-us`.
- Execute a transcript's `## Claude Tasks`: use `/process-transcript`.
- Create stories directly without prior analysis: use `/create-story`.

## Related Skills

| Need | Use instead | Why |
|------|-------------|-----|
| Story-specific implementation notes | `/design-us` | Refines an existing story. |
| Direct story creation | `/create-story` | Can consume this concept or transcripts. |
| Execute transcript tasks | `/process-transcript` | Owns task routing and results. |
| Check a business project's documents | `/verify-docs` | Checks INDEX and cross-references. |

## Configuration and adaptation

Read `pipeline/customer.domain.md` (primary business rules and glossary),
`pipeline/stack.config.md`, `pipeline/customer.config.md`,
`pipeline/coding-conventions.md`, and
`pipeline/platforms/<Platform>/best-practices.md`. Read the shared contract at
`pipeline/.claude/skills/00-analyze/references/concept-contract.md` and use it
for paths, evidence, revisions, readiness and later consumption.

**Platform Adaptation:** Resolve Platform with `pipeline/bin/config "Platform"`.
Describe what needs investigating; derive commands, component types and source
roots from stack.config.md. Salesforce may require SOQL/metadata reads; other
platforms may require dependency, route or persistence analysis. Do not run
Salesforce commands on another platform. All system access here is read-only;
no deployment, DML or story creation is part of this skill.

**Runtime Adaptation:** Follow `pipeline/agent-runtime-access.md` for logical
operations, user questions and independent review dispatch. Use the active
runtime's question facility (respect its question limit); do not assume
`AskUserQuestion`, Agent or a particular CLI is available. Read Atlassian data
through `pipeline/atlassian-access.md` only when required by the input/context.
Markdown story backends require no Jira access.

## Workflow

### Step 0: Parse arguments and resolve the dossier

Parse one required kebab-case `topic-slug` and optional repeatable
`--from-transcript <path>` inputs; reject missing flag values and unknown flags.
Use chat context when no input file was supplied. Resolve `<concept-dir>` with
`pipeline/bin/concept-path <topic-slug>`; stop on configuration errors before
writes. Create the dossier folders only after successful resolution.

If the concept already exists, read it first. Continue as a new content revision
when updating the same topic, preserving history and story mappings; ask only
if it is unclear whether the user intends a different topic/new slug.

### Step 1: Capture requirements

Choose the input mode without asking for information already in the chat:

1. **Transcript:** Read all explicitly supplied files. Use available format
   readers: Markdown/text directly, DOCX via `textutil` on macOS or an available
   DOCX reader, XLSX via `openpyxl`, PDF via an available PDF extractor. Verify
   extraction succeeded; never interpret unreadable binary files as text.
2. **Chat context:** Carry forward the requirement and settled answers from the
   conversation. Persist the relevant source statements for the reviewer.
3. **Dialogue fallback:** If neither has requirements, ask the user to describe
   the requirement and wait. Do not invent scope from the topic slug.

Synthesize functional requirements with stable requirement IDs, business rules,
technical hints, expected volumes and constraints. Distinguish input facts,
verified codebase facts, open questions and proposed assumptions. Preserve
inputs and query evidence according to the shared contract.

### Step 2: Explore the codebase broadly

Identify affected components, similar patterns, naming conventions, complexity,
dependencies, cross-component effects and execution order. Cross-check domain
knowledge. Record source paths/lines and the analysis baseline: commits, dirty
content snapshots, source/config versions and query targets/timestamps.

Run `pipeline/bin/knowledge-impact <component names or paths>` and save its
output to `<concept-dir>/knowledge-impact-<run-id>.txt`. Read every affected
topic document; include relevant rules and anticipated documentation impact.
`impact=0` is a valid result; a failed command is an unchecked analysis step,
not a zero. Save every system query's result as CSV/JSON under `data/` and
reference it in the concept, together with completeness limitations.

### Step 3: Clarify the requirements

Ask related questions in small batches supported by the runtime (at most four;
use a lower limit if required). Business ambiguities, conflicting rules and
unclear volumes that influence scope/sizing must be resolved before readiness.
Technical details may be deferred to design only under the shared contract's
`design-deferred` definition. Record all Q&A, rationale and owning story IDs
once the split is available. Do not re-ask settled questions unless evidence
contradicts the answer.

### Step 4: Propose the story split

Use `/create-story` Step 2b's vertical slices and Mini-MVP principle, normally
1–5 days per slice. For non-UI capabilities describe a verifiable consumer
benefit instead of forcing an artificial UI. Give each story a stable `S01`,
`S02`, … ID, user value, scope, draft user-facing ACs, mapped requirement IDs,
affected components, effort range with rationale, dependencies and risks.
Include delivery order, parallelizable work and a total effort range, separating
shared work so it is not counted twice. Ask the user to accept or adjust the
split; bind confirmation to the content revision. No tickets are created here.

### Step 5: Write concept.md

Write `<concept-dir>/concept.md` using `references/concept-template.md` next
to this skill. Remove template placeholders; use `None` for genuinely empty
sections and explain unavailable evidence. Initial `Status` is `ACTIVE`,
`Readiness` is `DRAFT`. Keep progress independent from readiness on subsequent
revisions. Link all inputs, query results and codebase evidence.

### Step 6: Review, score and gate

This step and Step 7 are one bounded loop governed by `quality-gate`.

1. Resolve and check the reviewer with `pipeline/bin/review-runtime` and
   `pipeline/bin/review-runtime --check`. Follow §2a of
   `pipeline/agent-runtime-access.md`: configured cross-runtime reviewer if
   present, otherwise independent same-runtime review. If the configured runtime
   is unavailable use the documented fallback, recording the reviewer actually
   used. Never replace independent review with a claim of self-approval.
2. Freeze the round's concept and evidence under `review-inputs/<run-id>/round-<n>/`
   using the shared contract. Use a unique run ID in artifact filenames (for
   example `concept-review-<run-id>-round-<n>.md`); the shorter filenames below
   describe one run. Compose the prompt from
   `pipeline/briefs/concept-review-brief.md`, filling all placeholders, and
   dispatch read-only using §2a's background/progress/liveness contract.
   The host owns file writes and dispositions; the reviewer only reports.
3. Persist raw output in `concept-review-round-<n>.md`. Triage every finding:
   accepted and applied, rejected with a citable evidence anchor, or deferred.
   Deferred Blocker/Major and rejection without evidence remain open. Record
   every failed/unchecked mandatory check as at least one Major in the
   corresponding rubric category, including missing review coverage and
   blocking questions. Do not count the same check twice if already a finding.
4. Apply changes and collect required user decisions in Step 7. Any change to
   reviewed content requires another independent review; even if an applied
   finding would make the old round's score clean, add an open Major for the
   still-unchecked revised content to that round's published findings. This
   prevents an old-input pass from closing the loop after an edit.
5. Save dispositioned JSON valid against
   `pipeline/schemas/review-findings.schema.json` as
   `concept-review-round-<n>.findings.json`. Score **once per round, after
   triage**, and preserve the output:

   ```bash
   pipeline/bin/score-rubric --rubric concept-review \
     --findings <concept-dir>/concept-review-round-<n>.findings.json \
     --out <concept-dir>/concept-review-round-<n>.score.txt
   ```

   | Category | Weight | Blocker deduction | Major deduction |
   |----------|--------|-------------------|-----------------|
   | Anforderungstreue | 30 | 15 | 5 |
   | Codebase-Analyse | 25 | 12 | 5 |
   | Story-Split-Qualität | 25 | 12 | 5 |
   | Vollständigkeit | 20 | 10 | 4 |

   Minor/Info deduct zero; floor each category at zero. The canonical matrix
   is `pipeline/rubrics/concept-review.rubric.json`; never sum scores in prose.
   Bands: green ≥90, yellow 70–89, red <70. Every axis needs truthful coverage;
   `verdict=incomplete` means unmeasured axes, not full marks.
6. Take `blockers=` and `majors=` mechanically from that score report, then run:

   ```bash
   pipeline/bin/quality-gate --round <n> --blockers <count> --majors <count> \
     --score <score> --prev-score <previous-score>
   ```

   Omit `--prev-score` on the first round or if either score is unknown; omit
   `--score` when unknown. Save stdout as `concept-review-round-<n>.gate.txt`.
   Branch on `decision=pass|continue|stop`, not on a subjective verdict:
   `continue` reviews the updated input in the next round; `stop` preserves
   the unresolved findings, `DRAFT` and at most `partial` status. A score that
   does not improve triggers the existing no-progress brake. Do not reset
   rounds to escape that brake. Unknown coverage is a mandatory-check Major,
   so it cannot silently pass through the score-unmeasured path.
7. Write `Concept Review`: snapshot/revision/hash, reviewer, round history,
   findings/score/gate paths, gate outcome and exit reason, disposition evidence
   and split confirmation. `pass` permits readiness only for unchanged reviewed
   content with all shared-contract conditions satisfied.

If review dispatch fails even after fallback, record an unchecked mandatory
review, keep DRAFT and report `partial`. Never fabricate findings, a score or a
gate artifact. If no scoring/gate ran, log `exit_reason=not-applicable` and omit
the nonexistent score report.

### Step 7: Resolve remaining questions and finalize readiness

Present each remaining question from analysis or review **one at a time**, with
context, impact and an optional proposed answer; wait for the response. Do not
reopen a technical question whose deferral was already agreed unless new
evidence changes its impact. Update
resolved/open question tables after each answer. Changes increment the content
revision and invalidate readiness. Batch answered changes before the next
review, keeping Step 6's round budget. Confirm changed story splits; carry a
prior confirmation only when the split is demonstrably unchanged.

Return to Step 6 after content changes. Set READY only after a complete review
and a passing gate for the final unchanged input, no blocking questions and a
confirmed split. Design-deferred questions remain visible for their stories.

### Step 8: Integrate into an existing business project when applicable

Use an explicitly identified project or an unambiguous existing INDEX mapping;
do not guess from a similar slug. Add a concept reference to that project's
INDEX according to its existing conventions, then run `/verify-docs` for that
project. Keep the dossier at the configured concept path. If integration alters
concept content, return to Step 6 with the same loop budget before reporting
readiness. An unperformed required document check is reported as unchecked.

### Step 9: Report and log

Report topic/path, revision, readiness/progress, story proposals, resolved/open
questions and actual review score/band/gate. Recommend
`/create-story <epic-id> --concept <topic-slug>` only for READY concepts;
otherwise name the missing decisions/evidence. A failed or stopped review is
never success. No-story analyses report their result without a creation handoff.

Always write the execution log with `pipeline/bin/log-skill`, in
`pipeline/customers/<customer>/logs/`:

```bash
pipeline/bin/log-skill --skill analyze --identifier <topic-slug> \
  --status <success|partial|failed> --preferred-runtime <resolved-preference> \
  --summary "<result>" --artifact <concept-dir>/concept.md \
  --knowledge-impact-file <existing-report-path> \
  --iterations <rounds> --verifier bin/quality-gate --exit-reason <reason> \
  --score-report-file <last-existing-score-report> --output "<run-result>"
```

Repeat `--artifact` for each produced source/evidence/review file. Only pass
report paths that exist; log failed/unchecked mandatory checks with `--check`.
The last dispositioned findings file must reproduce the logged score/counts.
