---
name: write-crm-doc
description: Erstellt oder aktualisiert einen Salesforce Knowledge Artikel (CRM Dokumentation) als Draft auf Basis von Jira-Stories, Domain Knowledge, Topic Docs und dem gesamten Repository
argument-hint: [story-key(s), kommagetrennt]
---

## Platform Guard

This skill requires `Platform: salesforce` in `customer.config.md`. If the active customer uses a different platform, inform the user that this skill is Salesforce-specific and abort.

## Configuration

Before executing, read:
- `pipeline/customer.config.md` for customer-specific values (Cloud ID, Jira project key, including `Platform`)
- `pipeline/stack.config.md` for:
  - Org aliases (PROD alias for Knowledge article queries)
  - Source path (for codebase exploration)
  - **Knowledge Articles** section: Knowledge object API name, details field, RecordType DeveloperName, style template articles, hub articles

---

## Workflow: Jira-Stories → Salesforce Knowledge Artikel (Draft)

Execute the following steps for **$ARGUMENTS**:

---

### Schritt 1: Kontext laden

1. Story-Key(s) aus `$ARGUMENTS` parsen (kommagetrennte Liste möglich)
2. Jira-Issue(s) über `getJiraIssue` abrufen (Cloud ID aus `customer.config.md`)
   - Summary, Beschreibung, Akzeptanzkriterien extrahieren
   - Status und Verlinkungen notieren
3. `pipeline/customer.domain.md` lesen – Glossar, Feldbegriffe, Abkürzungen, Geschäftslogik
4. Passende Topic-Docs aus `pipeline/customers/<customer>/docs/` lesen:
   - Dateien anhand der Story-Thematik auswählen
   - Verfügbare Dateien durch Glob auf das docs-Verzeichnis ermitteln
5. Relevante Implementierungsdateien aus dem Repository lesen:
   - Source path aus `stack.config.md` nach Dateien durchsuchen, die thematisch zur Story passen (Namen, Labels, Kommentare)
   - Ziel: vollständige technische Basis für die Dokumentation aus dem tatsächlichen Implementierungsstand
6. Relevante bestehende Knowledge Artikel (Stilvorlagen) in Salesforce Production abfragen — read the **Style Template Articles** from `stack.config.md` and query them:
   ```
   sf data query --target-org <prod-alias> --query "SELECT Id, Title, ArticleNumber, <details-field> FROM <knowledge-object> WHERE ArticleNumber IN ('<article-number-1>','<article-number-2>') AND PublishStatus = 'Online'" --json
   ```
   Use the Knowledge object, details field, and article numbers from the **Knowledge Articles** config section.

---

### Schritt 2: Bestehenden Artikel prüfen & Hub-Artikel analysieren

**2a. Zielartikel suchen:**

Read the `RecordType DeveloperName` from `stack.config.md` Knowledge Articles section:
```
sf data query --target-org <prod-alias> --query "SELECT Id, KnowledgeArticleId, Title, ArticleNumber, PublishStatus, <details-field> FROM <knowledge-object> WHERE RecordType.DeveloperName = '<recordtype-devname>' ORDER BY ArticleNumber DESC" --json
```

Anhand der Story-Thematik den passenden Artikel identifizieren (Titel-Vergleich):
- **Fall A – Artikel existiert (Online):** Artikel-Metadaten und aktuelle Version merken → wird in Schritt 4 als Draft angelegt
- **Fall B – kein Artikel vorhanden:** Neuer Artikel wird in Schritt 4 erstellt

**2b. Hub-Artikel auf Aktualisierungsbedarf prüfen:**

Read the **Hub Articles** table from `stack.config.md`. For each hub article, apply its check mode:

- **"Always" hub articles:** Query the article and check if the target article is already linked. If not, recommend where to add the link.
- **"On request only" hub articles:** Ask the user via `AskUserQuestion` whether to check this hub article. Only query if the user confirms.

Present a summary to the user:
```
Hub-Artikel: <title> (<article-number>)
→ Zielartikel noch nicht verlinkt. Empfehlung: Link in Abschnitt „..." ergänzen.

Hub-Artikel: <title> (<article-number>)
→ Nur auf Wunsch des Users prüfen/aktualisieren.
```

