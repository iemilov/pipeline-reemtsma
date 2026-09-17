---
name: create-story
description: Create one or multiple user stories from meeting transcripts (interactive). Supports Jira or local Markdown as story backend (see config)
argument-hint: "[epic-id] [--concept <slug>]"
preferred-runtime: claude-code
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`


> **Runtime hint:** This skill prefers `claude-code` (synthesis-heavy). If the active `Agent Runtime` (from `customer.config.md`) differs after applying any `## Skill Runtime Overrides`, print the standardized warning from `pipeline/agent-runtime-access.md` §1a and proceed. Record `active_runtime`, `preferred_runtime`, and `runtime_match` in the execution log.

## Configuration

Before executing, read `pipeline/customer.config.md` for customer-specific values (Atlassian Deployment Type, project key, components, epic link field, locale settings, folder paths, **Platform**, **Story Backend**), `pipeline/stack.config.md` for stack-specific values (naming prefixes, API version, functional domains), and `pipeline/customer.domain.md` for domain-specific business logic, glossary, field name pitfalls, and linked topic documentation files. For Jira calls (when `Story Backend` is `jira`), consult the **Atlassian adapter** at `pipeline/atlassian-access.md` — it defines which transport (Cloud MCP vs Data Center curl) to use based on `Deployment Type`.

> **Platform note:** This skill references Salesforce tooling (Flows, Apex, LWC, etc.) in story patterns and implementation notes. If `Platform` in `customer.config.md` is not `salesforce`, use the equivalent tools, frameworks, and component types from `stack.config.md` when writing technical hints and proposed implementation approaches.

## Story Backend Adaptation

Read `Story Backend` from `customer.config.md`:

- **If `jira` (default):** Follow all steps as written — stories are created as Jira issues via the Atlassian adapter.
- **If `markdown`:** Stories are stored as Markdown files in the **Stories Path** from config (e.g., `stories/`). Story keys use the **Story Key Prefix** from config with auto-incrementing numbers (e.g., `RH-1`, `RH-2`). All Jira API calls (Epic fetch, issue creation, epic linking) are replaced with local file operations. The Markdown story format is:

  ```markdown
  ---
  key: <PREFIX>-<N>
  title: <Story Title>
  status: Open
  component: <Component from config>
  epic: <Epic name>
  priority: <Low | Medium | High>
  created: <YYYY-MM-DD>
  dependencies: []
  ---

  # <PREFIX>-<N> — <Story Title>

  ## User Story

  Als <Rolle> möchte ich <Funktion>, damit <Nutzen>.

  ## Hintergrund

  <Context from the meeting transcript>

  ## Anforderungen

  <Requirements>

  ## Akzeptanzkriterien

  - [ ] <Criterion>

  ## Technische Hinweise

  <Implementation hints for the tech stack>

  ## Abhängigkeiten

  <Dependencies to other stories, or "Keine">
  ```

## Workflow: Transcript → User Stories (Interactive)

This skill creates well-structured Jira user stories from meeting transcripts. It supports creating **multiple stories** and uses an **interactive approach** to ensure story quality and optimal implementation readiness.

Execute the following steps for Epic **$ARGUMENTS**:

### Step 0: Parse optional concept input

Parse the optional epic identifier separately from `--concept <slug>`; reject
missing values/unknown flags. Below, `$ARGUMENTS` means the **parsed epic
identifier**, never the raw flag-bearing command line. For Jira resolve a missing
epic from already supplied context or ask before creating tickets; Markdown may
use the supplied epic name. Log the epic identifier (or concept slug if absent).

When `--concept` is present, read
`pipeline/.claude/skills/00-analyze/references/concept-contract.md`. Its rules
for paths, revisions, readiness, questions, freshness and recovery are mandatory
and take precedence over transcript-only instructions below.

### Step 1: Gather Context

#### With `--concept <slug>` (both backends)

- Resolve `<concept-dir>` through `pipeline/bin/concept-path <slug>` and read
  `concept.md`. Missing/invalid Concepts config is an error before writes.
- Load requirements, codebase analysis, stable proposed story IDs, draft ACs,
  resolved answers and all owning-story `design-deferred` questions.
- Validate readiness and review binding using the shared contract: current
  content/evidence must match the reviewed snapshot, published findings must
  reproduce the score and passing gate, no blocking decisions may remain and
  the split must be confirmed. `Status: ACTIVE` by itself permits no creation.
- Check freshness against current repositories, requirements/config and relevant
  live evidence before creating. Relevant drift requires an updated concept
  revision and review; unavailable mandatory evidence blocks new creates.
