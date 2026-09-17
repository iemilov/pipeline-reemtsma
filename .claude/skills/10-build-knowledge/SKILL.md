---
name: build-knowledge
description: Build comprehensive internal domain documentation as Markdown topic files from Jira, Confluence, codebase, and existing docs
argument-hint: <epic-id|topic>
preferred-runtime: claude-code
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`


> **Runtime hint:** This skill prefers `claude-code` (multi-source knowledge synthesis). If the active `Agent Runtime` (from `customer.config.md`) differs after applying any `## Skill Runtime Overrides`, print the standardized warning from `pipeline/agent-runtime-access.md` §1a and proceed. Record `active_runtime`, `preferred_runtime`, and `runtime_match` in the execution log.

## Configuration

Before executing, read `pipeline/customer.config.md` for customer-specific values (Atlassian Deployment Type, Jira project key, Confluence URL, documentation language, **UI Language** — the language the end-user-facing UI is built in; when knowledge entries reference UI labels, menus, or screens, quote them verbatim in the UI Language, customer identity, **Platform**), `pipeline/stack.config.md` for stack-specific values (naming prefixes, API version, functional domains, source path), and `pipeline/customer.domain.md` for existing domain knowledge. For all Jira and Confluence calls, consult the **Atlassian adapter** at `pipeline/atlassian-access.md`.

> **Platform note:** Step 2b (Codebase) references Salesforce-specific paths and components (`force-app/`, Flows, Apex, Trigger Actions, LWC). If `Platform` in `customer.config.md` is not `salesforce`, search the project's source directories from `stack.config.md` instead and look for the equivalent component types (e.g., React components, API routes, database migrations).

## Workflow: Build Internal Domain Knowledge

Generate or update a comprehensive internal domain documentation file for **$ARGUMENTS**.

**Purpose:** Internal topic files serve as deep-context reference — combining business logic, technical implementation, configuration, and known issues in one place per topic. Unlike `/08-document` (which produces per-epic, per-manual, per-article documents with a version history under `docs/<kind>/`), this skill owns the **top level** of the docs folder: `docs/<slug>.md`, one file per topic, no version folders. The two never write into each other's space.

### Step 1: Parse Input & Load Existing Documentation

1. **Auto-detect input type:**
   - If `$ARGUMENTS` matches `^[A-Z]+-\d+$` → treat as **Epic-ID**
   - If `$ARGUMENTS` is empty or `--gaps` → **gap-driven mode**: the business
     chat's gap log is the input queue (see step 1a)
   - Otherwise → treat as **Topic name**

1a. **Check the input queues — chat gaps and knowledge debt (always, in every mode):**
   - Run `pipeline/bin/chat-gaps list` — every entry is a question the
     business chat could not answer from the current knowledge base.
   - Run `pipeline/bin/knowledge-debt list` — every entry is a knowledge doc
     that describes a component a `/implement-us` run has since changed
     (enqueued mechanically in its Step 8c), with the story and the tokens
     that hit. Open debt means the doc is potentially stale right now.
   - **Gap-driven mode:** cluster the open gap questions into topic
     candidates (group by shared domain terms), and add one candidate per
     doc that carries open debt entries (each affected doc maps naturally to
     one topic file). Present the clusters with their question/entry counts
     via `AskUserQuestion`, and let the user pick the topic to build this
     run. Abort gracefully if no gaps and no debt entries are open.
   - **Epic/Topic mode:** note which open gaps the given topic would cover —
     the topic file MUST answer those questions explicitly (they are real
     user demand, not hypothetical structure) — and which open debt entries
     the topic's file carries: those entries' tokens are **mandatory refresh
     items** for Step 3.

2. **Determine topic name and slug:**
   - If Epic-ID: fetch the Epic from Jira via the Atlassian adapter's `getJiraIssue` operation (see `pipeline/atlassian-access.md` §3 — branch on `Deployment Type` from `customer.config.md`). Derive the topic name from the Epic summary. Ask the user to confirm or adjust the topic name.
   - If Topic name: use `$ARGUMENTS` directly
   - Generate a **slug** from the topic name: lowercase, kebab-case, ASCII-only (e.g., "Testkauf" → `testkauf`, "Antrag Lifecycle" → `antrag-lifecycle`, "Pflichtschulung Jugendschutz" → `pflichtschulung-jugendschutz`)

