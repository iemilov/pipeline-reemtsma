---
name: 23-document
description: Erzeugt ein Dokument nach Typ und Audience — Epic-Doku, Benutzerhandbuch, Architektur-Überblick oder CRM-Dokumentation — immer als Markdown, optional publiziert
argument-hint: "[epic-key | story-key | confluence-url] [--type <kind>] [--audience <role>] [--reason \"text\"] [--mirror|--no-mirror] [--dry-run] [--force]"
preferred-runtime: claude-code
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

> **Runtime hint:** This skill prefers `claude-code` (documentation synthesis and writing). If the active `Agent Runtime` (from `customer.config.md`) differs after applying any `## Skill Runtime Overrides`, print the standardized warning from `pipeline/agent-runtime-access.md` §1a and proceed. Record `active_runtime`, `preferred_runtime`, and `runtime_match` in the execution log.

## Purpose

One skill for every document the pipeline produces about a delivered solution. Four document types share the same chain — gather context → render Markdown → validate → store a version → optionally publish — and differ only in their input, their template, and their secondary target. Two questions at the start resolve those differences: **which document type?** and **which audience?**

Two guarantees hold for every type:

1. **Every run produces a Markdown file.** The file is the primary result, written before anything is published anywhere. A publish that is skipped or that fails never costs the document.
2. **The type decides where it goes.** Documents live in the active customer's config repo under `docs/<kind>/`, with a version history, a changelog, and a convenience copy of the newest version.

## When to Use / When NOT to Use

**Use this skill to:**

- Document an epic and its stories for a mixed business/technical readership (`--type epic`).
- Write a business user manual for the people who use, configure, or maintain a delivered solution (`--type manual`).
- Generate a technical architecture and functionality overview of the repository (`--type architecture`).
- Author an end-user knowledge article for the customer's CRM (`--type knowledge`).

**Do NOT use this skill to:**

- Build the domain knowledge base from Jira, Confluence, and the codebase — that writes `docs/<slug>.md` at the top level of the docs folder and has its own lifecycle.
- Produce a release overview from merge history.
- Answer a single question about the solution — the answering surfaces *read* the documents this skill writes.
- Write a meeting protocol from a transcript.

## Related Skills

| Need | Use instead | Why |
|---|---|---|
| Build domain topic documentation | `/12-build-knowledge` | writes `docs/<slug>.md`, different source and lifecycle; the top level of `docs/` is reserved for it |
| Produce a release overview | `/13-release-notes` | own format, own storage location |
| Answer one question about the solution | `/26-ask` | reads the documents produced here, produces none |
| Write a meeting protocol | `/23-create-meeting-protocol` | transcript-based, different verification logic |
| Review generated code | `/06-code-review` | reviews code, not documents |

## Configuration

Read everything through `pipeline/bin/config` — never re-parse the Markdown tables by hand. **All paths use `<customer>` as a placeholder** for the active customer's short name; resolve it from the symlink target of `pipeline/customer.config.md`, or from `Short Name` inside it.

| Source | Values used |
|---|---|
| `pipeline/customer.config.md` | `Platform`, `Short Name`, `Documentation Language`, `UI Language`, `Atlassian Deployment Type`, `Confluence URL`, `Confluence Space Key`, `Confluence Parent Page`, `Project Key`, `## Folder Paths > Architecture` and `Manuals` (mirror targets), `## Quality Gate` |
| `pipeline/stack.config.md` | naming prefixes, API version, source path, functional domains, org aliases, and the **Knowledge Articles** section (object API name, details field, RecordType DeveloperName, style template articles, hub articles) |
| `pipeline/customer.domain.md` | glossary and business terminology — the source of truth for translating technical names into business language |
| `pipeline/coding-conventions.md` | permission and access wording (e.g. a "permission sets only, never profiles" rule) |
| `pipeline/platforms/<Platform>/best-practices.md` | platform terminology for the architecture and knowledge types |
| `pipeline/atlassian-access.md` | the **Atlassian adapter** — every Jira/Confluence operation, branched on `Deployment Type` |
| `pipeline/agent-runtime-access.md` | the **Agent Runtime adapter** — subagent dispatch, MCP calls, interactive questions |

**Configured paths may carry a placeholder segment.** `Implementation Design` is configured by at least one customer as `…/implementation-design/<story-key>/` — a pattern, not a folder. Cut the value at the first `<…>` segment before using it. Resolved verbatim it names a path that never exists, and the failure is silent: the skill would report "no local context found" for a story that has plenty.

