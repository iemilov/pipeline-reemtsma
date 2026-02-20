# Pflichtschulung Jugend- und Spielerschutz — Domain Knowledge

> Letzte Aktualisierung: 2026-02-20 | Quellen: 29 Jira-Stories (3 Epics), 4 Flows, 1 Apex-Batch, 2 Validation Rules, 2 Quick Actions, 12 Custom Fields, 1 LMS-Sync-Script

## Überblick

Jede Annahmestelle (ASt) muss jährlich eine Pflichtschulung zum Jugend- und Spielerschutz absolvieren. Die Schulung wird in zwei Varianten durchgeführt: **Präsenz** (Klassenzimmer, organisiert durch RD) und **Online** (E-Learning über externes LMS). Beide werden als Cases vom Typ `Pflichtschulung Jugend- und Spielerschutz` im B2B-Bereich verwaltet. Hauptakteure sind die Regionaldirektion (RD) als Organisator und Nachverfolger, die Vertriebsorganisation (VO) als prüfende und abschließende Instanz, und das externe LMS als Trainingsplattform für die Online-Variante. Die Pflichtschulung ist ein Pflichtbestandteil des Antragsprozesses — bei Neueröffnung/Übernahme werden automatisch je ein Präsenz- und ein Online-Case erstellt.

Siehe auch: [docs/antrag.md](antrag.md) — Antragsprozess (Status "Geprüft durch Zentrale" löst Pflichtschulung aus), [docs/testkauf.md](testkauf.md) — Nachschulung als Quick Action am TK-Case (eigener Prozess, kein Pflichtschulungs-Case).

## Geschäftsprozess

### Erstellung der Pflichtschulungs-Cases

Es gibt drei Wege, wie Pflichtschulungs-Cases entstehen:

**1. Automatisch bei Antrag (Neueröffnung/Übernahme):**
- Antrag erreicht Status "Geprüft durch Zentrale"
- Flow `STLGS_CreateTrainingOnGeprueft` erstellt automatisch einen **Online-Case**
- Flow `STLGS_UpdateAccStatusOnCreateUpdateRequest` erstellt automatisch einen **Präsenz-Case**
- Beide Cases werden dem Schulungsjahr zugeordnet (abgeleitet aus `STLGS_ContractStartPlanned__c`)
- Owner = Queue der zuständigen Regionaldirektion

**2. Manuell via Quick Action (Admin):**
- Quick Action `STLGS_CreateTraining` am Account
- Für Admins, wenn außerhalb des Antrags Cases nötig sind (z.B. fehlende Cases nachlegen)
- Preset: `STLGS_Type__c = Pflichtschulung Jugend- und Spielerschutz`, `STLGS_TrainingYear__c = aktuelles Jahr`

**3. Massenanlage via Batch (jährlich):**
- Apex-Batch `STLGS_CreateTrainingCasesBatch` erstellt Online-Cases für alle aktiven ASten
- Query: `STLGS_StoreStatus__c IN ('Betriebsbereit', 'Gesperrt')` + `STLGS_StoreNumber__c != null`
- Wird per `Database.executeBatch(new STLGS_CreateTrainingCasesBatch(), 200)` manuell ausgelöst
- Owner = Queue der jeweiligen Regionaldirektion (Fallback: `STLGS_SalesOrganization`)

### Workflow — Präsenzschulung

```text
RD organisiert Schulungstermin (Datum, Ort, Zeitraum)
→ RD lädt ASt-Leiter ein
→ Schulung findet statt → RD erfasst: Teilnehmer, Datum, Zeitraum, "teilgenommen" ✓
→ RD → "Übergeben an VO"
  Validation: STLGS_TrainingDate__c, STLGS_TrainingParticipant__c,
  STLGS_TrainingParticipated__c, STLGS_TrainingStart__c müssen gesetzt sein
→ VO prüft und schließt den Case
```

### Workflow — Online-Schulung (LMS)

```text
Case wird erstellt (automatisch oder manuell)
→ ASt-Leiter erhält LMS-Zugangsdaten (manuell oder via Sync-Flow)
→ ASt-Leiter bearbeitet 6 Online-Module im LMS
→ Fortschritt wird per CSV-Import oder Skyvva-Sync aktualisiert:
  STLGS_TrainingModulesCompleted__c, STLGS_TrainingModulesStarted__c,
  STLGS_TrainingModulesNotStarted__c
→ Flow STLG_CaseSetLastUpdatedLMS setzt automatisch STLGS_LastUpdatedLMS__c
→ Bei 6/6 Modulen + Formular gesendet: RD → "Übergeben an VO"
  Validation: ≥ 6 Module completed + STLGS_FormSentToSTLG__c = true
→ VO prüft und schließt den Case
```