3. **Load existing documentation:**
   - Read `pipeline/customer.domain.md` — identify the section most relevant to this topic (by heading match or keyword proximity)
   - Read the existing topic file if it exists: `pipeline/customers/<customer>/docs/<slug>.md`
   - Note what's already documented to avoid redundant research

### Step 2: Gather Sources

Collect information from all available sources. Apply **scope control** to avoid context overflow — breadth over depth.

#### 2a. Jira

- If Epic-ID: fetch Epic details + all child stories via the adapter's `searchJiraIssuesUsingJql` operation (adapter §3 — epic-link JQL differs by deployment type: Cloud uses `parent = <epic-id> ORDER BY created ASC`; DC uses `"Epic Link" = <epic-id> ORDER BY created ASC`). Fetch ALL.
- If Topic: search for relevant issues via the adapter's `searchJiraIssuesUsingJql` operation with JQL `project = <project-key> AND (summary ~ "<topic>" OR description ~ "<topic>") ORDER BY created ASC` (max 50 results)
- For each story: read summary, description, status, and acceptance criteria
- Group stories by Epic for overview

#### 2b. Codebase

Search the Salesforce source directory (`force-app/main/default/`) for components related to the topic. Use keywords derived from the topic name, the Jira stories, and the naming prefixes from `stack.config.md`.

- **Flows:** Glob `**/flows/*<keyword>*` — read metadata to determine type, trigger object, and purpose. Max 15 flows.
- **Apex classes:** Grep for topic keywords — read service classes, batch jobs, and handlers. Skip test classes and DTOs. Max 10 classes.
- **Custom Fields/Objects:** Glob for relevant field metadata. Summarize field counts, highlight key fields.
- **Validation Rules:** Read rules on relevant objects.
- **Trigger Actions:** Read `Trigger_Action__mdt` records for relevant objects.
- **LWC/Aura:** Search for UI components related to the topic. Max 3 components.

#### 2c. Confluence

- Search for relevant pages via the adapter's `searchConfluenceUsingCql` operation (adapter §4) with CQL `title ~ "<topic>" OR text ~ "<topic>"`
- Read max 10 most relevant pages via the adapter's `getConfluencePage` operation
- Extract business context, process descriptions, and decision rationale

#### 2d. Existing Local Documentation

- Search `business/docs/` for related files: Glob `business/docs/**/*<keyword>*`
- Read max 10 relevant files (Markdown, text)
- Extract operational knowledge, known issues, and lessons learned

### Step 3: Generate or Update Topic File

Write the topic file to `pipeline/customers/<customer>/docs/<slug>.md` using the standard template below.

**If the file already exists (merge mode):**

- Read the existing file completely
- Go section by section through the template
- **Add** new information discovered from sources (new stories, new flows, new business rules)
- **Update** outdated information (status changes, resolved issues, corrected details)
- **Mandatory refresh items** (open debt entries from Step 1a): for each entry, re-verify every section that mentions the entry's tokens against the current implementation state — the component changed after the section was written, so update the content, don't just append new material
- **Never delete** existing content without replacing it with something better
- Update the `Letzte Aktualisierung` date and source counts in the header
- Add an entry to the `Änderungshistorie` table at the bottom

**If the file is new:**

- Generate all sections from scratch based on gathered sources
- Sections with no available information: include the heading with a brief note like "Keine Informationen verfügbar — bei nächster Aktualisierung ergänzen."

#### Topic File Template