> **Platform note:** Only the Knowledge upload of type 4 is platform-specific. Everything else adapts through `stack.config.md` — see *Step 8* for the Platform Guard and *Step 4* for platform-varying analysis.

## Document types

| # | `--type` | Replaces | Default audience | Input | Secondary target |
|---|---|---|---|---|---|
| 1 | `epic` | `/08-document-us` | mixed business + technical | Jira epic + linked stories + implementation notes | Confluence (optional) |
| 2 | `manual` | `/17-create-business-manual` | business end users | epic or concept URL + stories + customer documentation | Confluence (optional) |
| 3 | `architecture` | `/11-architecture-overview` | developers & architects | repository analysis + platform template | Confluence (optional) |
| 4 | `knowledge` | `/09-write-crm-doc` | end users inside the CRM | stories + domain knowledge + repository | CRM Knowledge draft (Platform Guard) |

### Storage layout

```
pipeline/customers/<customer>/docs/
├── <slug>.md                    ← untouched: topic docs from the knowledge builder
├── architecture/
│   ├── <slug>.md                ← convenience copy of the newest version (the indexed file)
│   └── <slug>/
│       ├── CHANGELOG.md
│       ├── v01-<YYYY-MM-DD-HHMM>.md
│       └── v02-<YYYY-MM-DD-HHMM>.md
├── manual/                      ← same shape
├── epic/                        ← same shape
└── knowledge/                   ← same shape
```

**The top level of `docs/` is off limits.** It belongs to the knowledge builder; never write or modify a file there.

### Slug rules

Deterministic, never re-invented per run — a slug derived afresh each time would fork one document into two histories.

| Type | Slug | Why |
|---|---|---|
| `epic` | epic key, lowercased (`cr-42`) | unique and stable across runs |
| `manual` | epic key, lowercased (`cr-42`) | one manual per epic |
| `architecture` | customer short name, lowercased (`acme`) | exactly one running architecture history per customer |
| `knowledge` | story key, else the Knowledge article number (`crm-3157`, `000001797`) | binds the Markdown history to the target article in the CRM |

If a `knowledge` run has neither a story key nor an article number (first article, no story), **ask** for the slug and offer a kebab-case suggestion — never guess it silently.

> **Assumption to confirm on first use:** one architecture history per customer. A customer with several separately documented systems needs one slug per system; ask before creating a second architecture slug.

## Start dialog

Two `AskUserQuestion` calls, **before any other output except the scope banner**. Two calls and not one, because question 3 depends on the answer to question 1: it does not apply to types 1 and 4, and for types 2 and 3 it has to name the concrete target path, which is only known after the type is chosen.

A value supplied as a CLI argument replaces the corresponding question — the skill is fully non-interactive when all of `--type`, `--audience`, `--reason`, and `--mirror`/`--no-mirror` are given.

### Call 1 — questions 1 and 2

**Question 1 — document type:** the four types above.

**Question 2 — audience:** fixed list plus free text. Each option maps to one defined tone profile:

| Audience | Register | Depth | API / field names | Effect |
|---|---|---|---|---|
| Business end users | formal address, everyday language | no internals | never | "Click *Change branch responsibility*." |
| Key users & admins | formal address, precise | configuration, permissions | only at first occurrence, in parentheses | "Responsibility is driven by the *Branch supervisor* role." |
| Developers & architects | factual, direct | complete | throughout | "`Case.SourceCategoryConfiguration__c` controls …" |
| Management & stakeholders | formal address, outcome-oriented | benefit, risk, effort | never | "The process shortens handling time by …" |
| *(free text)* | derived from the input | — | — | — |

**Permitted type/audience combinations.** The audience is not freely combinable with every type — the replaced skills each carry a type contract the merge must not dilute. An architecture overview written for business end users loses the technical completeness that type requires; a knowledge article at developer depth loses the end-user clarity of its own.

| Type | Permitted audiences | Blocked |
|---|---|---|
| `epic` | all four | — |
| `manual` | business end users, key users & admins, management | developers & architects |
| `architecture` | developers & architects, key users & admins, management | business end users |
| `knowledge` | business end users, key users & admins | developers & architects, management |

A free-text audience is mapped to the nearest profile. If it maps onto a blocked profile, **say so and let the user decide** — never switch register silently.

