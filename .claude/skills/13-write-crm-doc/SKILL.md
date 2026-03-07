---
name: write-crm-doc
description: Erstellt oder aktualisiert einen Salesforce Knowledge Artikel (CRM Dokumentation) als Draft auf Basis von Jira-Stories, Domain Knowledge, Topic Docs und dem gesamten Repository
argument-hint: [story-key(s), kommagetrennt]
---

## Platform Guard

This skill requires `Platform: salesforce` in `customer.config.md`. If the active customer uses a different platform, inform the user that this skill is Salesforce-specific and abort.

## Configuration

Before executing, read `pipeline/customer.config.md` for customer-specific values (Cloud ID, Jira project key, including `Platform`) and `pipeline/stack.config.md` for Salesforce org aliases and naming conventions.

---

## Workflow: Jira-Stories → Salesforce Knowledge Artikel (Draft)

Execute the following steps for **$ARGUMENTS**:

---

### Schritt 1: Kontext laden

1. Story-Key(s) aus `$ARGUMENTS` parsen (kommagetrennte Liste möglich, z.B. `CRM-2956,CRM-3039`)
2. Jira-Issue(s) über `getJiraIssue` abrufen (Cloud ID aus `customer.config.md`)
   - Summary, Beschreibung, Akzeptanzkriterien extrahieren
   - Status und Verlinkungen notieren
3. `pipeline/customer.domain.md` lesen – Glossar, Feldbegriffe, Abkürzungen (RD, VO, ASt, etc.), Geschäftslogik
4. Passende Topic-Docs aus `pipeline/customers/lotto-bw/docs/` lesen:
   - Dateien anhand der Story-Thematik auswählen (z.B. `vertragsrelevante-datenaenderung.md` für Datenpflege-Themen, `kuendigung.md` für Kündigungsprozesse)
   - Verfügbare Dateien: `antrag.md`, `besuche.md`, `field-service.md`, `filialverantwortung-wechseln.md`, `kuendigung.md`, `pflichtschulung.md`, `ruecklastschrift.md`, `service-desk.md`, `testkauf.md`, `vertragsrelevante-datenaenderung.md`
5. Relevante Implementierungsdateien aus dem Repository lesen:
   - `force-app/main/default/` nach Dateien durchsuchen, die thematisch zur Story passen (Namen, Labels, Kommentare)
   - Einbeziehen: Apex-Klassen, Trigger, Flows, Custom Metadata-Typen und -Datensätze, Permission Sets, Field Sets, Validation Rules, Custom Fields
   - Ziel: vollständige technische Basis für die Dokumentation aus dem tatsächlichen Implementierungsstand
6. Relevante bestehende Knowledge Artikel (Stilvorlagen) in Salesforce Production abfragen:
   ```
   sf data query --target-org <prod-alias> --query "SELECT Id, Title, ArticleNumber, STLG_Details__c FROM Knowledge__kav WHERE ArticleNumber IN ('000001711','000001583') AND PublishStatus = 'Online'" --json
   ```
   *(Artikel 000001711 „Kündigungen erfassen & bearbeiten" und 000001583 „Vertragsrelevante Daten ändern" als Stilvorlagen)*

---

### Schritt 2: Bestehenden Artikel prüfen & Hub-Artikel analysieren

**2a. Zielartikel suchen:**
```
sf data query --target-org <prod-alias> --query "SELECT Id, KnowledgeArticleId, Title, ArticleNumber, PublishStatus, STLG_Details__c FROM Knowledge__kav WHERE RecordType.DeveloperName = 'STLGS_CRMDocumentationKnowledge' ORDER BY ArticleNumber DESC" --json
```

Anhand der Story-Thematik den passenden Artikel identifizieren (Titel-Vergleich):
- **Fall A – Artikel existiert (Online):** Artikel-Metadaten und aktuelle Version merken → wird in Schritt 4 als Draft angelegt
- **Fall B – kein Artikel vorhanden:** Neuer Artikel wird in Schritt 4 erstellt

