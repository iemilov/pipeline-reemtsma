---
name: build-knowledge
description: Build comprehensive internal domain documentation as Markdown topic files from Jira, Confluence, codebase, and existing docs
argument-hint: <epic-id|topic>
---

## Configuration

Before executing, read `pipeline/customer.config.md` for customer-specific values (Cloud ID, Jira project key, Confluence URL, documentation language, customer identity), `pipeline/stack.config.md` for Salesforce-specific values (naming prefixes, API version, functional domains, source path), and `pipeline/customer.domain.md` for existing domain knowledge.

## Workflow: Build Internal Domain Knowledge

Generate or update a comprehensive internal domain documentation file for **$ARGUMENTS**.

**Purpose:** Internal topic files serve as deep-context reference for Claude Code — combining business logic, technical implementation, configuration, and known issues in one place per topic. Unlike `/document-us` (which creates customer-facing Confluence pages), this skill builds developer-oriented Markdown files directly in the repository.

### Step 1: Parse Input & Load Existing Documentation

1. **Auto-detect input type:**
   - If `$ARGUMENTS` matches `^[A-Z]+-\d+$` → treat as **Epic-ID**
   - Otherwise → treat as **Topic name**

2. **Determine topic name and slug:**
   - If Epic-ID: fetch the Epic from Jira using `getJiraIssue`. Derive the topic name from the Epic summary. Ask the user to confirm or adjust the topic name.
   - If Topic name: use `$ARGUMENTS` directly
   - Generate a **slug** from the topic name: lowercase, kebab-case, ASCII-only (e.g., "Testkauf" → `testkauf`, "Antrag Lifecycle" → `antrag-lifecycle`, "Pflichtschulung Jugendschutz" → `pflichtschulung-jugendschutz`)

3. **Load existing documentation:**
   - Read `pipeline/customer.domain.md` — identify the section most relevant to this topic (by heading match or keyword proximity)
   - Read the existing topic file if it exists: `pipeline/customers/<customer>/docs/<slug>.md`
   - Note what's already documented to avoid redundant research

### Step 2: Gather Sources

Collect information from all available sources. Apply **scope control** to avoid context overflow — breadth over depth.

#### 2a. Jira

- If Epic-ID: fetch Epic details + all child stories via JQL `parent = <epic-id> ORDER BY created ASC` (fetch ALL)
- If Topic: search for relevant issues via JQL `project = <project-key> AND (summary ~ "<topic>" OR description ~ "<topic>") ORDER BY created ASC` (max 50 results)
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

- Search for relevant pages: `searchConfluenceUsingCql` with CQL `title ~ "<topic>" OR text ~ "<topic>"`
- Read max 10 most relevant pages using `getConfluencePage`
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
- **Never delete** existing content without replacing it with something better
- Update the `Letzte Aktualisierung` date and source counts in the header
- Add an entry to the `Änderungshistorie` table at the bottom

**If the file is new:**

- Generate all sections from scratch based on gathered sources
- Sections with no available information: include the heading with a brief note like "Keine Informationen verfügbar — bei nächster Aktualisierung ergänzen."

#### Topic File Template

```markdown
# <Thema> — Domain Knowledge

> Letzte Aktualisierung: YYYY-MM-DD | Quellen: N Jira-Stories, N Flows, N Confluence-Seiten

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

- **Jira:** Epics und Stories (Key + Summary, gruppiert nach Epic)
- **Confluence:** Verlinkte Seiten (Titel + URL)
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

Create a log file at `.claude/skills/10-build-knowledge/logs/<YYYY-MM-DD>-<customer-short-name>-<slug>-build-knowledge.txt`

Log file format:

```text
============================================================
Skill: 10-build-knowledge
Topic: <Thema>
Slug: <slug>
Input: $ARGUMENTS (detected as: Epic-ID / Topic)
Date: YYYY-MM-DD
============================================================

Step 1: Input & Existing Documentation
----------------------------------------
- Input type: Epic-ID / Topic
- Topic name: <name>
- Slug: <slug>
- Existing topic file: found / not found
- Existing domain-knowledge section: found / not found

Step 2: Sources Gathered
-------------------------
- Jira: N stories from M epics
  - <KEY>: <Summary> (<Status>)
  ...
- Codebase: N flows, N Apex classes, N fields
  - <list of key components>
- Confluence: N pages read
  - <page titles>
- Local docs: N files read
  - <file paths>

Step 3: Topic File Written
---------------------------
- Path: pipeline/customers/<customer>/docs/<slug>.md
- Mode: created / updated (merged)
- Sections updated: <list>
- New content added: <summary>

Step 4: Structural Validation
------------------------------
- Checklist passed: yes / no (details if no)

Step 5: Index Updated
----------------------
- domain-knowledge.md: index table updated / section reference added

Step 6: Summary
----------------
- Topic file: <path>
- Sources processed: N Jira stories, N flows, N Confluence pages, N local docs
- Key findings: <brief list>
```

### Step 7: Summary

Present to the user:

- Path to the created/updated topic file
- Number of sources processed (Jira stories, Flows, Confluence pages, local docs)
- Key new findings or changes (bulleted list, max 5 items)
- Suggestions for related topics that could be documented next

## Important Rules

- Follow all conventions from CLAUDE.md
- Output text uses the **documentation language** from config (German for business, English for API names)
- Use Atlassian MCP tools for all Jira and Confluence operations
- Read **Cloud ID** and **Jira project key** from `customer.config.md` — do not hardcode
- ALWAYS create a log file named `<YYYY-MM-DD>-<customer-short-name>-<slug>-build-knowledge.txt` in `.claude/skills/10-build-knowledge/logs/`
- **Scope control:** Read at most 10 Apex classes, 15 Flows, 10 Confluence pages, 10 local doc files per execution. For Jira stories: fetch ALL stories linked to the epic(s). If topic-search: max 50 results. Summarize rather than exhaustively list every field.
- **Merge, don't overwrite:** When updating an existing topic file, never lose existing content. Add and refine.
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
