---
name: analyze
description: Analyze requirements and the codebase before creating stories, producing a reviewed concept dossier with evidence and a proposed story split; read-only, creates no tickets
argument-hint: "<topic-slug> [--from-transcript <path>]..."
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

## When to Use / When NOT to Use

- Use for requirements, feasibility, codebase exploration, sizing and a story split **before** tickets exist. Input is one or more transcripts or the current chat.
- An existing story needs story-specific design: use `/design-us`.
- Create stories directly without prior analysis: use `/create-us`.
- A business decision paper with options and effort: use `/decision-paper`.

## Configuration

Read `pipeline/customer.domain.md` (business rules, glossary, field pitfalls), `pipeline/stack.config.md` (source path, naming conventions, org aliases, functional domains), `pipeline/customer.config.md` (`Platform`, `Short Name`, `Documentation Language`, `Story Language`, `Project Key`, `## Folder Paths > Concepts`, `Meetings Folder`, `Transcript Input`). Read `pipeline/coding-conventions.md` and `pipeline/platforms/<Platform>/best-practices.md` only if they contain rules.

**Platform Adaptation:** Salesforce analysis may need SOQL and metadata reads with the `sf` CLI (read-only, `sf data query`, `sf project retrieve start` into a scratch folder). Other platforms use the equivalents from `stack.config.md`. This skill never deploys, never runs DML, never creates tickets.

## Concept dossier (inline contract)

`<concept-dir>` = the **Concepts** path from config with `<topic-slug>` substituted, relative to the main repository root (e.g. `concepts/loyalty-deactivation/`). Layout:

```
concepts/<topic-slug>/
├── concept.md                       ← the dossier (structure below)
├── inputs/                          ← copies or extracts of transcripts and chat statements used
├── data/                            ← every system query result as CSV/JSON, one file per query
├── concept-review-round-<n>.md      ← raw review output per round
└── knowledge-impact.txt             ← docs grep result, if a knowledge base exists
```

Conventions:

- **Requirement IDs** `R01`, `R02`, … stable across revisions; never renumber, mark dropped ones as `withdrawn`.
- **Story IDs** `S01`, `S02`, … stable across revisions; a merged story keeps the lower ID, a split creates new IDs.
- **Header fields** in `concept.md`: `Topic`, `Status` (`ACTIVE` | `STORIES_CREATED` | `DESIGNED` | `ARCHIVED`), `Readiness` (`DRAFT` | `READY`), `Revision` (integer, +1 on every content change), `Baseline` (main-repo commit, config file versions, query timestamps), `Split confirmed` (revision number the user confirmed, or `none`).
- **Design-deferred question:** a technical detail whose answer does not change scope, sizing or the story split (field type, exact flow structure, naming). It is assigned to an owning story ID and carried into that story's notes. Business ambiguities, conflicting rules and unclear volumes are never design-deferred.
- **Freshness rule:** before any consumer (`/create-us`, `/design-us`) reuses the concept, compare the baseline with the current state: main-repo commits touching the affected components, changes to `customer.domain.md` / `stack.config.md`, and the age of query data. Relevant drift → new revision and a new review round; unrelated drift → note why it does not matter.
- **Readiness:** `READY` only after a review round with no open Blocker or Major, no blocking business question, and a split confirmed for the current revision. Any content change resets `Readiness` to `DRAFT` and increments `Revision`.

## Workflow

### Step 0: Parse arguments and resolve the dossier

Parse one required kebab-case `topic-slug` and optional repeatable `--from-transcript <path>`. Reject missing values and unknown flags. Resolve `<concept-dir>`; if `Concepts` is missing from config, stop and say which key to add. Create the folders only after resolution.

If `concept.md` already exists, read it first and continue as a new revision, preserving requirement and story IDs and the Q&A history. Ask only when it is unclear whether the user means a different topic.

### Step 1: Capture requirements

Choose the input mode without asking for what the chat already contains:

1. **Transcript:** read every supplied file. Markdown and text directly; `.docx` via `textutil -convert txt -stdout <file>`; `.xlsx` via `openpyxl`; PDF via an available extractor. Verify the extraction produced readable text; never interpret binary content. Copy the extracted text to `inputs/`.
2. **Chat context:** carry forward the requirement and settled answers from the conversation; save the relevant statements to `inputs/chat-<YYYY-MM-DD>.md`.
3. **Dialogue fallback:** with neither, ask the user to describe the requirement and wait. Never invent scope from the slug.

Synthesise functional requirements with IDs, business rules, technical hints, expected volumes and constraints. Distinguish input facts, verified codebase facts, open questions and proposed assumptions.

### Step 2: Explore the codebase broadly

Identify affected components, similar patterns, naming conventions, complexity, dependencies, cross-component effects and execution order. Cross-check `customer.domain.md`. Record source paths with line references and the baseline (commit, dirty files, config versions, query targets and timestamps).

**Knowledge-base impact:** if `pipeline/customers/<customer>/docs/*.md` exists, grep it for the affected component API names and save the hits to `<concept-dir>/knowledge-impact.txt`; read every hit before designing. No docs folder → note "no knowledge base" and continue.