### LMS-Synchronisation

Der LMS-Sync erfolgt auf zwei Wegen:

**1. Skyvva-Integration (automatisch):**
- Screen Flow `STLGS_SyncToLMS` am Contact — sendet Contact + alle zugehörigen ASten ans LMS
- Nutzt `STLG_SkyvvaCallout` mit Interfaces `ImportOrganization-Request` und `ImportUser-Request`
- Voraussetzung: Contact muss eine gültige Email (`Contact.Email`) haben
- Iteriert über alle aktiven ACRs (LicenseOwner oder MainContact) und synct jede ASt-Organisation
- Setzt `STLGS_LMSRequestDate__c` am Contact nach erfolgreichem Sync

**2. CSV-Import (manuell, Workaround):**
- Script: `business/docs/LMS/sync-lernstand.py`
- Liest `lernstand.csv` (Export aus LMS), matcht per Contact-Name auf Online-Cases
- Aktualisiert Module-Fortschritt via Composite sObjects API
- Dry-run Default, `--apply` für Prod-Updates
- 6 Module gesamt, CSV enthält Prozentwerte → Umrechnung: `round(percentage * 6 / 100)`

### Nachschulung (Re-Training)

**Achtung:** Die "Nachschulung" im Kontext von Testkauf ist ein **eigener Prozess** (Quick Action `STLGS_NewReTraining` am Account, RecordType `STLGS_TestPurchase`, `STLGS_KindTestPurchase__c = Nachschulung`). Sie hat nichts mit der Pflichtschulung zu tun — Details siehe [docs/testkauf.md](testkauf.md).

## Business Rules

- **Jährliche Pflicht**: Jede ASt mit Status Betriebsbereit/Gesperrt benötigt jährlich einen Pflichtschulungs-Case (Online)
- **Antragsbindung**: Bei Neueröffnung/Übernahme werden 2 Cases automatisch erstellt wenn der Antrag "Geprüft durch Zentrale" erreicht
- **Auslöser Antrag nur bei Neueröffnung/Übernahme**: Flow `STLGS_CreateTrainingOnGeprueft` feuert nur wenn `STLGS_Type__c IN ('Neueröffnung', 'Übernahme')` UND `STLGS_Status__c` sich zu "Geprüft durch Zentrale" ändert
- **Übergabe Präsenz**: Status "Übergeben an VO" nur möglich wenn `STLGS_TrainingDate__c`, `STLGS_TrainingParticipant__c`, `STLGS_TrainingParticipated__c` und `STLGS_TrainingStart__c` alle gesetzt sind (VR `STLGS_ValidatePraesenzHandoverVO`)
- **Übergabe Online**: Status "Übergeben an VO" nur möglich wenn `STLGS_TrainingModulesCompleted__c >= 6` UND `STLGS_FormSentToSTLG__c = true` (VR `STLGS_ValidateCompletedTrainingModules`)
- **LMS-Sync nur mit Email**: Contact benötigt eine gültige `Email` bevor der Sync gestartet werden kann
- **Bypass Switch**: Alle Validation Rules prüfen `$Setup.STLG_BypassSwitch__c.STLG_ValidationRuleSwitch__c` — bei `true` werden sie übersprungen

## Technische Umsetzung

### Datenmodell

#### Case-Felder (Typ "Pflichtschulung Jugend- und Spielerschutz")

**Gemeinsame Felder (Präsenz + Online):**

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_Type__c` | Picklist | `Pflichtschulung Jugend- und Spielerschutz` |
| `STLGS_TrainingType__c` | Picklist | `Präsenz` oder `Online` |
| `STLGS_TrainingYear__c` | Text(10) | Schulungsjahr, z.B. "2026" |
| `STLGS_LeadingRequest__c` | Lookup(Request) | Auslösender Antrag (bei auto-erstellten Cases) |
| `STLGS_FormSentToSTLG__c` | Checkbox | Formular an STLG gesendet — Pflicht für "Übergeben an VO" bei Online |

**Nur Präsenz:**

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_TrainingDate__c` | Date | Datum der Schulungsveranstaltung |
| `STLGS_TrainingDateApproved__c` | Checkbox | Schulungstermin bestätigt |
| `STLGS_TrainingStart__c` | Picklist | Zeitfenster der Schulung (7 Werte: `08:00 - 12:00` bis `14:00 - 18:00`) |
| `STLGS_TrainingParticipant__c` | Text(255) | Name des Schulungsteilnehmers |
| `STLGS_TrainingParticipated__c` | Checkbox | Schulung teilgenommen |