**2b. Hub-Artikel auf Aktualisierungsbedarf prüfen:**

**000001576 „Prozesse im Vertrieb" — immer prüfen:**

```
sf data query --target-org <prod-alias> --query "SELECT Id, KnowledgeArticleId, Title, ArticleNumber, PublishStatus, STLG_Details__c FROM Knowledge__kav WHERE ArticleNumber = '000001576' AND PublishStatus = 'Online'" --json
```

Prüfen: Ist der Zielartikel bereits verlinkt? Falls nicht: In welchem Abschnitt sollte der Link ergänzt werden?

**000001572 „Systemübersicht CRM Vertrieb" — nur auf Nachfrage:**

Mit `AskUserQuestion` fragen: „Soll auch die Systemübersicht (000001572) als Draft aktualisiert werden? Die Systemübersicht beschreibt nur, wo Komponenten im System zu finden sind – sie ist in der Regel nur bei neuen Objekten oder App-Bereichen relevant."

Nur wenn der User zustimmt: Artikel abrufen und auf Verlinkungsbedarf prüfen.

---

Dem User eine übersichtliche Auflistung präsentieren:
```
Hub-Artikel: Prozesse im Vertrieb (000001576)
→ Zielartikel noch nicht verlinkt. Empfehlung: Link in Abschnitt „..." ergänzen.

Hub-Artikel: Systemübersicht CRM Vertrieb (000001572)
→ Nur auf Wunsch des Users prüfen/aktualisieren.
```

Mit `AskUserQuestion` fragen: Soll der Hub-Artikel „Prozesse im Vertrieb" (000001576) ebenfalls als Draft aktualisiert werden?

---

### Schritt 3: HTML-Inhalt generieren

Den Artikelinhalt als HTML generieren. Inhaltsbasis: **alle gesammelten Quellen** (Jira-Stories, `customer.domain.md`, Topic Docs, Repository-Dateien aus `force-app/`).

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
```

**Fall A – bestehenden Artikel als Draft anlegen:**
```python
# 1. Draft-Version erstellen (archiviert die Online-Version)
subprocess.run(['curl', '-s', '-X', 'PATCH',
  f'{instance}/services/data/v64.0/knowledgeManagement/articleVersions/masterVersions/{online_version_id}',
  '-H', f'Authorization: Bearer {token}',
  '-H', 'Content-Type: application/json',
  '-d', '{"publishStatus":"Draft"}'])

# 2. Neue Draft-ID abfragen
result = subprocess.run(['sf', 'data', 'query', '--target-org', '<prod-alias>',
  '--query', f"SELECT Id FROM Knowledge__kav WHERE KnowledgeArticleId = '{article_id}' AND PublishStatus = 'Draft'",
  '--json'], capture_output=True, text=True)
draft_id = json.loads(result.stdout)['result']['records'][0]['Id']

# 3. Inhalt befüllen
payload = json.dumps({'STLG_Details__c': html_content, 'Title': title})
with open('/tmp/payload.json', 'w') as f: f.write(payload)
subprocess.run(['curl', '-s', '-X', 'PATCH',
  f'{instance}/services/data/v64.0/sobjects/Knowledge__kav/{draft_id}',
  '-H', f'Authorization: Bearer {token}',
  '-H', 'Content-Type: application/json',
  '--data-binary', '@/tmp/payload.json'])
```

**Fall B – neuen Artikel erstellen:**
```
sf data create record --target-org <prod-alias> --sobject Knowledge__kav \
  --values "Title='<Titel>' RecordTypeId='012Tr000006qsosIAA'"