```markdown
# <Thema> — Domain Knowledge

> Letzte Aktualisierung: YYYY-MM-DD | Quellen: N Jira-Stories, N Flows, N Confluence-Seiten (Confluence <id>, <id>)

## Überblick

Kurze Zusammenfassung (3-5 Sätze): Was ist das Thema, warum existiert es, wer sind die Akteure.

## Geschäftsprozess

Fachlicher Ablauf (Schritt für Schritt) mit Akteuren, Auslösern und Ergebnis.
Status-Flows als Aufzählung oder ASCII-Diagramm.
Varianten und Sonderfälle in eigenen Unterabschnitten.
Hierher gehören auch Folgeprozesse (z.B. Vertragsstrafe, Eskalation) — alles was einen zeitlichen Ablauf hat.

## Business Rules

Validierungen, Constraints, Fristen, Berechtigungen, Eskalationsregeln.
Jede Regel als eigener Aufzählungspunkt mit Erklärung.
NUR kurze Regeln/Constraints — KEINE Prozessbeschreibungen oder Abläufe (→ gehören unter Geschäftsprozess).
NUR technische Integrationen erwähnen wenn sie eine Regel darstellen, nicht den Integrationsprozess selbst (→ Technische Umsetzung).

## Technische Umsetzung

### Datenmodell

Beteiligte Objekte, Felder (als Tabelle), Record Types, Beziehungen.

### Automation

Flows, Apex-Klassen, Trigger Actions, Batch/Scheduled Jobs — jeweils mit Name, Typ und Zweck.

### Integrationen

Externe Systeme, API-Endpunkte, Datenfluss.

## Konfiguration

Custom Metadata, Custom Settings, benannte Konstanten, umgebungsspezifische Einstellungen.
PFLICHTSEKTION — auch wenn nur wenige Einträge. Bypass Switches, RecordType-Assignments, CMT-Einträge, Scheduled Jobs, Quick Action Sichtbarkeit.

## Bekannte Probleme & Workarounds

Bugs, Einschränkungen, technische Schulden. Jeweils mit Workaround wenn vorhanden.

## Referenzen

- **Jira:** Epics und Stories (Key + Summary, gruppiert nach Epic) — Keys nackt, z.B. `CRM-1234`
- **Confluence:** `[Seitentitel](https://<confluence>/pages/<id>)` (<id>, v<version>) — immer als Markdown-Link mit Seiten-URL, nie nur Titel
- **Codebase:** Wichtigste Dateipfade

## Änderungshistorie

| Datum | Änderung | Quelle |
|-------|----------|--------|
| YYYY-MM-DD | Initiale Erstellung | CRM-XXXX, Codebase-Analyse |
```

**Writing guidelines:**

- Language: German for business content, English for technical identifiers (API names, class names)
- Be specific: field API names in backticks, flow names exactly as in metadata
- Include concrete examples where helpful (e.g., "Status 'Zugewiesen an 2nd Level' erfordert `STLGS_ChecksToKBDone__c = true`")
- Cross-reference other topic files where relevant: `Siehe auch: [docs/antrag-lifecycle.md](antrag-lifecycle.md)`

**Table format standard (mandatory):**

- Datenmodell-Felder: `| Feld (API-Name) | Typ | Beschreibung |` — 3 Spalten
- Flows/Automation: `| Flow / Komponente | Typ | Zweck |` — 3 Spalten
- Picklist-Werte: `| API-Wert | Label | Beschreibung |` — 3 Spalten
- Referenz-Listen (Jira): `| Key | Summary | Status |` — 3 Spalten
- Alle Tabellen verwenden **maximal 3 inhaltliche Spalten**. Keine 4. Spalte für Trigger/Auslöser etc. — das gehört in die Beschreibung/Zweck-Spalte.

#### Cross-References (mandatory)

After writing the topic file, check all existing topic files in `pipeline/customers/<customer>/docs/`:

1. **Überblick → "Siehe auch:"** — Am Ende des Überblick-Abschnitts eine Zeile mit Links zu verwandten Topic-Docs einfügen:
   ```
   Siehe auch: [docs/kuendigung.md](kuendigung.md) — Kündigungs- und Sperrprozess, [docs/antrag.md](antrag.md) — Antragsverfahren.
   ```
   Nur verlinken wo eine inhaltliche Verbindung besteht (gemeinsame Objekte, Folgeprozesse, geteilte Felder).

2. **Inline-Verweise:** Wenn ein Abschnitt ein Thema anschneidet, das in einem anderen Doc ausführlich beschrieben ist → kurze Zusammenfassung (max 5 Zeilen) + Verweis: `→ Details siehe [kuendigung.md](kuendigung.md)`

3. **Rückverlinkung:** Wenn das neue Doc auf ein bestehendes verweist, prüfe ob das bestehende Doc zurückverlinkt. Wenn nicht → ergänze dort ebenfalls den "Siehe auch:"-Eintrag. **WICHTIG:** Bei jeder Änderung an einem bestehenden Doc — auch wenn nur eine Cross-Reference ergänzt wird — MUSS ein neuer Eintrag in dessen Änderungshistorie-Tabelle hinzugefügt werden (z.B. `| 2026-02-20 | Cross-Reference ergänzt | Verweis auf besuche.md |`).

### Step 4: Structural Validation

Before proceeding, verify the generated/updated topic file against this checklist:

1. **Alle Pflicht-Sektionen vorhanden?** Header, Überblick, Geschäftsprozess, Business Rules, Technische Umsetzung, Konfiguration, Bekannte Probleme, Referenzen, Änderungshistorie
2. **Business Rules enthält NUR Regeln?** Keine Prozessbeschreibungen, keine Integrations-Details
3. **Alle Tabellen im 3-Spalten-Format?** Keine 4-Spalten-Tabellen
4. **Cross-References vorhanden?** "Siehe auch:" im Überblick, Inline-Verweise wo nötig
5. **Keine inhaltlichen Duplikate?** Themen die ein eigenes Doc haben → nur Kurzfassung + Link
6. **Picklist-Werte vollständig?** Bei Picklistfeldern IMMER die komplette Liste, keine Auszüge

### Step 5: Update domain-knowledge.md Index

1. Open `pipeline/customer.domain.md`
2. Find or create the section **"Themen-Dokumentation (Detail)"** — it should appear after the Glossar section and before "Organisationsstruktur"
3. Update the index table — add or update the row for this topic:

```markdown
## Themen-Dokumentation (Detail)

Die folgenden Topic-Dateien enthalten detaillierte fachliche und technische Dokumentation pro Themengebiet. Die Sections in diesem Dokument dienen als Kurzübersicht — für vollständige Details siehe die verlinkten Dateien.

| Thema | Datei | Aktualisiert |
|-------|-------|--------------|
| Testkauf | [docs/testkauf.md](docs/testkauf.md) | 2026-02-20 |
```

4. Find the existing section in domain-knowledge.md that corresponds to this topic (e.g., "Testkauf (TK) — Test Purchase" for topic "Testkauf")
5. If found, add a blockquote reference at the end of that section:

```markdown
> **Detaillierte Dokumentation:** [docs/testkauf.md](docs/testkauf.md)
```

### Step 6: Create Log File

- ALWAYS write the execution log with `pipeline/bin/log-skill` — never hand-author the JSON. Run:
  ```bash
  pipeline/bin/log-skill --skill build-knowledge --identifier <slug> --status <success|partial|failed> \
    --preferred-runtime claude-code \
    --summary "<1–2 sentence result>" \
    --artifact <path> \
    --output "<full run text>"
  ```
  It guarantees a schema-valid document and writes it to `pipeline/customers/<customer>/logs/<YYYY-MM-DD>-<customer-short-name>-<slug>-build-knowledge.json` (customer, active runtime, and timestamp resolve from config automatically; pass `--artifact` once per created/modified file; the directory is created if needed).

### Step 6a: Resolve Covered Gaps & Debt

Close the loop that makes both input queues a queue instead of a graveyard:

1. Re-run `pipeline/bin/chat-gaps list` and identify every open gap whose
   question the created/updated topic file now answers.
2. Present the matched gaps to the user for confirmation (question + where
   the answer now lives). Only resolve what the user confirms.
3. Resolve them with a note pointing at the covering document:
   ```bash
   pipeline/bin/chat-gaps resolve <n> [<n>...] --note "docs/<slug>.md"
   ```
   Resolved entries move to `chat-gaps.resolved.jsonl` (audit trail); the
   question re-enters the open log only if it is asked again and is STILL
   unanswerable.
4. If a matched gap is only partially covered, leave it open and mention it
   in the summary instead.
5. Re-run `pipeline/bin/knowledge-debt list` and identify every open debt
   entry whose doc this run updated **and** whose tokens the refreshed
   sections now reflect (the mandatory refresh items from Step 1a/Step 3).
   Present them to the user for confirmation; resolve only what the user
   confirms:
   ```bash
   pipeline/bin/knowledge-debt resolve <n> [<n>...] --note "docs/<slug>.md"
   ```
   Resolved entries move to `knowledge-debt.resolved.jsonl` (audit trail);
   an entry only partially covered stays open, mentioned in the summary. A
   changed component re-enters the queue on the next `/implement-us` run
   that touches it.

> **Hinweis:** A running chat server deduplicates gap logging in memory —
> resolved questions re-enter the log after the next server restart at the
> earliest.

### Step 7: Summary

Present to the user:

- Path to the created/updated topic file
- Number of sources processed (Jira stories, Flows, Confluence pages, local docs)
- Key new findings or changes (bulleted list, max 5 items)
- **Gap-Log-Bilanz:** how many gaps were open, how many this run resolved
  (with their questions), how many remain open
- **Debt-Bilanz:** how many knowledge-debt entries were open before this run,
  how many it resolved (with their docs and stories), how many remain open
- Suggestions for related topics that could be documented next — open gaps
  and open debt first, they are proven demand and known staleness

## Important Rules

- Follow all conventions from CLAUDE.md
- Output text uses the **documentation language** from config (German for business, English for API names)
- Use the Atlassian adapter (`pipeline/atlassian-access.md`) for all Jira and Confluence operations — branch on `Deployment Type` from `customer.config.md`; never hardcode URLs, Cloud IDs, or PAT env var names
- Read **Jira project key** from `customer.config.md` — do not hardcode
- ALWAYS write the execution log with `pipeline/bin/log-skill` (see Step 6) — never hand-author the JSON; it writes `<YYYY-MM-DD>-<customer-short-name>-<slug>-build-knowledge.json` into `pipeline/customers/<customer>/logs/`
- **Scope control:** Read at most 10 Apex classes, 15 Flows, 10 Confluence pages, 10 local doc files per execution. For Jira stories: fetch ALL stories linked to the epic(s). If topic-search: max 50 results. Summarize rather than exhaustively list every field.
- **Merge, don't overwrite:** When updating an existing topic file, never lose existing content. Add and refine.
- **Referenzen maschinell auflösbar:** Der Business-Chat leitet aus dem Topic-Doc die Quellen-Links unter jeder Antwort ab — beim Indexaufbau, ohne Atlassian-Zugriff. Damit das trägt: Confluence-Seiten **immer als Markdown-Link mit Seiten-URL** (`[Titel](https://…/pages/<id>)`), nie als Titel ohne URL; Jira-Issues als **nackter Key** (`CRM-1234`) im Fließtext des Abschnitts, in dem sie relevant sind; die Kopfzeile nennt die primären Seiten als `Confluence <id>`. Die Überschrift `## Referenzen` bleibt wörtlich so — sie ist der Anker, an dem der Chat die dokumentweiten Quellen erkennt. Jira-Keys in der Referenzen-Tabelle werden bewusst **nicht** dokumentweit verlinkt (ein Topic-Doc zitiert Dutzende), nur Keys im zitierten Abschnitt selbst.
- **Be opinionated:** Document not just what exists, but call out inconsistencies, missing automation, and technical debt
- Topic files are internal developer documentation — be precise and technical. No marketing language.
- **Content Ownership:** Jedes Thema hat EIN primäres Topic-Doc. Wenn ein Prozess in mehreren Docs relevant ist:
  - Das **primäre Doc** enthält die vollständige Beschreibung
  - Andere Docs enthalten eine **Kurzfassung** (max 5-10 Zeilen) + Verweis auf das primäre Doc
  - Beispiel: Der Sperr-/Kündigungsprozess gehört primär in `kuendigung.md`. In `testkauf.md` steht nur: "Bei Ampel-Schließung wird automatisch ein Kündigungsvorgang erstellt → Details siehe kuendigung.md"
  - **Faustregel:** Wenn du >10 Zeilen über ein Thema schreibst, das ein eigenes Doc hat/haben sollte → kürzen + verlinken

## Error Handling

- If the Epic cannot be fetched from Jira, inform the user with the error details and abort
- If no Jira stories are found for a topic search, continue with other sources (codebase, Confluence, local docs) — Jira is not the only source
- If Confluence is unreachable or returns no results, continue with other sources and note the gap in the log
- If the topic file cannot be written, save the content to the log file as fallback and inform the user
- If domain-knowledge.md cannot be updated (e.g., index section not found), create the index section from scratch
- If a specific source cannot be read (file permission, API error), skip it with a warning in the log but continue with other sources