Ask the user via `AskUserQuestion` whether to update the "always" hub article(s) as draft.

---

### Schritt 3: HTML-Inhalt generieren

Den Artikelinhalt als HTML generieren. Inhaltsbasis: **alle gesammelten Quellen** (Jira-Stories, `customer.domain.md`, Topic Docs, Repository-Dateien aus source path).

**Pflicht-Struktur:**

```html
<!-- Einleitung -->
<p><strong><span style="font-size: 20px;">Einleitung</span></strong></p>
<p><span style="font-size: 16px;">...</span></p>
<p> </p>

<!-- Inhaltsverzeichnis -->
<p><strong><span style="font-size: 20px;">Inhaltsverzeichnis</span></strong></p>
<ul>
  <li style="font-size: 16px;"><a href="#abschnitt1" target="_self"><span style="font-size: 16px;">Abschnittstitel 1</span></a></li>
  ...
</ul>
<p> </p>

<!-- Abschnitt mit Anchor -->
<p><a id="abschnitt1" target="_blank"><span style="font-size: 16px;"><strong>Abschnittstitel 1</strong></span></a></p>

<!-- Zweispaltige Tabelle -->
<table border="1" style="width: 100%;"><tbody>
  <tr>
    <td style="width: 50%;text-align: center;"><strong><span style="font-size: 16px;">Blick ins System</span></strong></td>
    <td style="width: 50%;text-align: center;"><strong><span style="font-size: 16px;">Beschreibung</span></strong></td>
  </tr>
  <tr>
    <td style="width: 50%;vertical-align: top;"><!-- Screenshot-Platzhalter --></td>
    <td style="width: 50%;vertical-align: top;">
      <p><strong><span style="font-size: 16px;">Aktionsname / Überschrift</span></strong></p>
      <ul>
        <li style="font-size: 16px;"><span style="font-size: 16px;">Schritt mit <em>Feldname</em> und <strong>Button-Name</strong></span></li>
      </ul>
    </td>
  </tr>
</tbody></table>
<p> </p>
```

**Stilregeln:**
- `font-size: 16px` für alle Fließtexte, Listen, Tabelleninhalte
- `font-size: 20px` für Abschnittsüberschriften (Einleitung, Inhaltsverzeichnis)
- `<strong>` für Button-Namen und Aktionen
- `<em>` für Feldnamen und Statuswerte
- `<span style="text-decoration: underline;">Hinweis</span>:` für wichtige Hinweise
- Interne Links: `<a href="/articles/Knowledge/URL-Slug" target="_self" data-lightning-target="_self">Linktext</a>`
- Screenshot-Spalte vorerst leer lassen (werden manuell ergänzt)

---

### Schritt 4: Draft in Salesforce anlegen/aktualisieren

**Zugangsdaten holen:**
```python
import subprocess, json
result = subprocess.run(['sf', 'org', 'display', '--target-org', '<prod-alias>', '--json'], capture_output=True, text=True)
data = json.loads(result.stdout)
token = data['result']['accessToken']
instance = data['result']['instanceUrl']
api_version = # read from stack.config.md
```

**Fall A – bestehenden Artikel als Draft anlegen:**
```python
# 1. Draft-Version erstellen (archiviert die Online-Version)
subprocess.run(['curl', '-s', '-X', 'PATCH',
  f'{instance}/services/data/v{api_version}/knowledgeManagement/articleVersions/masterVersions/{online_version_id}',
  '-H', f'Authorization: Bearer {token}',
  '-H', 'Content-Type: application/json',
  '-d', '{"publishStatus":"Draft"}'])

# 2. Neue Draft-ID abfragen
result = subprocess.run(['sf', 'data', 'query', '--target-org', '<prod-alias>',
  '--query', f"SELECT Id FROM <knowledge-object> WHERE KnowledgeArticleId = '{article_id}' AND PublishStatus = 'Draft'",
  '--json'], capture_output=True, text=True)
draft_id = json.loads(result.stdout)['result']['records'][0]['Id']

# 3. Inhalt befüllen — use <details-field> from config
payload = json.dumps({'<details-field>': html_content, 'Title': title})
with open('/tmp/payload.json', 'w') as f: f.write(payload)
subprocess.run(['curl', '-s', '-X', 'PATCH',
  f'{instance}/services/data/v{api_version}/sobjects/<knowledge-object>/{draft_id}',
  '-H', f'Authorization: Bearer {token}',
  '-H', 'Content-Type: application/json',
  '--data-binary', '@/tmp/payload.json'])
```