```
Dann Inhalt per curl PATCH befüllen (wie oben, Schritt 3).

**Hub-Artikel (falls vom User bestätigt):** gleicher Ablauf (Fall A).

---

### Schritt 5: Zusammenfassung & Log

**Ausgabe:**
- Draft-URL(s): `https://lotto-bw.lightning.force.com/lightning/r/Knowledge__kav/{draftId}/view`
- Hinweis: Artikel ist offline bis zur manuellen Veröffentlichung durch Ines
- Liste aller angelegten/aktualisierten Drafts

**Log-Datei erstellen:**
```
pipeline/.claude/skills/13-write-crm-doc/logs/YYYY-MM-DD-LottoBW-{story-key}-write-crm-doc.json
```
Inhalt: komplette Ausgabe inkl. Story-Zusammenfassung, generiertem HTML, Draft-IDs und URLs.

---

## Wichtige Regeln

- **Niemals publizieren** – ausschließlich Drafts anlegen; Ines publiziert manuell nach Prüfung
- **RecordTypeId** für CRM Dokumentation: `012Tr000006qsosIAA`
- **Org-Alias** aus `stack.config.md` lesen – in der SF CLI aktuell als `prod` registriert
- **Cloud ID** für Jira aus `customer.config.md` lesen – niemals hardcoden
- **HTML-Stil** strikt wie oben einhalten: zweispaltige Tabellen, font-size 16px/20px, bold/italic
- **Inhaltsquellen**: Jira-Stories + `customer.domain.md` + passende Topic Docs + relevante Repository-Dateien (`force-app/`) – alle verfügbaren Quellen nutzen
- **Hub-Artikel prüfen**: `000001576` und `000001572` – mit unterschiedlicher Logik:
  - **000001576 „Prozesse im Vertrieb"**: Immer prüfen und bei neuen Prozess-Artikeln verlinken – dieser Artikel listet alle Prozesse auf
  - **000001572 „Systemübersicht CRM Vertrieb"**: Nur aktualisieren, wenn ein **neues Systemobjekt oder eine neue Systemkomponente** eingeführt wird (z.B. neues Objekt, neuer App-Bereich). Neue Buttons, Bearbeitungsmasken oder Prozesse innerhalb bestehender Komponenten gehören **nicht** in die Systemübersicht – sie beschreibt nur „Wo finde ich was?", nicht „Wie funktioniert ein Prozess?"

## Tonalität & Wording

- **Bearbeitungsmaske statt Flow**: Salesforce Screen Flows werden in der Dokumentation immer als „Bearbeitungsmaske" bezeichnet – niemals als „Flow", „Screen Flow" oder „geführter Flow"
- **Button-Wording**: Aktionen, die durch einen Button ausgelöst werden, immer mit „Klick auf **Button-Name**" einleiten – z.B. „Klick auf **Vorgänger-Erlaubnis pflegen** öffnet die Bearbeitungsmaske."
- **Kein technisches Innenleben**: Interne Implementierungsdetails gehören nicht in die Dokumentation – konkret weglassen:
  - Profil- und Rechtehinweise (z.B. „steht dem VO-Profil ohne Admin-Rechte zur Verfügung")
  - Interne Feldnamen als Guard-Mechanismus (z.B. SetLeadingAt, Guard-Feld, Snapshot-Feld)
  - Flow-/Apex-Klassennamen (z.B. `STLGS_CopyPreviousRPFileNumber`)
  - Technische IDs oder API-Namen, die für den Endanwender irrelevant sind
- **Anwendersprache**: Formulierungen aus Nutzerperspektive – was sieht der User, was klickt er, was passiert sichtbar im System

## Error Handling

- Jira-Issue nicht abrufbar → Fehlermeldung ausgeben, abbrechen
- Kein passender Topic-Doc → ohne fortfahren, im Log vermerken
- Salesforce PATCH schlägt fehl (z.B. bereits ein Draft vorhanden) → Draft-ID abfragen und direkt aktualisieren
- curl gibt Fehlerantwort zurück → Fehlermeldung ausgeben, HTML lokal in Log speichern und User informieren