### Call 2 — questions 3 to 5

- **Question 3 — visibility (types 2 and 3 only):** "Yes, mirror to `<concrete target path>` for the customer and release it for the chat" or "No, store internally only (not in the chat)". Sets `mirrored:` and `chat_visibility:` together — see *Mirroring*.
- **Question 4 — reason for this version:** one line; fills `reason:` and the changelog column. For `v01`, "Initial version" is pre-filled.
- **Question 5 — secondary target:** Confluence publication (types 1–3) or CRM Knowledge draft (type 4) — "yes / no / preview only". This belongs in the dialog and **not** at the end of the run: it triggers a write to a system outside the repository, and every decision is meant to be made before the analysis starts. On "preview only", Step 8 shows the finished target content and takes one final confirmation before writing.

For types 1 and 4, question 3 does not apply; call 2 then carries questions 4 and 5 only.

**Language rule (non-negotiable):** the document is written entirely in `Documentation Language`, headings included, regardless of audience. The audience changes tone, register, and technical depth — nothing else. Where `UI Language` differs from `Documentation Language`, quote UI labels verbatim in `UI Language` and keep the surrounding text in `Documentation Language`.

> **Runtime note:** `AskUserQuestion` is a Claude Code primitive. Under runtimes without a tool loop (`hosted-llm`) and under `local-llm`, ask the same questions as a numbered plain-text prompt and read the answer from standard input; the option *values* stay identical so the tone profile stays deterministic. The mapping of the operation to each runtime follows `pipeline/agent-runtime-access.md`.

## Workflow

| Step | Content |
|---|---|
| 1 | Print the scope banner |
| 2 | **Start dialog** — type + audience, then conditionally visibility, reason, secondary target |
| 3 | Read configuration — all via `pipeline/bin/config`, never parsed by hand |
| 4 | Gather type-specific input |
| 5 | Render the document from the type's template, tone per the audience profile |
| 5b | **Validate and repair** — a gated loop, before anything is written |
| 6 | **Write the Markdown** — determine the version, write `v<NN>` + convenience copy + changelog row |
| 7 | Write the mirror — only when question 3 was answered "yes" |
| 8 | Execute the secondary target per question 5 |
| 8b | **Back-fill** the outcome into `published:` and the changelog column |
| 9 | Write the execution log via `pipeline/bin/log-skill`, including the loop telemetry from 5b |

**Step 6 is the success condition of the run.** If it fails, the run is `failed`. Steps 7–8b being *deliberately skipped* (not configured, declined, Platform Guard) keeps the run `success`; one of them *failing in the attempt* makes it `partial`. See *Status model* — "skipped" and "failed" are explicitly not the same thing.

### Step 4 — type-specific input

**Type 1 (`epic`) and type 2 (`manual`)**

1. The first positional argument is either an epic key matching the customer's `Project Key` pattern, or a Confluence URL of a published concept page. For a URL, fetch the page via the adapter's `getConfluencePage` operation and extract the epic key from the frontmatter, body, or a Jira link macro. If several distinct epic keys appear, ask which one. If none can be resolved, abort naming the page title.
2. Fetch the issue via the adapter's `getJiraIssue` operation. **Abort if the issue is not an Epic** — single stories are out of scope; request the parent epic instead.
3. List the linked stories via `searchJiraIssuesUsingJql`. The epic-link JQL differs by deployment type (adapter §3): Cloud `parent = <EPIC>`, Data Center `"Epic Link" = <EPIC>`. Order by key ascending.
4. Read the local context, silently skipping what is absent: every `.md` under `pipeline/customers/<customer>/` at depth ≤ 2, the epic's concept and design documents, and the implementation notes of each linked story. Skip files over ~200 KB and anything under a logs folder. Summarise the findings in **one line** before drafting.
5. Type 1 additionally reads the implementation files the stories reference; type 2 never describes code.

**Type 3 (`architecture`)**

Analyse the repository. **Breadth before depth** — this type runs over a whole codebase:

- Read at most five representative units per functional group (services, batch jobs, controllers).
- Skip tests, DTOs, and thin wrappers.
- For objects with many fields, summarise counts and name only the key fields.
- For declarative automation, read the metadata for type and trigger; do not trace full logic paths.
- Aim for a complete overview rather than exhaustive detail on any one component.