Save every system query result under `data/` and reference it from the concept together with its completeness limits.

### Step 3: Clarify the requirements

Ask related questions in batches of at most four per `AskUserQuestion` call. Business ambiguities, conflicting rules and unclear volumes must be resolved before readiness. Technical details may be design-deferred per the definition above. Record every Q&A with its rationale and, once the split exists, the owning story ID. Do not re-ask settled questions unless evidence contradicts the answer.

### Step 4: Propose the story split

Vertical slices, Mini-MVP principle: every story delivers something a user can verify after deployment; never split by technical layer. Normally 1–5 days per slice. Give each story a stable ID, user value, scope, draft acceptance criteria, mapped requirement IDs, affected components, effort range with rationale, dependencies and risks. Include delivery order, parallelisable work and a total effort range with shared work counted once. Ask the user to accept or adjust; record the confirmation against the current revision. No tickets are created here.

### Step 5: Write concept.md

Write `<concept-dir>/concept.md` in the **Documentation Language** with this structure:

```markdown
# Concept: <Topic>

**Topic:** <slug> · **Status:** ACTIVE · **Readiness:** DRAFT · **Revision:** <n> · **Split confirmed:** <rev|none>
**Baseline:** <commit>, <config versions>, <query timestamps>

## Inputs
## Requirements            (R01.. with source and status)
## Business Rules and Constraints
## Codebase Analysis       (components, patterns, file:line evidence, data/ references)
## Resolved Questions      (# | question | answer | rationale | owning story)
## Open Questions          (# | question | blocking? | proposed default)
## Design-Deferred Questions (# | question | owning story)
## Proposed Story Split    (S01.. table: value, scope, ACs, requirements, components, effort, dependencies, risks)
## Delivery Order and Total Effort
## Knowledge-Base Impact
## Concept Review          (rounds, findings by severity, dispositions, gate result)
## Revision History
```

Use `None` for genuinely empty sections and explain unavailable evidence. No pipeline paths or skill names in the file.

### Step 6: Independent review (gated loop)

1. Dispatch one read-only review via the `Agent` tool (fresh general-purpose agent): *"Review `<concept-dir>/concept.md`. Read the referenced source files, `pipeline/customer.domain.md`, `pipeline/stack.config.md` and the files under `data/`. Do not modify anything. Assess four dimensions: requirement fidelity against `inputs/`; codebase analysis correctness (named components exist and behave as described); story split quality (vertical slices, sizing, dependencies, double counting); completeness (every requirement mapped to a story, every blocking question listed). Return at most 4 KB: findings with severity Blocker / Major / Minor / Info, dimension, location, one-sentence fix; then a per-dimension assessed / not assessed line."*
2. Save the raw output as `concept-review-round-<n>.md`.
3. **Triage every finding:** accepted and applied; rejected only with a citable evidence anchor (`file:line`, a `data/` file, a config section, an input statement); deferred → into Open or Design-Deferred Questions. Deferred Blockers and Majors count as open.
4. **Gate:** open Blocker or Major → apply fixes, increment the revision, re-review (max **3** rounds). Still open after round three → stop, list the open findings, keep `Readiness: DRAFT`, report `partial`. A dimension the reviewer did not assess counts as one open Major.
5. Record rounds, counts, dispositions and the gate result in `## Concept Review`. If the review agent errors, record it as errored, keep DRAFT, report `partial`; never fabricate findings.

### Step 7: Resolve remaining questions and set readiness

Present each remaining blocking question one at a time with context, impact and a proposed answer; wait for the response. Changes increment the revision and return to Step 6. Set `Readiness: READY` only with a passing gate for the current revision, no blocking question, and a confirmed split for that revision.

### Step 8: Report and log

Report path, revision, readiness, story proposals with effort, resolved and open questions, review rounds and gate result. Recommend `/create-us <epic-id> --concept <topic-slug>` only for READY concepts; otherwise name the missing decisions or evidence.

Create `<YYYY-MM-DD>-<customer-short-name>-<topic-slug>-analyze.json` in `.claude/skills/00-analyze/logs/` per the CLAUDE.md JSON schema. `summary` starts with `[readiness=DRAFT|READY] [revision=<n>] [review=<rounds> rounds, <open> open] [stories=<n>]`; `artifacts` lists concept.md, inputs, data files and review files. Status `success` only when READY; `partial` when DRAFT after a stopped gate or errored review; `failed` when no concept was written.

## Important Rules

- Read-only towards systems and repositories: no deployment, no DML, no ticket creation.
- Every number in the concept (volumes, counts) references a `data/` file with query and timestamp.
- Never report a stopped review gate as clean; readiness is earned, not declared.
- Stable IDs: never renumber requirements or stories.
- No internal paths or skill names in `concept.md`.

## Error Handling

- **Concepts key missing in config:** stop before writing; name the key.
- **Transcript unreadable:** say which file, try plain-text fallback, otherwise ask for a readable export.
- **Org unreachable for queries:** mark the affected numbers as unverified and continue.
- **Review agent errors:** record as errored, keep DRAFT, log `partial`.
- **User cancels:** keep what is written, log `partial` with the last completed step.
