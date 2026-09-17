---
name: build-knowledge
description: Build or refresh one internal domain topic document from Jira, Confluence, the codebase and existing documentation — one Markdown file per topic under the customer's docs folder, with mandatory sources, a cross-check against the domain knowledge file, and an optional update of that file
argument-hint: <epic-key | topic name> [--refresh] [--update-domain]
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

## Purpose

Internal topic documents are the deep-context reference per subject area: business process, business rules, data model, automation with file references, configuration, interfaces, known issues and the sources every statement came from. One file per topic, no version folders. They are written for the project team, not for the customer.

The documents live in the customer's config repository so they never reach the customer-readable main repository:

```
pipeline/customers/<customer>/docs/
├── INDEX.md              ← one row per topic: title, file, last update, sources count
├── loyalty-programme.md
└── data-retention.md
```

Other skills read these documents: design-us and implement-us grep them for the components a story touches, and report which documents must be refreshed afterwards.

## Configuration

Read before executing:

- `pipeline/customer.config.md` — `Short Name`, `Documentation Language`, `UI Language` (UI labels quoted verbatim in this language), `Project Key`, `Cloud ID`, `Confluence URL`, `Platform`, `## Folder Paths` (**Knowledge Base**, default `pipeline/customers/<customer>/docs/`; **Meetings Folder**; **Code Review**)
- `pipeline/stack.config.md` — source path, naming conventions, functional domains, org aliases
- `pipeline/customer.domain.md` — the existing domain knowledge; parts of it may be **outdated** (this is one of the reasons this skill exists), so it is a source to cross-check, not a source of truth

Resolve `<customer>` from the symlink target of `pipeline/customer.config.md`. Create the docs folder and `INDEX.md` when they do not exist.

> **Platform note:** Step 2b names Salesforce component types. On another platform, search the source directories from `stack.config.md` for the equivalent component types (routes, services, migrations, components).

## Workflow

### Step 1: Parse the input and load what exists

1. **Input type:**
   - `$ARGUMENTS` matches `^[A-Z][A-Z0-9]+-\d+$` → **epic mode**: fetch the epic with `getJiraIssue` (Cloud ID from config), derive the topic name from the epic summary, and ask the user to confirm or adjust it.
   - otherwise → **topic mode**: `$ARGUMENTS` is the topic name.
   - empty → list the existing topic documents from `INDEX.md` plus the topics mentioned in `customer.domain.md` headings that have no document yet, and ask which one to build.
2. **Slug:** lowercase, kebab-case, ASCII only (`Loyalty Programme` → `loyalty-programme`).
3. **Load existing material:**
   - the topic document `<docs>/<slug>.md` if it exists (**merge mode**, see Step 3)
   - the section of `customer.domain.md` closest to the topic (heading match or keyword proximity)
   - `INDEX.md`
   - any local documents under `documentation/`, `architecture/`, `implementation-design/*/implementation-notes.md` and `decisions/` whose names or headings match the topic keywords (max 10)
4. **Refresh items:** with `--refresh`, or when design or implementation notes under `implementation-design/` reference this document as *expected documentation impact*, list the components those notes changed; every section mentioning them is a **mandatory refresh item** in Step 3.

### Step 2: Gather sources

Breadth over depth. Respect the limits so one run stays within a session.

**2a. Jira** (Atlassian MCP tools, Cloud ID from config)
- Epic mode: `searchJiraIssuesUsingJql` with `parent = <epic-key> ORDER BY created ASC` — fetch all children.
- Topic mode: `searchJiraIssuesUsingJql` with `project = <Project Key> AND (summary ~ "<topic>" OR description ~ "<topic>") ORDER BY created ASC`, max 50.
- Per issue: key, summary, status, description, acceptance criteria. Group by epic.

**2b. Codebase** (source path from `stack.config.md`)
- Flows: `flows/*<keyword>*.flow-meta.xml` — type, trigger object, purpose from `<description>`; max 15.
- Apex: grep the keywords in `classes/`; read services, batches, REST resources and handlers; skip tests and DTOs; max 10.
- Objects and fields: relevant `objects/<Object>/fields/*.field-meta.xml` — summarise counts, name the key fields with type and help text.
- Validation rules, custom metadata types and their records, custom settings, permission sets touching the objects.
- LWC and Aura components related to the topic; max 3.
- Record file paths for every component you describe.

**2c. Confluence** (only when `Confluence URL` and `Cloud ID` are set)
- `searchConfluence` with the topic keywords; read the 10 most relevant pages with `getConfluenceContent`.
- Extract business context, process descriptions and decision rationale; keep page title and URL for the sources.

**2d. Local documentation** — the files found in Step 1.3.

If a source is unreachable (Jira, Confluence), continue with the others and record the gap in the document's *Sources* section and in the log.

### Step 3: Write or merge the topic document

Write `<docs>/<slug>.md` in the **Documentation Language** from config, using this structure. Keep every heading; a section without information keeps its heading and a one-line note "No information available yet — add on the next refresh."

