---
name: document
description: Produce a document about a delivered solution by type and audience — epic documentation, business user manual, architecture overview, or CRM knowledge article — as versioned Markdown in the customer config repo, optionally mirrored to the main repo, published to Confluence, or rendered as a self-contained HTML page in the documentation folder
argument-hint: "[epic-key | story-key | topic] [--type epic|manual|architecture|knowledge|process] [--audience <role>] [--reason \"text\"] [--format md|html] [--mirror|--no-mirror] [--publish] [--dry-run] [--force]"
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

## Purpose

One skill for every document the pipeline produces about a delivered solution. All document types share one chain — gather context → render → validate → store a version → optionally publish — and differ only in input, section structure and secondary target. Two questions at the start resolve the differences: **which document type?** and **which audience?**

Two guarantees:

1. **Every run produces a file first.** The Markdown (or HTML) is written before anything is published anywhere; a skipped or failed publish never costs the document.
2. **The type decides where it goes** (see *Storage*).

## When to Use / When NOT to Use

- Use for: epic documentation (`epic`), business user manual (`manual`), technical architecture overview (`architecture`), CRM knowledge article (`knowledge`), and a business process description of a delivered feature area (`process`, e.g. the loyalty programme).
- Do NOT use to build the domain knowledge base from Jira, Confluence and code — `/build-knowledge`.
- Do NOT use for release notes (`/release-notes`), meeting status pages (`/project-update`), or customer communication (`/client-update`).

## Configuration

Read directly from the config tables (never guess values):

| Source | Values |
|---|---|
| `pipeline/customer.config.md` | `Platform`, `Short Name`, `Full Name`, `Documentation Language`, `UI Language`, `## Atlassian` (Cloud ID, Confluence Space Key, Confluence Parent Page, Project Key), `## Folder Paths` (Architecture, Manuals, Implementation Design, Documentation if present — default `documentation/`), `## Concepts` path if present |
| `pipeline/stack.config.md` | naming conventions, API version, source path, functional domains, org aliases, `## Knowledge Articles` section if present (object API name, details field, record type developer name, style template article numbers, hub articles) |
| `pipeline/customer.domain.md` | glossary and business terminology — the source of truth for translating technical names into business language |

`<customer>` is the folder name from the symlink target of `pipeline/customer.config.md`. Configured paths may carry a `<story-key>` segment: cut the value at the first `<…>` before using it as a folder.

## Document types

| `--type` | Default audience | Input | Secondary target |
|---|---|---|---|
| `epic` | mixed business and technical | Jira epic + linked stories + implementation notes + code | Confluence (optional) |
| `manual` | business end users | epic or topic + stories + customer documentation | Confluence (optional), mirror to Manuals folder (optional) |
| `architecture` | developers and architects | repository analysis | Confluence (optional), mirror to Architecture folder (optional) |
| `knowledge` | end users inside the CRM | story + domain knowledge + code | CRM Knowledge draft (Salesforce only) |
| `process` | business process owners | repository analysis of one feature area (code, flows, configuration) + domain knowledge | HTML in the documentation folder (default), Confluence (optional) |

### Audience profiles

| Audience | Register | Depth | API and field names |
|---|---|---|---|
| Business end users | formal, everyday language | no internals | never |
| Business process owners | formal, precise | processes, rules, configuration in business terms | never; configuration tables are named by their business meaning |
| Key users and admins | formal, precise | configuration, permissions | at first occurrence in parentheses |
| Developers and architects | factual, direct | complete | throughout |
| Management and stakeholders | formal, outcome-oriented | benefit, risk, effort | never |

Permitted combinations: `epic` any; `manual` business, key users, management; `architecture` developers, key users, management; `knowledge` business, key users; `process` business process owners, key users, management. A free-text audience is mapped to the nearest profile; if that profile is blocked for the type, say so and let the user decide.

**Language rule:** the document is written entirely in `Documentation Language`, headings included. UI labels are quoted verbatim in `UI Language` when the two differ.

### Storage