- Reconcile previous mappings even when DRAFT; ACTIVE/STORIES_PARTIAL may create
  only after READY. STORIES_CREATED/DESIGNED only reconcile/report, without new
  tickets. Hold the shared contract's exclusive local lock during recovery and
  writes; concurrent distributed creation is unsupported.
- For Jira fetch the parsed epic and validate target identity. Do **not** require
  or read a transcript input folder in concept mode: the dossier is the source.
  Skip the transcript-only branches below and continue to Step 2.

#### Without `--concept`: existing transcript input

#### If `Story Backend` is `jira`:
1. Read the Epic details from Jira via the Atlassian adapter's `getJiraIssue` operation (see `pipeline/atlassian-access.md` §3 — branch on `Deployment Type` from `customer.config.md`) with key `$ARGUMENTS`
2. Read **all files** in the **transcript input folder** from config (e.g., `business/input/$ARGUMENTS/`). Use `textutil -convert txt -stdout` for `.docx` files, `openpyxl` for `.xlsx` files

#### If `Story Backend` is `markdown`:
1. Use `$ARGUMENTS` as the Epic name (no Jira fetch needed)
2. Read **all `.md` files** in the **Meetings Folder** from config. For `.docx` files use `textutil -convert txt -stdout`, for `.xlsx` files use `openpyxl`
3. Check the `## Claude Tasks` sections in the transcripts — these contain pre-identified requirements

#### Both backends:
3. Synthesize the transcripts into structured requirements: functional requirements, technical details, acceptance criteria, and volume/configuration data

### Step 2: Propose Story Split (Interactive)

With `--concept`, present the concept's split, effort ranges, component mapping
and dependencies as the starting proposal. Preserve stable story IDs. Carry
prior answers and unchanged split confirmation instead of re-asking them.
In Step 2a use any known team context directly. If the user changes the split,
update the concept revision, confirm the changed split and return through
`/analyze` Steps 6–7 before any new story creation. Do not silently edit a READY
concept or create tickets from a split its review never assessed.

For concept mode, perform Step 3.5's scope-question check **before Step 3**.
A newly discovered blocking question invalidates readiness and returns to the
concept clarification/review loop. Design-deferred details remain in the notes.
The transcript-only workflow keeps its existing ordering.

#### 2a. Ask for Team Context (Optional)

Before proposing the split, ask the user via `AskUserQuestion`:

- **"Wie viele Entwickler setzen das um?"** — Options: "1", "2", "3+", with a description that this is optional and influences parallelizability of the split. Allow "Other" for skipping.

If answered: use the developer count to optimize the split for parallel work streams (e.g., 2 developers → aim for stories that can be worked on simultaneously with minimal blocking dependencies). If skipped: optimize purely for incremental delivery.

#### 2b. Analyze and Split by MVP Increments

**Core principle: Every story is a vertical slice / Mini-MVP.** After a story is deployed, the user can do something new in the UI that they couldn't do before. Never split by technical layer (e.g., "Data Model" in one story, "Business Logic" in another, "UI" in a third).

**How to split:**

1. **Identify user-facing capabilities** — from the synthesized requirements, list each distinct thing a user will be able to do in the UI (e.g., "Neuen Antrag erfassen", "Antrag genehmigen", "Bericht einsehen")

2. **Order by dependency** — arrange capabilities so each builds on the previous one. The first story delivers the smallest usable feature; subsequent stories extend it.

3. **Each story includes everything needed for its capability** — data model changes, business logic, UI, permissions, and validation rules. All in one story. The user should never be in a state where the backend works but nothing is visible in the UI.

4. **Sizing guideline:** 1–5 days per story. If a vertical slice is larger than 5 days, look for a meaningful sub-capability to extract. If smaller than 0.5 days, merge it into an adjacent story.

5. **Parallelizability** (if developer count was provided): When multiple developers are available, identify stories that touch different objects / UI areas and can be worked on simultaneously. Flag which stories can run in parallel vs. which must be sequential.

**Anti-patterns to avoid:**
- "Story 1: Datenmodell anlegen" / "Story 2: Logik implementieren" / "Story 3: UI bauen" — this is horizontal slicing, not MVP
- "Story 1: Permission Sets" — permissions alone deliver no user-visible value, bundle them into the story that needs them
- Stories where the user can't verify anything in the UI after deployment

#### 2c. Present the Proposal

Present the proposal in this format:

```
Ich schlage [N] Stories vor, jede ein eigenständig nutzbares Inkrement:

Story 1: [Title]
- Nutzer-Mehrwert: [Was der User nach Deployment in der UI tun kann]
- Umfang: [Datenmodell + Logik + UI-Komponenten, die dafür nötig sind]
- Abhängigkeiten: [Keine / Baut auf Story X auf]
- Geschätzte Komplexität: [Niedrig/Mittel/Hoch]
- Parallelisierbar: [Ja / Nein — nur wenn Entwickler-Anzahl bekannt]

Story 2: [Title]
...

Reihenfolge: Story 1 → Story 2 → Story 3 (Story 2+3 parallel möglich)
```

#### 2d. Confirm with User

Ask the user for confirmation using `AskUserQuestion`:
- "Passt der Story-Split so?"
- Options: "Ja, Stories erstellen", "Anpassen (ich gebe Feedback)", "Komplett neu schneiden"

Iterate if needed: revise based on user feedback and ask again.

### Step 3: Create User Stories

**Only after user approval**, create each story. Jira-Tickets sollen **knapp** sein — technischer Scope und Implementierungsdetails gehören ausschließlich in die Implementation Notes, nicht ins Ticket.

**Concept-mode recovery (both backends):** Follow the shared contract's
Creation and recovery sequence. Persist each stable ID and creation reference
before writes; write `creating` before a backend request and `created` with its
key immediately after acknowledgement. Recover uncertain/unfinished requests
by exact backend reference before any retry; zero search results after an
uncertain create are not proof of absence. Multiple matches or scope/target
mismatches block creation. Never rely on a title to identify an existing story.
Use a configured searchable Jira field or a neutral `Concept reference` entry
on the initial create; Markdown stores `concept_reference` in frontmatter and
uses exclusive file creation after reference reconciliation. Keep every returned
key even if later stories fail. Existing tickets need only missing notes; never
replace their FINAL notes. Update progress as STORIES_PARTIAL until all agreed
rows and notes are complete; only then STORIES_CREATED. Release only this run's
local lock after its final state update. A duplicate completed call is a no-op
apart from reconciliation/reporting.

**Story-Inhalt (Jira-Description):**

1. **User Story** (Als ... möchte ich ... damit ...)
2. **Hintergrund** — 2-3 Sätze Kontext aus den Transkripten (warum wird das gebraucht?)
3. **Werteliste / Feldänderungen** *(nur falls zutreffend)* — Tabelle mit neuen Picklist-Werten, geänderten Feldern, neuen Objekten o.ä. Nur auflisten was fachlich definiert ist, keine technischen API-Namen.
4. **Akzeptanzkriterien** — Checkliste (testbar, aus User-Sicht)
5. **Abhängigkeiten** *(nur falls bekannt)* — Verweis auf andere Stories im Epic

**Nicht ins Ticket:**
- Kein "Scope" / "Umfang" — steht in den Implementation Notes
- Keine technischen Hinweise (Flow/Apex/LWC) — steht in den Implementation Notes
- Keine Business Logic als Pseudocode — steht in den Implementation Notes
- Keine Affected Objects & Fields Tabelle — steht in den Implementation Notes

#### If `Story Backend` is `jira`:

- Create Jira issues via the Atlassian adapter
- Link to Epic using the **epic link field** from config (e.g., `additional_fields: {"customfield_10014": "$ARGUMENTS"}`)
- Set component based on context using the **components** from config

#### If `Story Backend` is `markdown`:

- **Determine the next story key** — scan existing files matching `<Stories Path>/<Story Key Prefix>-*.md`, find the highest number, increment. If no stories exist, start at 1
- **Create the `Stories Path` directory** if it doesn't exist
- **Write each story file** at `<Stories Path>/<story-key>.md` following the Markdown story format defined in *Story Backend Adaptation* above

#### Both backends:

- Use descriptive titles (max 70 characters)
- Output text in stories uses the **story language** from config
- Reference other stories in the epic for dependencies

### Step 3.5: Resolve Open Questions (Interactive)

For concept input this check runs before Step 3; for transcript-only input it runs after story creation and before generating notes. Review the synthesized requirements for **open questions** — ambiguities whose answers would affect the story content, acceptance criteria, or implementation approach.

#### Fachliche Fragen (MANDATORY)

These must be resolved before proceeding to Step 4:
- A requirement from the transcript is ambiguous about scope (is feature X included or not?)
- Acceptance criteria could be interpreted in multiple ways
- Volume, frequency, or performance expectations are unclear but affect the approach
- A business term from the transcript has no clear definition in `customer.domain.md`
- Dependencies between stories are unclear (which story owns what?)
- Business rules from `customer.domain.md` conflict with or are not addressed by the story