**Fall B – neuen Artikel erstellen:**

Query the RecordType ID dynamically:
```bash
sf data query --target-org <prod-alias> --query "SELECT Id FROM RecordType WHERE SObjectType = '<knowledge-object>' AND DeveloperName = '<recordtype-devname>'" --json
```

Then create the record:
```
sf data create record --target-org <prod-alias> --sobject <knowledge-object> \
  --values "Title='<Titel>' RecordTypeId='<queried-id>'"
```
Dann Inhalt per curl PATCH befüllen (wie oben, Schritt 3).

**Hub-Artikel (falls vom User bestätigt):** gleicher Ablauf (Fall A).

---

### Schritt 5: Zusammenfassung & Log

**Ausgabe:**
- Draft-URL(s): `<instance-url>/lightning/r/<knowledge-object>/{draftId}/view` (instance URL from `sf org display`)
- Hinweis: Artikel ist offline bis zur manuellen Veröffentlichung
- Liste aller angelegten/aktualisierten Drafts

**Log-Datei erstellen:**
```
pipeline/.claude/skills/13-write-crm-doc/logs/YYYY-MM-DD-<customer-short-name>-{story-key}-write-crm-doc.json
```
Inhalt: komplette Ausgabe inkl. Story-Zusammenfassung, generiertem HTML, Draft-IDs und URLs.

---

## Wichtige Regeln

- **Niemals publizieren** – ausschließlich Drafts anlegen; verantwortliche Person publiziert manuell nach Prüfung
- **RecordType** dynamisch abfragen oder `DeveloperName` aus `stack.config.md` verwenden — niemals IDs hardcoden
- **Org-Alias** aus `stack.config.md` lesen — niemals hardcoden
- **Cloud ID** für Jira aus `customer.config.md` lesen — niemals hardcoden
- **Knowledge object, details field, article numbers** aus der Knowledge Articles Section in `stack.config.md` lesen — niemals hardcoden
- **HTML-Stil** strikt wie oben einhalten: zweispaltige Tabellen, font-size 16px/20px, bold/italic
- **Inhaltsquellen**: Jira-Stories + `customer.domain.md` + passende Topic Docs aus `pipeline/customers/<customer>/docs/` + relevante Repository-Dateien aus source path – alle verfügbaren Quellen nutzen
- **Hub-Artikel prüfen**: Read hub articles from `stack.config.md` and apply their respective check modes

## Tonalität & Wording

- **Bearbeitungsmaske statt Flow**: Salesforce Screen Flows werden in der Dokumentation immer als „Bearbeitungsmaske" bezeichnet – niemals als „Flow", „Screen Flow" oder „geführter Flow"
- **Button-Wording**: Aktionen, die durch einen Button ausgelöst werden, immer mit „Klick auf **Button-Name**" einleiten
- **Kein technisches Innenleben**: Interne Implementierungsdetails gehören nicht in die Dokumentation – konkret weglassen:
  - Profil- und Rechtehinweise
  - Interne Feldnamen als Guard-Mechanismus
  - Flow-/Apex-Klassennamen
  - Technische IDs oder API-Namen, die für den Endanwender irrelevant sind
- **Anwendersprache**: Formulierungen aus Nutzerperspektive – was sieht der User, was klickt er, was passiert sichtbar im System

## Error Handling

- Jira-Issue nicht abrufbar → Fehlermeldung ausgeben, abbrechen
- Kein passender Topic-Doc → ohne fortfahren, im Log vermerken
- Salesforce PATCH schlägt fehl (z.B. bereits ein Draft vorhanden) → Draft-ID abfragen und direkt aktualisieren
- curl gibt Fehlerantwort zurück → Fehlermeldung ausgeben, HTML lokal in Log speichern und User informieren