| Format | Location |
|---|---|
| Markdown (default for epic, manual, architecture, knowledge) | `pipeline/customers/<customer>/docs/<kind>/<slug>/vNN-<YYYY-MM-DD-HHMM>.md`, convenience copy `docs/<kind>/<slug>.md`, `docs/<kind>/<slug>/CHANGELOG.md` |
| Mirror (manual, architecture; explicit yes only) | `<Manuals>/<epic-key>.md` or `<Architecture>/<YYYY-MM-DD>-architecture-overview.md` in the main repo, newest version only, no frontmatter |
| HTML (`--format html`, default for `process`) | `<Documentation folder>/<slug>.html` in the main repo, self-contained, same visual style as the existing pages in that folder; a Markdown version is additionally stored under `docs/<kind>/<slug>/` for the history |

The top level of `docs/` belongs to `/build-knowledge`; never write there.

**Slug rules** (deterministic): `epic` and `manual` → epic key lowercased; `architecture` → customer short name lowercased; `knowledge` → story key, else the Knowledge article number; `process` → kebab-case topic (e.g. `loyalty-programme`). If a slug cannot be derived, ask; never guess.

## Start dialog

Values passed as flags replace the corresponding question. Otherwise two `AskUserQuestion` calls:

1. **Type** and **audience** (the audience options depend on the type).
2. **Reason for this version** (pre-filled "Initial version" for v01), **mirror** (manual and architecture only: yes = mirror to the concrete main-repo path and release for sharing; no = internal only), **secondary target** (Confluence yes / no / preview; Knowledge draft yes / no / preview for type knowledge), **format** if not implied by the type.

Under a runtime without a question tool, ask the same questions as a numbered plain-text prompt.

## Workflow

| Step | Content |
|---|---|
| 1 | Scope banner, argument parsing, start dialog |
| 2 | Read configuration |
| 3 | Gather type-specific input |
| 4 | Render the document in the type's section structure and the audience's tone |
| 5 | Validate and repair (mechanical checks, max 3 passes) |
| 6 | Write the versioned file, convenience copy, changelog (and HTML) |
| 7 | Mirror on explicit yes |
| 8 | Secondary target |
| 9 | Back-fill publish status, Jira comment for epic and manual |
| 10 | Log and summary |

### Step 3: Gather input

**`epic` and `manual`**
1. The argument is an epic key matching the `Project Key` pattern, or a Confluence URL of a concept page (fetch with `getConfluenceContent`, extract the epic key; several keys → ask; none → abort naming the page).
2. `getJiraIssue` for the epic; **abort if the issue is not an Epic** and ask for the parent epic.
3. `searchJiraIssuesUsingJql` with `parent = <EPIC> ORDER BY key ASC` (Cloud) for the stories. No stories → tell the user and abort.
4. Read local context, skipping what is absent: `.md` files under `pipeline/customers/<customer>/` at depth ≤ 2, the concept dossier under the Concepts path if the epic names one, the implementation notes of each story under the Implementation Design path. Skip files over ~200 KB and anything under a logs folder. Summarise in one line before drafting.
5. `epic` additionally reads the implementation files the stories reference; `manual` never describes code.

**`architecture`** — analyse the repository breadth-first: at most five representative units per functional group; skip tests, DTOs and thin wrappers; summarise field counts on large objects and name only key fields; read declarative automation for type and trigger, not full logic. Cover repository structure and component counts, the functional domains from `stack.config.md`, the data model, automation and integrations, CI/CD and deployment.

**`knowledge`** — parse one or more story keys, fetch each with `getJiraIssue`, read the domain file and matching topic docs, search the source path for the implementation, and read the style template and hub articles named in `stack.config.md > Knowledge Articles` from the org (`sf data query` on the Knowledge object). Without that section, the article is written from the generic structure and the upload is skipped.