Cover: repository structure and component counts, the functional domains from `stack.config.md`, the data model, automation and integrations, and CI/CD and deployment. On a platform whose concepts do not apply, analyse the equivalents named in `stack.config.md` instead of reporting them as missing.

**Type 4 (`knowledge`)**

1. Parse the story key(s) from the argument (comma-separated list allowed) and fetch each issue via the adapter.
2. Read `customer.domain.md` and the topic docs matching the story's subject.
3. Search the source path from `stack.config.md` for the implementation that belongs to the story.
4. Read the customer's **style template articles** (article numbers from the Knowledge Articles section of `stack.config.md`) — they define the target HTML shape read in Step 8, never hardcoded here.
5. Check the **hub articles** from `stack.config.md` and apply each one's check mode: "always" hub articles are queried and reported if the target article is not yet linked; "on request only" hub articles are queried only after the user confirms.

### Step 5 — render from the template

Templates live at `pipeline/customers/_template/templates/<doc-kind>/<platform>.md`, resolved as: the file for the active `Platform`, else `default.md` in the same folder. Templates are written in English and define the **section structure**:

- Translate all section headings and table headers into `Documentation Language`.
- Fill every `{{PLACEHOLDER}}` with real data from Step 4.
- Repeat sections wrapped in `{{#EACH …}}` / `{{/EACH}}` once per item.
- Keep the section order; do not add, drop, or reorder top-level sections.
- A section with no data keeps its heading and gets a short note in `Documentation Language`, rather than being omitted.

Write to the audience's tone profile. For every type: no AI attribution, and no internal references — no pipeline paths, no skill command names — in any text destined for a customer-visible file, Confluence, or the CRM.

### Step 5b — validation as a gated loop

`CLAUDE.md > Quality Gate & Loop Engineering` requires a deterministic stop condition rather than a self-assessment. None of the four replaced skills had one. The rule set is deliberately narrow and mechanically checkable — not a second model review:

| Check | Applies | Severity |
|---|---|---|
| Internal references (pipeline paths, `.claude/` paths, skill command names) in the text | only when mirroring, or with a Confluence/Knowledge target | **Blocker** |
| AI attribution in the text or the frontmatter | always | **Blocker** |
| Document language ≠ `Documentation Language` (stopword heuristic) | always | **Blocker** |
| A mandatory template section missing or empty | always | Major |
| API / field names present for an audience that permits none | types 2 and 4 | Major |
| An unreplaced `{{…}}` placeholder | always | Major |
| Markdown outside the canonical subset (fenced code, images, nested quotes) | type 4 only — see Step 8 | Major |

The loop runs render → check → repair → re-check. Blocker and Major counts go into the gate **counted, never estimated**, and the finding list they were counted from is printed, so a reader can recompute the verdict from the document.

**The score measures other dimensions than the severity gate.** A score derived from the same counters would be 100 at zero findings and already blocked at any positive count — the customer's threshold would do nothing, and the no-progress brake would trip when a fixed finding is replaced by a new one of equal severity. These four dimensions are independent of the finding count and all mechanically countable:

| Dimension | Points | Measurement |
|---|---:|---|
| Mandatory template sections covered | 40 | filled mandatory sections ÷ total |
| Placeholder-free | 20 | no `{{…}}` left in the text |
| Language conformance | 20 | stopword heuristic against `Documentation Language` |
| Audience conformance | 20 | share of permitted terminology for the tone profile |

Call the gate; branch on its `decision=` line; never re-derive the arithmetic:

```bash
pipeline/bin/quality-gate --round <n> --blockers <b> --majors <m> \
  --score <score> [--prev-score <previous round's score>]
```

If the loop ends on `stop`, **nothing is published and nothing is mirrored** — the Markdown is still written, the open findings are named, and the run is `partial`.

### Step 6 — write the Markdown

1. **Determine the version.** List `docs/<kind>/<slug>/v*.md`, parse the `v<NN>` prefix, take `max + 1`, zero-padded, starting at `v01`. During the transition also consider the pre-2.2.0 manual location (`<Implementation Design>/<epic-key>/manual/`) and continue from the highest version found in **either** place — otherwise a customer whose manual sits at `v03` would get a second `v01` and both would be live at once. If the computed file already exists (a parallel run), increment again.
2. **Write the versioned file** with this frontmatter:

   ```yaml
   ---
   kind: architecture | manual | epic | knowledge
   identifier: <epic key | story key | customer short name>
   version: v<NN>
   created: <YYYY-MM-DD HH:MM>
   author: <git user.name, else "unknown">
   audience: <chosen audience>
   language: <Documentation Language>
   reason: <one-line reason from question 4>
   based_on: <previous version file, or "none">
   mirrored: <mirror path in the main repo, or false>
   chat_visibility: approved | internal
   published: <Confluence URL | Knowledge id | "skipped" | "failed" | "blocked" — back-filled in 8b>
   ---
   ```