#### Technische Fragen (OPTIONAL)

These are offered to the user but can be skipped ("Klären wir im Design"):
- Field types, lengths, or labels not specified in the story
- Declarative vs programmatic approach (Flow vs Apex)
- UI layout specifics (page layout, flexipage, LWC placement)
- Naming and API name choices
- Exact validation rule logic

#### How to ask

1. **Batch related questions** — group questions by story and present them together using `AskUserQuestion` (up to 4 questions per batch). For technical questions, add a "Klären wir im Design" option.
2. **Provide context and options** — for each question, explain why it matters and offer concrete options where possible. Put the recommended option first.
3. **Iterate if needed** — if an answer raises follow-up questions, ask those before proceeding.
4. **If no questions exist**, skip this step silently — do not ask a meta-question like "Gibt es offene Fragen?"

#### Record answers

- If an answer changes the story scope or acceptance criteria: **update the affected Jira ticket or Markdown file** before proceeding
- All resolved Q&A pairs are passed to Step 4 for inclusion in `## Resolved Questions`
- Skipped technical questions land in `## Open Questions / Assumptions`

### Step 4: Generate Implementation Notes

**After creating all stories and resolving open questions**, generate an implementation notes markdown file for each story. In concept mode also save notes for successfully created stories before reporting a partial failure; a resumed run creates only the missing notes and preserves FINAL notes.

For concept input, add `**Concept:** <slug>`, `**Concept Story ID:** <S01>` and
`**Concept Revision:** <N>` to each DRAFT header. Carry its actual component
analysis, requirement/AC mapping, effort rationale, resolved Q&A and assigned
design-deferred questions into the relevant sections. These remain DRAFT notes,
requiring story-specific design and freshness checks. Preserve these three
headers when design later replaces the notes. Update each row's Notes State in
the concept; record partial/complete progress using the shared contract.

1. **Create the folder** at the **Implementation Design** path from config (`pipeline/bin/config "Implementation Design"`, with `<story-key>` substituted — e.g. `pipeline/customers/<customer>/implementation-design/<story-key>/`, in the customer **config** repo, NOT the repo-root `implementation-design/`). This resolved folder is `<notes-dir>` below.

2. **Create the file** `<notes-dir>/implementation-notes.md` with the following structure:

   ```markdown
   # Implementation Notes: <Story-Key> — <Story Title>

   <!-- STATUS: DRAFT — Diese Notes sind ein Platzhalter aus der Story-Erstellung. -->
   <!-- Vor der Implementierung muss ein vollständiges Design erstellt werden. -->

   **Epic:** <Epic-Key>
   **Story:** <Story-Key>
   **Created:** <YYYY-MM-DD>
   **Status:** DRAFT

   ## Summary

   <Brief 2-3 sentence summary of what this story implements>

   ## Requirements

   <Key functional requirements extracted from the transcript, as bullet points>

   ## Proposed Implementation Approach

   ### Salesforce Tools
   <List which Salesforce tools/features will be used and why>

   ### Declarative vs Programmatic
   | Component | Type | Rationale |
   |-----------|------|-----------|
   | <component name> | Flow / Apex / Validation Rule / LWC / ... | <why this approach> |

   ## Affected Objects & Fields

   | Object | Field / Component | Action (New/Modify/Read) | Details |
   |--------|-------------------|--------------------------|---------|
   | <Object API Name> | <Field or component> | New / Modify / Read | <description> |

   ## Dependencies

   <List dependencies on other stories, existing metadata, or external systems>

   ## Acceptance Criteria Mapping

   | # | Acceptance Criterion | Implementation Component |
   |---|---------------------|--------------------------|
   | 1 | <criterion from story> | <which component fulfills it> |

   ## Test Scenarios (DRAFT)

   Vorläufige, aus den Akzeptanzkriterien abgeleitete Testszenarien; bei Konzept-Input mit dessen Analyse als Ausgangspunkt, noch ohne abschließendes Story-Design.

   | # | Szenario | Typ | Erwartetes Ergebnis |
   |---|----------|-----|---------------------|
   | T1 | <Testfall aus Akzeptanzkriterium 1> | Happy Path / Negativ / Edge Case | <Was verifiziert werden soll> |

   ## Resolved Questions

   | # | Question | Answer | Source |
   |---|----------|--------|--------|
   | 1 | <question resolved in Step 3.5> | <user's answer> | Story Creation |

   ## Open Questions / Assumptions

   <Any unresolved technical questions skipped in Step 3.5 or assumptions made during story creation>

   ## Implementation Guidance

   <Specific technical hints for the implementation>
   ```

   > **Wichtig:** Die generierten Notes müssen immer den HTML-Kommentar `<!-- STATUS: DRAFT -->` in der ersten Zeile nach der Überschrift und `**Status:** DRAFT` im Header enthalten. Dies signalisiert nachgelagerten Skills, dass die Notes nur ein Platzhalter sind und vor der Implementierung ein vollständiges Design erstellt werden muss.