```markdown
# <Topic> — Domain Knowledge

> Last update: YYYY-MM-DD | Sources: N Jira issues, N flows, N Apex classes, N Confluence pages, N local documents

## Overview
3–5 sentences: what the topic is, why it exists, who the actors are.
See also: [other-topic.md](other-topic.md) — one line why.

## Purpose and business process
Step-by-step flow with actors, triggers and outcome. Status flows as a list or ASCII diagram. Variants and special cases in sub-sections. Follow-up processes belong here too.

## Business rules
One rule per bullet, short, with the reason. Only rules and constraints — no process narrative, no integration details.

## Configuration
Custom metadata types and their records (as tables), custom settings, named constants, bypass switches, scheduled jobs and their times, record type assignments. Mandatory section, even when short.

## Technical implementation
### Data model
| Field (API name) | Type | Description |
Objects, key fields, record types, relationships. Picklists complete, never excerpts.
### Automation
| Component | Type | Purpose |
Flows, Apex classes, triggers, batch and scheduled jobs — name exactly as in metadata, with the file path in the Purpose column.
### Interfaces
External systems, endpoints, direction, payload contract, authentication — with file references.

## Known issues and workarounds
Bugs, limitations, technical debt, each with the workaround if one exists. Include contradictions found between sources (see Step 4).

## Sources
- **Jira:** epics and stories as bare keys with summary, grouped by epic — e.g. `AP2-1583 JPS: Deactivation of loyalty program`
- **Confluence:** `[Page title](<page URL>)` — always a Markdown link with the page URL
- **Codebase:** file paths of the components described above
- **Local documents:** paths
- **Gaps:** sources that could not be read in this run

## Change history
| Date | Change | Source |
|------|--------|--------|
| YYYY-MM-DD | Initial version | AP2-xxxx, codebase analysis |
```

**Writing rules**
- Documentation Language for prose; API names, class names and file paths verbatim in backticks.
- Tables have at most three content columns.
- Be specific and opinionated: name inconsistencies, missing automation, duplicated configuration and technical debt.
- Content ownership: each subject has one primary document. Another document mentions it in at most 10 lines plus a link.
- No customer-visible language concerns: these documents are internal, so skill names and pipeline paths are allowed.

**Merge mode** (document exists): read it completely, walk the template section by section, add new facts, update outdated ones, re-verify every mandatory refresh item against the current code, never delete content without replacing it with something better, update the header line, and append a change-history row.

**Cross-references:** after writing, check the other documents in `<docs>/`. Add a *See also* line where subjects connect, add back-links in the other documents, and give every touched document a change-history row.

### Step 4: Cross-check against the domain knowledge file

Compare the new document with the matching section of `customer.domain.md`:

1. List every statement in the domain file that the sources contradict (thresholds, names, field names, process steps, statuses). Example from this customer: the domain file describes four loyalty tiers with different thresholds, the metadata defines three per brand with 750 and 1,500 points.
2. Write the contradictions into the topic document under *Known issues and workarounds* as "Domain knowledge file outdated: …", with the correct value and its source.
3. **Offer the update** with `AskUserQuestion` (or when `--update-domain` was passed, do it directly): replace the outdated statements in `customer.domain.md` with the verified ones, keep the section's structure, and add a blockquote at its end:
   ```markdown
   > **Detailed documentation:** [docs/<slug>.md](docs/<slug>.md) — updated YYYY-MM-DD
   ```
   Without confirmation, only the blockquote reference is added, never the content.

### Step 5: Update the index

Create or update `<docs>/INDEX.md`:

```markdown
# Domain Knowledge Index

| Topic | File | Last update | Sources |
|-------|------|-------------|---------|
| Loyalty Programme | [loyalty-programme.md](loyalty-programme.md) | 2026-09-17 | 12 Jira, 8 flows, 14 classes |
```

Also make sure `customer.domain.md` has a section **"Topic documentation"** (after the glossary) with the same table, so a reader of the domain file finds the details.

### Step 6: Validate

Before finishing, check:
1. All headings of the template present; *Sources* and *Configuration* not empty.
2. Business rules contain only rules.
3. All tables ≤ 3 content columns; picklists complete.
4. Every component in *Automation* and *Interfaces* has a file path; every Confluence entry has a URL.
5. *See also* links resolve to existing files.
6. Contradictions with the domain file are listed.

### Step 7: Log and summary

Create `<YYYY-MM-DD>-<customer-short-name>-<slug>-build-knowledge.json` in `.claude/skills/10-build-knowledge/logs/` per the CLAUDE.md JSON schema; `summary` starts with `[mode=new|merge] [sources=<jira>/<flows>/<classes>/<confluence>/<local>] [domain-updated=yes|no]`, `artifacts` lists the topic document, `INDEX.md` and, when changed, `customer.domain.md` and cross-linked documents.

Present: the document path, source counts, up to five key findings, the contradictions with the domain file and whether they were applied, and suggested next topics (components with many references and no document first).

## Important Rules

- Follow all conventions from CLAUDE.md.
- Jira and Confluence only through the Atlassian MCP tools with the Cloud ID and Project Key from config; never hardcode.
- **Sources are mandatory.** A statement without a source is marked "unverified" in the text.
- Scope limits: 10 Apex classes, 15 flows, 10 Confluence pages, 10 local documents per run; all Jira issues of an epic; 50 for a topic search.
- Merge, never overwrite. Never delete existing content without a better replacement.
- The domain knowledge file is updated only with the user's confirmation or `--update-domain`; the reference blockquote is always added.
- Documents live under the customer's docs folder in the config repository, never in the main repository.

## Error Handling

- Epic not fetchable: report the error and abort.
- No Jira results for a topic: continue with the other sources.
- Confluence unreachable or not configured: continue, note the gap under *Sources*.
- Docs folder missing: create it with an empty `INDEX.md`.
- A source file unreadable: skip it with a warning in the log.
- Topic file not writable: put the content into the log's `output` and tell the user.