**`process`** — the argument is a topic. Run two read-only explorations in parallel via the `Agent` tool: one over Apex and inbound endpoints (services, REST classes, batch jobs, business rules, example payloads from tests), one over declarative metadata (custom metadata types and records with values, flows step by step, objects and fields, triggers, scheduled jobs, existing documentation). Ask both for file references and to mark unclear points. Cross-check the domain file; where it contradicts the metadata, the metadata wins and the contradiction becomes an observation.

### Step 4: Render

Templates live at `pipeline/customers/_template/templates/<kind>/<platform>.md`, else `default.md`. **If the template contains only placeholders**, use the section structure below instead:

- **epic**: Summary · Business context · Stories (table: key, title, status, what it delivers) · Solution overview · Data model changes · Automation and integrations · Configuration · Test approach · Deployment and manual steps · Open points.
- **manual**: Purpose and audience · Prerequisites and access · Step-by-step procedures (one section per task, numbered steps, UI labels verbatim, screenshot placeholders) · Configuration by key users · Troubleshooting · Glossary.
- **architecture**: Overview · Repository structure and counts · Functional domains · Data model · Automation (triggers, flows, batches, scheduled jobs) · Integrations and interfaces · Security model · CI/CD and environments · Technical debt and risks · Appendix: component inventory.
- **knowledge**: Title · Summary · When to use · Step-by-step · Notes and limits · Related articles (canonical subset only: H2/H3, paragraphs, lists, tables, emphasis, anchors).
- **process**: Contents · The process in one picture (flow diagram) · Rules and thresholds · How it starts (e.g. registration) · How it runs (per interaction type, with tables) · Automatic steps and jobs · What is stored (records and key fields in business terms) · Configuration you can change · Interfaces (business view) · Data retention · Observations and open points.

Flow diagrams in HTML are CSS boxes and arrows in the style of the existing documentation pages; in Markdown they are ordered step lists or Mermaid blocks. Every table and diagram is derived from the gathered facts; unclear facts are marked, never filled in.

Tone per audience profile. No AI attribution; no internal references (pipeline paths, skill names, ticket keys unless the audience uses them) in anything mirrored, published or rendered as HTML.

### Step 5: Validate and repair

Mechanical checks, run after rendering, repaired and re-run up to three passes:

| Check | Applies | Severity |
|---|---|---|
| Internal references (`pipeline/`, `.claude/`, skill names) | mirror, HTML, Confluence or Knowledge target | Blocker |
| AI attribution | always | Blocker |
| Document language ≠ Documentation Language (stopword heuristic) | always | Blocker |
| Mandatory section missing or empty | always | Major |
| API or field names for an audience that permits none | manual, knowledge, process, management | Major |
| Unreplaced `{{…}}` placeholder | always | Major |
| Markdown outside the canonical subset | knowledge | Major |
| HTML: external resources, missing `<title>`, table without `overflow` wrapper | html | Major |

After three passes with a Blocker or Major still open, nothing is mirrored or published; the file is still written, the open findings are named, and the run is `partial`.

### Step 6: Write

1. **Version**: list `docs/<kind>/<slug>/v*.md`, take max + 1 zero-padded (start `v01`); if the computed file exists, increment again.
2. **Versioned file** with frontmatter: `kind`, `identifier`, `version`, `created`, `author` (git user.name), `audience`, `language`, `reason`, `based_on`, `mirrored` (path or `false`), `chat_visibility` (`approved` when mirrored or type epic/knowledge/process, else `internal`), `published` (back-filled in Step 9).
3. **Convenience copy** `docs/<kind>/<slug>.md` as a real file.
4. **Changelog row** prepended to `docs/<kind>/<slug>/CHANGELOG.md`: version, date, author, audience, reason, mirror, publish status (`open` until Step 9).
5. **HTML** (`--format html` or type `process`): write `<Documentation folder>/<slug>.html`; if it exists, overwrite it after telling the user (the history is in `docs/`).
6. Never delete or overwrite an existing version file.

### Step 7: Mirror

Only `manual` and `architecture`, only on explicit yes. Write the rendered prose (no frontmatter) to the target path; if the target exists it is overwritten and the replaced date and version are reported. Folder rows empty in config → `manuals/` or `architecture/` at the project root, said once.