3. **Content guidelines:**
   - Use the **story language** from config for business-facing sections, English for technical sections
   - Be specific about Salesforce API names, not just labels
   - Reference existing codebase patterns discovered during transcript analysis
   - Include enough detail to give a first orientation, but these are explicitly **not** the final implementation notes
   - For the Test Scenarios section: derive at least one test scenario per acceptance criterion. Focus on functional behavior (Happy Path, Negativ, Edge Case) from the user's perspective. Do not reference `testdata.config.md` presets (these are resolved during the design phase). Every acceptance criterion must map to at least one row in the table.
   - For the Resolved Questions section: include all Q&A pairs from Step 3.5. For skipped technical questions, list them in Open Questions / Assumptions instead.

### Step 5: Summary

Present a summary of:

- Number of stories created
- Story keys and links (Jira URLs if `jira` backend, file paths if `markdown` backend)
- Implementation notes file paths created
- Dependency graph (if applicable)
- Key requirements extracted from the transcripts
- **Suggested next step**:
  - If stories have dependencies: Start with Story XYZ (no dependencies)
  - If stories are independent: Can be implemented in parallel
  - Next: Run `/design-us <story-key>` to produce FINAL implementation notes before implementation

## Important Rules

- Follow all conventions from CLAUDE.md
- Output text in user stories uses the **story language** from config
- If `Story Backend` is `jira`: Use the Atlassian adapter (`pipeline/atlassian-access.md`) for all Jira operations — branch on `Deployment Type` from `customer.config.md`; never hardcode URLs, Cloud IDs, or PAT env var names
- If `Story Backend` is `markdown`: Use local file I/O only — no Atlassian calls needed
- **Be interactive**: Ask questions to clarify requirements, story cuts, and priorities
- **Quality over speed**: Better to ask 3 questions than to create 1 wrong story
- **Tickets knapp halten**: Jira-Tickets enthalten nur User Story, Kontext, Wertelisten, Akzeptanzkriterien und Abhängigkeiten. Technischer Scope und Implementierungsdetails gehören ausschließlich in die Implementation Notes.
- **NEVER include internal paths** (`pipeline/`, `.claude/`, skill names like `/implement-us`) in Jira story descriptions, implementation notes, or any other customer-visible output. Use neutral references instead.
- ALWAYS write the execution log with `pipeline/bin/log-skill` — never hand-author the JSON. Run:
  ```bash
  pipeline/bin/log-skill --skill create-story --identifier $ARGUMENTS --status <success|partial|failed> \
    --preferred-runtime claude-code \
    --summary "<1–2 sentence result>" \
    --artifact <path> \
    --output "<full run text>"
  ```
  It guarantees a schema-valid document and writes it to `pipeline/customers/<customer>/logs/<YYYY-MM-DD>-<customer-short-name>-$ARGUMENTS-create-story.json` (customer, active runtime, and timestamp resolve from config automatically; pass `--artifact` once per created/modified file; the directory is created if needed).

## Error Handling
- If `Story Backend` is `jira` and the Epic cannot be fetched from Jira, inform the user with the error details and abort
- Without `--concept`, if the transcript input folder (jira) or Meetings Folder (markdown) does not exist or is empty, inform the user and abort. Concept mode uses the dossier and requires no transcript folder.
- If `.docx` conversion via `textutil` fails, try reading the file as plain text or inform the user
- If `Story Backend` is `jira` and story creation fails (API error), retain story content and confirmed keys. In concept mode apply the shared recovery contract before retrying; never blindly repeat an uncertain create. Without concept input, display the error and offer recovery options.
- If `Story Backend` is `markdown` and a story key conflict occurs, auto-increment past the conflict

## Story Quality Checklist

Before creating each story, verify:

- [ ] Has clear user story statement (Als/möchte/damit)
- [ ] Has brief context (2-3 Sätze warum)
- [ ] Has specific, testable acceptance criteria (aus User-Sicht)
- [ ] Value lists / field changes included where applicable
- [ ] Dependencies documented (if known)
- [ ] No technical scope or implementation details in the ticket (belongs in Implementation Notes)
- [ ] Scope-level open questions resolved interactively (Step 3.5)
- [ ] Written in the story language from config