**Picklist `STLGS_TrainingStart__c`:**

| Wert | Beschreibung |
|------|-------------|
| `08:00 - 12:00` | Morgen-Slot |
| `09:00 - 13:00` | Vormittag-Slot |
| `10:00 - 14:00` | Mittag-Slot |
| `11:00 - 15:00` | Übergangs-Slot |
| `12:00 - 16:00` | Nachmittag-Slot |
| `13:00 - 17:00` | Nachmittag-Slot spät |
| `14:00 - 18:00` | Abend-Slot |

**Nur Online (LMS):**

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_TrainingModulesCompleted__c` | Number | Abgeschlossene Module (0–6) |
| `STLGS_TrainingModulesStarted__c` | Number | Begonnene, nicht abgeschlossene Module |
| `STLGS_TrainingModulesNotStarted__c` | Number | Noch nicht begonnene Module |
| `STLGS_TrainingModulesProgress__c` | Percent (Formula) | `Completed / (Completed + Started + NotStarted) * 100` |
| `STLGS_LastUpdatedLMS__c` | Date | Datum der letzten LMS-Synchronisation (auto via Flow) |

#### Contact-Felder (LMS-Sync)

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_LMSRequestDate__c` | DateTime | Zeitpunkt des letzten LMS-Sync-Requests |
| `STLGS_LMSRequestComment__c` | LongTextArea | Kommentar zum LMS-Sync-Vorgang |

### Automation

| Flow / Komponente | Typ | Zweck |
|-------------------|-----|-------|
| `STLGS_CreateTrainingOnGeprueft` | Record-Triggered (AfterSave, `STLGS_Request__c`) | Erstellt Online-Case wenn Antrag (Neueröffnung/Übernahme) Status "Geprüft durch Zentrale" erreicht |
| `STLGS_UpdateAccStatusOnCreateUpdateRequest` | Record-Triggered (AfterSave, `STLGS_Request__c`) | Erstellt Präsenz-Case bei gleichem Auslöser (+ weitere Account-Status-Logik) |
| `STLG_CaseSetLastUpdatedLMS` | Record-Triggered (BeforeSave, `Case`) | Setzt `STLGS_LastUpdatedLMS__c` wenn Module-Felder sich ändern. Filter: `STLGS_Type__c = 'Pflichtschulung...'` + `TrainingType = 'Online'` + IsChanged auf Completed/NotStarted/Started |
| `STLGS_SyncToLMS` | Screen Flow (Contact) | Synct Contact + alle aktiven ASten ins externe LMS via Skyvva. Prüft Email-Vorhandensein, aktualisiert `STLGS_LMSRequestDate__c` |
| `STLGS_UpdateLeadingRequestOnCase` | Record-Triggered (BeforeSave, `Case`) | Setzt `STLGS_LeadingRequest__c` und `ContactId` auf neuen Cases — aber nur wenn `STLGS_LeadingRequest__c = null` |
| `STLGS_CreateTrainingCasesBatch` | Apex Batch | Massenanlage von Online-Pflichtschulungs-Cases für alle aktiven ASten. Manueller Aufruf: `Database.executeBatch(new STLGS_CreateTrainingCasesBatch(), 200)` |
| `STLGS_LMSConcatAllRelatedAccounts` | Apex (Skyvva Formula) | Skyvva-Hilfsklasse: Sammelt alle ASt-Nummern eines Contacts für den LMS-Sync |
| `STLGS_ValidatePraesenzHandoverVO` | Validation Rule | Verhindert "Übergeben an VO" bei Präsenz ohne Pflichtfelder |
| `STLGS_ValidateCompletedTrainingModules` | Validation Rule | Verhindert "Übergeben an VO" bei Online ohne 6 Module + Formular |

### Integrationen