### Step 8: Secondary target

**Confluence** (epic, manual, architecture, process; skip on `--dry-run`): requires Cloud ID and Confluence Parent Page in config, else skip and say the document is local only (run stays `success`). Space from `--space-key`, else config, else ask. `searchConfluence` by title in the space: none → `createConfluenceContent` under the parent page; one → `updateConfluenceContent` (with `--force`: create a new page and warn about the duplicate); several → ask. Pass the reason as the version comment. On error, surface it, mark `failed`, do not retry more than twice.

**CRM Knowledge draft** (knowledge; `Platform` must be `salesforce`, else skip and keep `success`): convert with a deterministic renderer over the canonical subset, using classes and anchors from the style template article; compare structure against the style article. Existing article: move master to draft (`sf data` on the Knowledge object per `stack.config.md > Knowledge Articles`), fill the details field. No article: query the record type by developer name, create, fill. Hub articles only for those the user confirmed. **Never publish**: drafts only; report the draft URL and that the article is offline.

### Step 9: Back-fill

Write the outcome (`created` / `updated` / `skipped` / `failed` / `blocked`) into `published:` and the changelog row. For `epic` and `manual`, add one comment to the Jira epic with `addOrEditJiraIssueComment`: version, audience, reason, link (skip on `--dry-run`). If space or parent page were entered interactively, offer to store them in `customer.config.md`.

### Step 10: Log and summary

Create `<YYYY-MM-DD>-<customer-short-name>-<identifier>-document.json` in `.claude/skills/23-document/logs/` per the CLAUDE.md JSON schema; `summary` starts with `[type=<kind>] [audience=<profile>] [publish=ok|skipped|failed|blocked|none] [mirror=ok|skipped|failed|none]`.

Status: `success` when the file was written and the secondary target succeeded or was deliberately skipped; `partial` when the target was attempted and failed, or the validation gate stayed open; `failed` when no file was written.

Print: type and audience; version and path of the versioned file; convenience copy; mirror path or "internal only"; HTML path if written; Confluence URL or Knowledge draft URL and outcome; validation result (passes, open findings); for manual and knowledge a reminder that screenshot placeholders need replacing.

## CLI arguments

| Argument | Effect |
|---|---|
| first positional | epic key, story key(s), Confluence URL, or topic |
| `--type` | skips the type question |
| `--audience` | skips the audience question; validated against the permitted combinations |
| `--reason` | skips the reason question |
| `--format md|html` | output format; `html` writes to the documentation folder |
| `--mirror` / `--no-mirror` | skips the mirror question |
| `--publish` | Confluence or Knowledge target = yes |
| `--space-key`, `--parent-page` | Confluence overrides |
| `--dry-run` | file only; no publish, mirror or Jira comment |
| `--force` | new Confluence page instead of update |

## Important Rules

- The file is written before any publish or mirror; publishing never costs the document.
- The top level of `docs/` is never written by this skill.
- No AI attribution and no internal references in anything customer-visible.
- Facts come from the repository, the org configuration and Jira; contradictions with the domain file are reported, not resolved silently.
- The Knowledge target creates drafts only.
- All prose in the Documentation Language; UI labels verbatim in the UI Language.

## Error Handling

- Epic or story not retrievable → report and abort; nothing is written from nothing.
- Issue is not an Epic (epic, manual) → abort and ask for the parent epic.
- No stories under the epic → say so and abort.
- One story not retrievable → skip with a warning, continue.
- No topic docs (knowledge) → continue, note in the log.
- Repository unreadable (architecture, process) → report and abort; missing metadata folders → note and continue.
- No Confluence connection → skip publish, `[publish=skipped]`, `success`.
- Knowledge upload fails → store the rendered markup next to the Markdown version, `[publish=failed]`, `partial`.
- User cancels the start dialog → write nothing, print a cancellation note, log `failed` with reason "cancelled".