3. **Refresh the convenience copy** `docs/<kind>/<slug>.md` as a real file, not a symlink — customer repos are checked out on Windows too. This copy is the file the answering surfaces index.
4. **Prepend a row** to `docs/<kind>/<slug>/CHANGELOG.md` (newest first): version, date, author, audience, reason, mirror, publish status. The publish column starts as `open` and is back-filled in 8b.
5. **Never delete or overwrite an existing version file.** This is the only point in the run where data loss would be possible.

When the transitional legacy location held the previous versions, move that history along on the first write into the new structure, so the history stays in one place instead of forking. `pipeline/bin/migrate-docs-layout` does exactly that move for a whole customer repo in one go — idempotent, with `--dry-run` and `--revert`. Running it is optional: the legacy location is still read, so an unmigrated customer keeps answering questions. Every migrated document lands with `chat_visibility: internal`, because the old locations were never checked for internal references; review each one before releasing it.

### Step 7 — mirror to the main repo

Only for types 2 and 3, and only on an explicit "yes".

| Type | Primary storage (internal, always) | Mirror (customer-visible, on request) |
|---|---|---|
| `architecture` | `docs/architecture/<slug>/v<NN>-….md` | `<Architecture>/<YYYY-MM-DD>-architecture-overview.md` |
| `manual` | `docs/manual/<slug>/v<NN>-….md` | `<Manuals>/<epic-key>.md` |

`<Architecture>` and `<Manuals>` come from `## Folder Paths` in `customer.config.md`; if a row is empty, mirror to `architecture/` respectively `manuals/` at the project root and say so once instead of writing silently.

Mirror **only the newest version, as a single file** — never the history, never the changelog. Write the mirror from the rendered prose, not from the internal version with its frontmatter. If the mirror file already exists it is **overwritten** (the mirror is by definition a copy of the newest version, the history lives internally); report the overwrite naming the date and version of the replaced file.

**Hard rule for mirror files:** they land in the customer-visible main repo and must contain no internal references of any kind and no AI attribution. Step 5b enforces this as a Blocker, and the repository's own write guard enforces it again mechanically.

**Visibility is one decision, not two.** The mirror question controls **both** placement in the customer-visible main repo *and* inclusion in the chat index, and sets `mirrored:` and `chat_visibility:` from the same answer. "Internal only" that still answered questions in the chat would be no protection at all: the chat renders matching sections into its answers, and its output filter checks a few literal patterns, so it cannot catch a passage that is internal by content rather than by wording.

A missing `chat_visibility` field counts as approved — that is deliberate, and it is what keeps the existing knowledge base intact: topic docs, domain knowledge, and release notes carry no frontmatter at all, and an approve-only rule would empty the index. An explicit `internal` is honoured for every kind. Types 1 and 4 have no mirror question and are indexed; for types 2 and 3 this is a **behaviour change** — manuals and architecture overviews used to be indexed unconditionally and now require release.

### Step 8 — secondary target

**Types 1–3: Confluence.** Skip entirely on `--dry-run`.

1. Resolve the connection via `pipeline/atlassian-access.md` §1–§2. If `Deployment Type` is missing, or (Cloud) `Cloud ID`/`Confluence URL` is empty, or (Data Center) `Confluence URL` is empty or no Confluence server is reachable, **skip** publication and tell the user the document was stored locally because no connection is configured. This is a skip, not a failure — the run stays `success`.
2. Resolve space and parent page from `--space-key` / `--parent-page`, else from config. If still unset, ask interactively; after a successful publish, offer to persist the entered values into `customer.config.md` (Step 8b).
3. Find or create: search by title via `searchConfluenceUsingCql` in the target space.
   - No match → create.
   - Exactly one match, no `--force` → update.
   - Exactly one match with `--force` → create a new page; warn about the duplicate and offer a different title.
   - Several matches → ask which page to update.