**LMS (Learning Management System):**
- Externes System für Online-Schulungsmodule (6 Module pro Schulungsjahr)
- Integration über Skyvva-Middleware (Salesforce → LMS)
- Zwei Interfaces: `ImportOrganization-Request` (ASt-Daten) und `ImportUser-Request` (Contact-Daten)
- Rückkanal: CSV-Export `lernstand.csv` → Python-Script `sync-lernstand.py`
- Geplant: Direkte LMS-Integration ohne CSV-Workaround (CRM-2992: eigenes Datenmodell `Training` / `TrainingMember`)

## Konfiguration

| Konfiguration | Wert | Beschreibung |
|---------------|------|-------------|
| Bypass Switch | `STLG_BypassSwitch__c.STLG_ValidationRuleSwitch__c` | Überspringt alle Training-VRs wenn `true` |
| RecordType Case | `STLGS_EditCase` | Pflichtschulungs-Cases verwenden den generischen EditCase-RecordType |
| Quick Action (Admin) | `Account.STLGS_CreateTraining` | Manuelle Pflichtschulungs-Case-Erstellung |
| Quick Action (Nachschulung) | `Account.STLGS_NewReTraining` | Gehört zu Testkauf, NICHT Pflichtschulung (RecordType `STLGS_TestPurchase`) |
| LMS Module Total | 6 | Fest im Sync-Script + VR kodiert |
| Skyvva Integration | `LMS` | Integration-Name für Skyvva-Callout |
| Batch Size | 200 | Standard-Batch-Size für `STLGS_CreateTrainingCasesBatch` |

## Bekannte Probleme & Workarounds

- **Online-Cases ohne ContactId (behoben 2026-02-17):** Der Flow `STLGS_CreateTrainingOnGeprueft` setzt `STLGS_LeadingRequest__c` aber NICHT `ContactId`. Der BeforeSave-Trigger `STLGS_UpdateLeadingRequestOnCase` greift nicht, weil seine Entry-Condition `STLGS_LeadingRequest__c = null` erfordert. 194 Cases (77 aus 2025, 117 aus 2026) wurden per Script korrigiert. **Permanenter Fix:** CRM-3019 — ContactId-Formel im Online-Flow ergänzen (temporär bis CRM-2992).

- **Batch setzt `STLGS_KindTestPurchase__c = 'Ersttest'`:** Die Klasse `STLGS_CreateTrainingCasesBatch` setzt `STLGS_KindTestPurchase__c = 'Ersttest'` auf Online-Cases — ein TK-Feld, das auf Pflichtschulungs-Cases nicht relevant ist. Vermutlich Copy-Paste-Fehler aus TK-Logik. Kein funktionaler Impact (Feld wird für diese Cases nirgends ausgewertet), aber technische Schuld.

- **CSV-basierter LMS-Sync als Workaround:** Der eigentliche Rückkanal (LMS → Salesforce) ist noch nicht implementiert. Aktuell wird manuell eine CSV exportiert und per Script importiert. Ziel: CRM-2992 (eigenes Datenmodell Training/TrainingMember) ersetzt den CSV-Workaround.

- **Schulungs-Status am Account fehlt (CRM-2218, CRM-2458):** Es gibt noch kein Feld am Account, das den aktuellen Pflichtschulungs-Status anzeigt (z.B. "Schulung absolviert" + Datum). Stories sind im Backlog/Spezifizieren.

- **LMS-User-Anlage nicht automatisiert (CRM-2934 abgebrochen):** Die automatische Anlage von LMS-Usern wurde abgebrochen. Aktuell werden LMS-Accounts manuell angelegt + per `STLGS_SyncToLMS` Flow synchronisiert.

## Referenzen

### Jira

**Epic CRM-2418:** Online Pflichtschulung 2025 und Erweiterung Vorgang Pflichtschulung

