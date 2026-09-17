---
name: create-story
description: Create one or more user stories from meeting transcripts or a READY concept (interactive). Produces the story text for the user to create in Jira, or creates the issues on explicit confirmation; writes DRAFT implementation notes per story. Supports Jira or local Markdown as story backend (see config)
argument-hint: "[epic-id] [--concept <slug>] [--create-in-jira]"
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

## Configuration

Read `pipeline/customer.config.md` (`Project Key`, `Components`, `Epic Link Field`, `Cloud ID`, `Story Language`, `Documentation Language`, `Platform`, `## Folder Paths > Transcript Input`, `Implementation Design`, `Concepts`, `Meetings Folder`, `## Story Backend`), `pipeline/stack.config.md` (naming conventions, functional domains, API version) and `pipeline/customer.domain.md` (business logic, glossary, field pitfalls).

**Paths** (relative to the main repository root, never under `pipeline/`):
- `<notes-dir>` = **Implementation Design** path with `<story-key>` substituted, e.g. `implementation-design/AP2-1590/`. While a story has no key yet, notes go to `implementation-design/_drafts/<story-slug>/` and are moved once the key exists.
- `<concept-dir>` = **Concepts** path with `<topic-slug>` substituted, e.g. `concepts/loyalty-deactivation/`.

> **Platform note:** story patterns and technical hints reference Salesforce tooling. For another `Platform`, use the equivalents from `stack.config.md`.

## Ticket creation policy

**Default: this skill writes the story text; the user creates the tickets in Jira.** Each story is printed as a ready-to-paste block (title, description in the Story Language, component, epic). The skill calls `createJiraIssue` only when the user passes `--create-in-jira` **or** explicitly confirms creation in Step 3 for that run. Never create tickets silently.

## Story Backend Adaptation

- **`jira` (default):** epic and stories via the Atlassian MCP tools (`getJiraIssue`, `searchJiraIssuesUsingJql`, `createJiraIssue`, `editJiraIssue`) with the **Cloud ID** from config; epic linking via the **Epic Link Field** (`parent` on Cloud).
- **`markdown`:** stories are files in the **Stories Path** with keys `<Story Key Prefix>-<N>` and this format:

  ```markdown
  ---
  key: <PREFIX>-<N>
  title: <Story Title>
  status: Open
  component: <Component>
  epic: <Epic name>
  priority: <Low | Medium | High>
  created: <YYYY-MM-DD>
  dependencies: []
  ---

  # <PREFIX>-<N> — <Story Title>

  ## User Story
  ## Background
  ## Requirements
  ## Acceptance Criteria
  ## Dependencies
  ```

## Workflow: Transcript or Concept → User Stories

### Step 0: Parse arguments

Parse the epic identifier, `--concept <slug>` and `--create-in-jira`. Reject unknown flags. `$ARGUMENTS` below means the parsed epic identifier. For `jira` an epic key is required before any ticket creation; ask if missing. For `markdown` the argument is the epic name.

### Step 1: Gather context

**With `--concept <slug>`:** read `<concept-dir>/concept.md`. It must be `Readiness: READY` with a split confirmed for its current revision; otherwise stop and say what is missing (run `/analyze` first). Apply the concept's freshness rule: compare its baseline with the current repository and config; on relevant drift stop and ask for a new revision. Load requirements, story proposals (`S01`..), draft acceptance criteria, resolved Q&A and design-deferred questions. If the concept already lists created story keys (`Status: STORIES_CREATED`), only create the missing ones. No transcript folder is needed.

**Without `--concept`:**
- `jira`: fetch the epic with `getJiraIssue`; read every file in the **Transcript Input** folder for the epic (`.docx` via `textutil -convert txt -stdout`, `.xlsx` via `openpyxl`, Markdown and text directly). Abort if the folder is missing or empty.
- `markdown`: read the `.md`, `.docx` and `.xlsx` files in the **Meetings Folder**; use any `## Claude Tasks` sections as pre-identified requirements.

Synthesise functional requirements, technical details, acceptance criteria and volume or configuration data. Cross-check `customer.domain.md` for terms and rules.

### Step 2: Propose the story split (interactive)

With a concept, present its split as the starting proposal and keep the stable story IDs; carry prior answers and a confirmed split instead of re-asking. A changed split invalidates the concept's readiness: say so and return to `/analyze` before creating.

**2a. Team context (optional):** ask via `AskUserQuestion` how many developers will implement (1 / 2 / 3+ / skip); use it to optimise for parallel streams.

**2b. Split by MVP increments.** Every story is a vertical slice: after deployment the user can do something new in the UI. Identify user-facing capabilities, order by dependency, include data model, logic, UI, permissions and validation in the story that needs them, size 1–5 days, flag parallelisable stories. Never split by technical layer, never a permissions-only story.

**2c. Present:** number of stories, and per story title, user value, scope, dependencies, complexity, parallelisable. Then the order.

**2d. Confirm** via `AskUserQuestion`: "Does the story split fit?" — create / adjust with feedback / re-cut. Iterate until confirmed.

### Step 3: Write the stories

Only after confirmation. Tickets stay **lean**: technical scope and implementation details belong in the notes, not the ticket.

**Ticket content** (in the Story Language):
1. **User story** — As a … I want … so that …
2. **Background** — two or three sentences of context (why)
3. **Value lists / field changes** — only if defined in business terms; no API names
4. **Acceptance criteria** — testable checklist from the user's view
5. **Dependencies** — references to other stories in the epic, if known