4. Create via `createConfluencePage`, update via `updateConfluencePage`. **On Data Center the body is XHTML storage format** and an update carries the previous `version.number + 1` — see adapter §4. Close every tag, use `<br/>`, escape stray `<` and `&`. On Cloud the bundled plugin handles conversion.
5. Always attach the page under the configured **Confluence Parent Page**.
6. Pass the one-line reason as the version comment where the operation supports one; otherwise prepend a single-line note `Version <NN> — <reason>` inside the body.
7. Error handling: on an expired Data Center session, refresh authentication once and retry. On a version conflict during an update, retry once letting the server resolve the previous version. On anything else, surface the raw error, record `failed`, and stop — never retry blindly more than twice.

**Type 4: CRM Knowledge draft.**

> **Platform Guard:** the Knowledge upload requires `Platform: salesforce` in `customer.config.md`. On any other platform, **skip this step**, tell the user the Markdown was written and the CRM upload does not apply to their platform, and keep the run `success`. The Markdown is never platform-dependent — only this upload is.

The Knowledge article is not Markdown. Convert it with a **deterministic renderer** over a canonical Markdown subset, not a free model step:

- Canonical subset: H2/H3 headings, paragraphs, ordered and unordered lists, tables, inline emphasis, internal anchors. Anything else — fenced code, images, nested quotes — is invalid in a type-4 document and is reported as a Major in Step 5b.
- Font sizes, classes, and the anchor scheme come from the customer's **style template article**, read at runtime; never hardcoded in this skill.
- The generated markup is compared structurally against the style article: same section order, same anchor ids, no unknown tags.

Then create or update the draft:

- **Existing article (online):** move the master version to draft, query the new draft id, and fill the details field from the Knowledge Articles config section.
- **No article yet:** query the RecordType id by `DeveloperName` — never a hardcoded id — create the record, then fill the content.
- **Hub articles:** same procedure, only for those the user confirmed.

**Never publish.** Only drafts are created; the responsible person publishes manually after review. Report the draft URL and state plainly that the article is offline until then.

### Step 8b — back-fill

Write the outcome of Step 8 into `published:` in the frontmatter and into the changelog's publish column, as one of `created` / `updated` / `skipped` / `failed` / `blocked`. `blocked` must be an accepted value in both places — otherwise the column stays on `open` forever after a gate stop.

For types 1 and 2, additionally add a one-line comment to the Jira epic via the adapter's `addCommentToJiraIssue` operation: version, audience, reason, and the page link. No AI attribution. Skip on `--dry-run`.

If space or parent page were entered interactively, ask now whether to persist them into `customer.config.md`, and edit the two table rows in place on confirmation.

### Step 9 — execution log

ALWAYS write the execution log with `pipeline/bin/log-skill` — never hand-author the JSON:

```bash
pipeline/bin/log-skill --skill 08-document --identifier <epic-key | story-key | short-name> \
  --status <success|partial|failed> \
  --preferred-runtime claude-code \
  --document-kind <epic|manual|architecture|knowledge> \
  --audience "<chosen audience>" \
  --summary "[publish=<ok|skipped|failed|blocked|none>] [mirror=<ok|skipped|failed|none>] <1–2 sentence result>" \
  --artifact <path> \
  --iterations <rounds from 5b> --verifier "bin/quality-gate" \
  --final-score <score> --exit-reason <clean|score-threshold|score-unmeasured|budget-exhausted|no-progress> \
  --output "<full run text>"
```

It guarantees a schema-valid document and writes it to `pipeline/customers/<customer>/logs/<YYYY-MM-DD>-<customer-short-name>-<identifier>-08-document.json` (customer, active runtime, and timestamp resolve from config automatically; pass `--artifact` once per created or modified file — typically the versioned file, the convenience copy, the changelog, and the mirror; the directory is created if needed).

`--document-kind` and `--audience` are **mandatory for this skill**. One skill now produces four document types, so the skill name no longer says which one ran; without these fields "how often is a manual actually produced?" stops being answerable.

## Status model

| Situation | Status |
|---|---|
| Markdown written, secondary target succeeded | `success` |
| Markdown written, secondary target **deliberately skipped** (not configured, user declined, Platform Guard, `--dry-run`) | `success` |
| Markdown written, secondary target **attempted and failed** | `partial` |
| Markdown written, **validation gate open** (`stop`, Step 5b) — not mirrored, not published | `partial`, marker `[publish=blocked]`, open findings named in the summary |
| No Markdown written | `failed` |