| Key | Summary | Status |
|-----|---------|--------|
| CRM-2219 | Vorgang Pflichtschulung bei Neueröffnung/Übernahme - Präsenz | Fertig |
| CRM-2419 | Vorgang Pflichtschulung - neue Felder | Fertig |
| CRM-2458 | neues Feld am Account / Pflichtschulung absolviert und Datum | Spezifizieren |
| CRM-2480 | Migration - Typ ändert sich zu Pflichtschulung Jugend- und Spielerschutz | Fertig |
| CRM-2481 | UAT: Pflichtschulungsvorgänge Online 2025 für alle aktiven ASTen anlegen | Fertig |
| CRM-2484 | Prod Skript Pflichtschulungen 2025 anlegen | Fertig |
| CRM-2508 | Schulung Präsenz - Validierung Online / Felder sind nicht read-only | Fertig |
| CRM-2510 | Pflichtschulung Präsenz - Validierung bei Übergabe an VO | Fertig |
| CRM-2511 | Pflichtschulung Präsenz - read only / Schulungsort darf nicht edit für RD | Fertig |
| CRM-2514 | Pflichtschulung Online neues Feld "Zuletzt aus LMS aktualisiert" | Fertig |
| CRM-2568 | Vorgang Pflichtschulung bei Neueröffnung/Übernahme - Online | Fertig |

**Epic CRM-87:** LMS Integration

| Key | Summary | Status |
|-----|---------|--------|
| CRM-2933 | LMS: Willkommens-Email bei User-Anlage | Spezifizieren |
| CRM-2934 | LMS automatische Anlage | Abgebrochen |
| CRM-2979 | LMS: Cockpit für Regionaldirektionen (RD) | Backlog |
| CRM-2992 | LMS Datenmodell: Training & TrainingMember Custom Objects | Spezifizieren |
| CRM-2994 | LMS Flow: Automatische Schulungszuweisung bei Antragsprüfung | Backlog |
| CRM-3019 | Flow: ContactId bei Online-Pflichtschulungs-Case setzen | Spezifizieren |

**Weitere relevante Stories:**

| Key | Summary | Status |
|-----|---------|--------|
| CRM-1388 | Neue Quickaction für Admins am Account um Vorgänge vom Typ Pflichtschulung zu erstellen | Fertig |
| CRM-2034 | Vorgang Präsenzschulung Pflichtschulung bei "Geprüft Zentrale" | Fertig |
| CRM-2240 | Vorgang Pflichtschulung - picklist Schulungszeitraum erweitern | Fertig |
| CRM-2980 | Antrag: Neue Checkbox + Seite Pflichtschulung Spieler- & Jugendschutz | Backlog |

### Confluence

Keine relevanten Seiten gefunden (die existierenden Schulungs-Seiten betreffen System-Schulungen, nicht die Pflichtschulung Jugend-/Spielerschutz).

### Codebase

- Flows: `force-app/main/default/flows/STLGS_CreateTrainingOnGeprueft.flow-meta.xml`, `STLG_CaseSetLastUpdatedLMS.flow-meta.xml`, `STLGS_SyncToLMS.flow-meta.xml`, `STLGS_UpdateLeadingRequestOnCase.flow-meta.xml`
- Apex: `force-app/main/default/classes/STLGS_CreateTrainingCasesBatch.cls`, `STLGS_LMSConcatAllRelatedAccounts.cls`
- Quick Actions: `force-app/main/default/quickActions/Account.STLGS_CreateTraining.quickAction-meta.xml`
- Validation Rules: `force-app/main/default/objects/Case/validationRules/STLGS_ValidateCompletedTrainingModules.validationRule-meta.xml`, `STLGS_ValidatePraesenzHandoverVO.validationRule-meta.xml`
- Case Fields: `STLGS_TrainingType__c`, `STLGS_TrainingYear__c`, `STLGS_TrainingDate__c`, `STLGS_TrainingDateApproved__c`, `STLGS_TrainingStart__c`, `STLGS_TrainingParticipant__c`, `STLGS_TrainingParticipated__c`, `STLGS_TrainingModulesCompleted__c`, `STLGS_TrainingModulesStarted__c`, `STLGS_TrainingModulesNotStarted__c`, `STLGS_TrainingModulesProgress__c`, `STLGS_LastUpdatedLMS__c`
- LMS-Sync: `business/docs/LMS/sync-lernstand.py`

### Lokale Dokumentation

- `business/docs/LMS/LMS-Abgleich-2026-02-17.md` — Protokoll der ContactId-Korrektur (26 Online-Cases, 2 fehlende LMS-Accounts)

## Änderungshistorie

| Datum | Änderung | Quelle |
|-------|----------|--------|
| 2026-02-20 | Initiale Erstellung | CRM-2418, CRM-87, Codebase-Analyse, LMS-Abgleich-Protokoll |