Not in the ticket: scope sections, technical hints (Flow/Apex/LWC), pseudocode, affected-objects tables, pipeline paths, skill names.

**Delivery:**
- **Default:** print each story as a block — `Title`, `Component`, `Epic`, then the description — so the user can paste it into Jira. Ask the user to reply with the keys once created, so the notes can be placed under the right folder.
- **On `--create-in-jira` or explicit confirmation** (ask once via `AskUserQuestion`: "Create these <n> stories in Jira now?"): `createJiraIssue` per story with project key, issue type Story, summary (max 70 chars), description, component from config, and the epic link. Record every returned key immediately; on a failure keep the created keys, show the error, and offer to retry the remaining stories. Then run `searchJiraIssuesUsingJql` with `parent = <epic>` to confirm the created set before writing notes. Never use a title match to decide whether a story already exists.
- `markdown`: determine the next key by scanning `<Stories Path>/<PREFIX>-*.md`, create the folder if missing, write one file per story.

### Step 3.5: Resolve open questions (interactive)

With a concept this runs before Step 3 (blocking questions invalidate readiness); with transcripts it runs after Step 3 and before the notes.

**Business questions (mandatory):** scope ambiguities, acceptance criteria open to interpretation, unclear volumes or frequencies, undefined business terms, unclear ownership between stories, conflicts with `customer.domain.md`.

**Technical questions (optional):** field types and labels, declarative vs. programmatic, UI placement, naming, exact validation logic — offer "clarify in design".

Ask in batches of at most four per `AskUserQuestion` call, with context and options, recommended option first. Skip the step silently if there are no questions. If an answer changes a story's scope or criteria, update the printed text or the Jira issue (`editJiraIssue`) or the Markdown file before continuing. Answered questions go to `## Resolved Questions`, skipped technical ones to `## Open Questions / Assumptions`.

### Step 4: Generate DRAFT implementation notes

One notes file per story at `<notes-dir>/implementation-notes.md` (or `implementation-design/_drafts/<story-slug>/` while the key is unknown; tell the user to rename the folder to the key, or do it when they report the keys in the same session):

```markdown
# Implementation Notes: <Story-Key or slug> — <Story Title>

<!-- STATUS: DRAFT — placeholder from story creation. A full design is required before implementation. -->

**Epic:** <Epic-Key>
**Story:** <Story-Key or "pending">
**Created:** <YYYY-MM-DD>
**Status:** DRAFT
**Concept:** <slug or none> · **Concept Story ID:** <S01 or none> · **Concept Revision:** <n or none>

## Summary
## Requirements
## Proposed Implementation Approach
### Salesforce Tools
### Declarative vs Programmatic
| Component | Type | Rationale |
## Affected Objects & Fields
| Object | Field / Component | Action (New/Modify/Read) | Details |
## Dependencies
## Acceptance Criteria Mapping
| # | Acceptance Criterion | Implementation Component |
## Test Scenarios (DRAFT)
| # | Scenario | Type | Expected result |
## Resolved Questions
| # | Question | Answer | Source |
## Open Questions / Assumptions
## Implementation Guidance
```

Content guidelines: Story Language for business sections, English for technical ones; real API names where known; at least one test scenario per acceptance criterion (happy path, negative, edge case), without test data presets (design resolves those); all Q&A from Step 3.5 recorded; concept fields carried over when a concept was used. The DRAFT marker and `**Status:** DRAFT` are mandatory so `/implement-us` refuses to build from them.

With a concept: update its story table with the created keys and notes state, set `Status: STORIES_PARTIAL` until every story has a key and notes, then `STORIES_CREATED`.

### Step 5: Summary

Stories written or created (keys and links, or "text provided — create in Jira and report the keys"), notes paths, dependency graph, key requirements, next step: `/design-us <story-key>` per story, starting with the one without dependencies.

Create `<YYYY-MM-DD>-<customer-short-name>-$ARGUMENTS-create-story.json` in `.claude/skills/01-create-us/logs/` per the CLAUDE.md JSON schema. `summary` starts with `[stories=<n>] [created_in_jira=yes|no] [concept=<slug|none>]`; `artifacts` lists every notes file and story file.

## Important Rules

- **Text first, tickets on confirmation.** Never call `createJiraIssue` without `--create-in-jira` or an explicit yes in this run.
- Stories in the Story Language; tickets lean; no internal paths or skill names in tickets or notes.
- Be interactive: three questions are cheaper than one wrong story.
- Stable concept IDs are preserved; a changed split goes back through `/analyze`.
- Cloud ID, project key, component and epic link field from config, never hardcoded.
- No AI attribution anywhere.

## Error Handling

- Epic not fetchable: show the error and abort.
- Transcript folder missing or empty without a concept: abort and name the folder.
- `.docx` conversion fails: try plain text, else ask for another export.
- Ticket creation fails mid-run: keep created keys and story texts, show the error, offer retry for the rest; the concept, if any, stays `STORIES_PARTIAL`.
- Markdown key conflict: increment past it.

## Story Quality Checklist

- [ ] Clear user story statement (as / I want / so that)
- [ ] Two or three sentences of background
- [ ] Specific, testable acceptance criteria from the user's view
- [ ] Value lists or field changes where applicable, in business terms
- [ ] Dependencies documented if known
- [ ] No technical scope in the ticket
- [ ] Blocking questions resolved
- [ ] Written in the Story Language