A deliberately skipped publish is not a partial failure. The row for the open gate is not a formality either: `CLAUDE.md > Quality Gate & Loop Engineering` requires a run that ended on `budget-exhausted` or `no-progress` to be reported as **not passed**, however complete its Markdown is.

**Machine-readable markers.** The difference between "skipped" and "failed" must not live in prose only, or the statistics skill cannot aggregate it — the log schema has no field for it. Write both markers as the **first line** of `--summary`:

```
[publish=ok|skipped|failed|blocked|none] [mirror=ok|skipped|failed|none] <normal summary>
```

`none` stands for a type without that step, `blocked` for an open validation gate. The **second** marker is necessary because Step 7 can also pull a run to `partial`: a failed mirror with a successful publish would otherwise be logged as `[publish=ok]` with an unexplained `partial`. Both markers are readable by prefix match.

## Capabilities carried over from the replaced skills

| Capability | From | Where it lives now |
|---|---|---|
| Confluence find-or-create incl. multi-match dialog | epic, manual | Step 8 |
| Attach the page under the configured parent page | epic, architecture | Step 8 |
| `--force` (new page instead of update) | manual | Step 8 |
| `--dry-run` (local only, no publish) | manual | Step 8, 8b |
| `--space-key`, `--parent-page`, `--topic` | manual | Step 8 |
| Persist space/parent after a successful publish | manual | Step 8b |
| Concept URL instead of an epic key as input | manual | Step 4, types 1 and 2 |
| Epic-only guard | manual | Step 4, types 1 and 2 |
| Jira epic comment after publishing | manual | Step 8b |
| Check and link hub articles | knowledge | Step 4 and Step 8, behind the Platform Guard |
| HTML style template for Knowledge articles | knowledge | Step 8 |
| Platform-specific architecture templates | architecture | Step 5 |
| Breadth-before-depth analysis rules for large repositories | architecture | Step 4, type 3 |
| Version history + changelog | manual | Step 6, extended to all four types |
| Local rescue copy on a publish failure | epic | **dropped** — redundant, the Markdown is always written first |

## CLI arguments

| Argument | Effect |
|---|---|
| first positional | epic key, story key(s), or Confluence URL — depending on type |
| `--type <kind>` | `epic` / `manual` / `architecture` / `knowledge`; skips question 1 |
| `--audience <role>` | skips question 2; still validated against the permitted combinations |
| `--reason "<text>"` | skips question 4 |
| `--mirror` / `--no-mirror` | skips question 3 (types 2 and 3) |
| `--space-key`, `--parent-page`, `--topic` | Confluence overrides |
| `--dry-run` | write the Markdown only; no publish, no mirror, no Jira comment |
| `--force` | create a new Confluence page instead of updating the existing one |

## Output to the user

1. The document type and the resolved audience.
2. The new version identifier and the path to the versioned Markdown file.
3. The path to the convenience copy (always the newest version).
4. The mirror path, or a note that the document is internal only.
5. The Confluence URL or Knowledge draft URL, and whether it was created, updated, skipped, or failed.
6. The gate result of Step 5b: rounds, score, exit reason — and, if the gate is open, the open findings by name.
7. For type 2 and type 4: a reminder that screenshot placeholders are present and need replacing before wide distribution.

On failure, print the raw tool error and the step it happened in, then stop.

## Error handling

- Epic or story not retrievable → report the error and abort; no document is written from nothing.
- The resolved issue is not an Epic (types 1, 2) → abort with a clear message and ask for the parent epic.
- No stories linked to the epic → tell the user (the epic may have no children yet) and abort.
- A single story not retrievable → skip it with a warning and continue with the others.
- No matching topic doc (type 4) → continue without it and note it in the log.
- Repository structure unreadable (type 3) → report and abort.
- Missing metadata directories (type 3) → note the absence and continue with what exists.
- No Atlassian connection resolvable → skip the publish, keep `success`, record `[publish=skipped]`.
- Knowledge upload fails → store the rendered markup next to the Markdown version, record `[publish=failed]`, status `partial`.
- The user cancels the start dialog → **write nothing**, print a clear cancellation notice, and do not log a `success`.

## Setup note

After this file is added or changed, re-run `setup.sh` from the repo root so the skill is merged into `.claude/skills/` and `.claude/commands/`. Until then the slash command is not wired up.
