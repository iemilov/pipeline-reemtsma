# Service Desk — Domain Knowledge

> Letzte Aktualisierung: 2026-02-20 | Quellen: ~120 Jira-Stories (4 Epics), 6 Flows, 4 Apex-Klassen, 1 Confluence-Seite

## Überblick

Der Service Desk (SD) ist der technische 1st/2nd-Level-Support für B2B-Annahmestellenservice. Das SD-Team nimmt Störungsmeldungen und Anfragen von Annahmestellenleitern (AST) entgegen — primär telefonisch (>90%), ergänzt durch Email und das ProServices-Portal. Typische Themen: Terminal- und Druckerprobleme, Passwort-Resets, Router-/DSL-Störungen, Lottowand-Defekte, Spielaufträge.

**Akteure:**

- **Service Desk (1st Level):** Nimmt Anfragen an, erstellt Cases, löst einfache Probleme, eskaliert bei Bedarf
- **ProServices (2nd Level):** Externe Hardware-Spezialisten, arbeiten über ein Experience-Cloud-Portal
- **Itenos (DSL/Router):** Telekom-Tochter, zuständig für Netzwerk/DSL — Integration via TMF API (Skyvva)
- **MCS (Managed Computer Services):** Software-Neuinstallationen auf Terminals
- **Vertrieb (VO/RD):** Können SD-Cases einsehen und in Bearbeitung nehmen, aber nicht erstellen

Siehe auch: [docs/testkauf.md](testkauf.md) — Testkauf-Cases (anderer RecordType, aber gleiche Accounts), [docs/kuendigung.md](kuendigung.md) — Kündigung/Sperrung (Folgeprozess bei Totalausfall), [docs/filialverantwortung-wechseln.md](filialverantwortung-wechseln.md) — FV-Wechsel bei juristischen Personen, [docs/field-service.md](field-service.md) — VDE Prüfung & Thermodruckerwartung (gleicher RecordType, eigene TopicAreas + Flows), [docs/ruecklastschrift.md](ruecklastschrift.md) — Rücklastschrift-Cases (gleicher RecordType `STLGS_EditCase`, eigene Finanzfelder).

## Geschäftsprozess

### Case-Erstellung

Es gibt vier Wege, einen SD-Case zu erstellen:

1. **Screen Flow `STLGS_CreateServiceDeskCase`** — Hauptweg für SD-Agents. Nutzt die LWC `stlgs_searchArticleDetails` zur Auswahl eines KB-Artikels als Arbeitsanweisung. Der Artikel wird als `STLGS_LeadingArticle__c` verknüpft und der Betreff aus Artikel-Titel + `STLGS_SubjectSD__c` zusammengesetzt (Flow `STLGS_SetSubjectSD`).

2. **Quick Action `Account.STLGS_NewServiceDeskCase`** — Schnellerstellung vom Account aus. Felder: Contact, Subject, GeneralDescription, Status, Priority.

3. **Email2Case** — Leitstand-Emails "Regelweg gestört" werden automatisch als SD-Cases angelegt (CRM-1288). Custom Label `STLG_LeitstandEmail` enthält die Prod-Email-Adresse.

4. **ProServices Portal** — ProServices-User können über die Experience Cloud Cases erstellen und bearbeiten.

### Status-Flow

```
New → In Progress → [Zugewiesen an 2nd Level] → [In Bearbeitung 2nd Level] → [Zurück von 2nd Level] → Closed
                  → [Escalated]
                  → [On Hold / Warten Intern]
                  → [Re-Opened] (nach Closed)
```

**Status-Werte (Business Process `STLGS_ServiceDeskSupportProcess`):**

| Status | Beschreibung |
|--------|-------------|
| New | Neuer Case, noch nicht in Bearbeitung |
| In Progress | SD-Agent arbeitet am Case (Default bei Erstellung) |
| Zugewiesen an 2nd Level | Übergeben an ProServices, RD, VO oder Itenos-Queue |
| In Bearbeitung 2nd Level | 2nd-Level-Team (ProServices/RD/VO) arbeitet aktiv |
| Zurück von 2nd Level | 2nd Level hat Case zurückgegeben, SD muss weiter bearbeiten |
| Escalated | Eskaliert (z.B. an Teamleitung) |
| On Hold | Warten auf externe Rückmeldung (intern: Wiedervorlage-Logik aus B2C) |
| Re-Opened | Geschlossener Case wurde wiedereröffnet |
| Closed | Abgeschlossen — erfordert Resolution + GeneralDescription |

**Statuswechsel-Logik:**

- SD übergibt an VO/RD → Status wird automatisch auf "Zugewiesen an 2nd Level" gesetzt (nicht "Übergeben an VO/RD") (CRM-1350)
- VO/RD nimmt SD-Case in Bearbeitung → Status wird "In Bearbeitung 2nd Level", Case-Owner wechselt auf den User (CRM-1507)
- ProServices klickt "Zurück an Service Desk" → Status wird "Zurück von 2nd Level" (CRM-1485)
- "Warten Intern" nutzt die B2C-Wiedervorlagenlogik (CRM-1497)

### Eskalation: 1st → 2nd Level (ProServices)

1. SD-Agent setzt Themenbereich und bearbeitet Prüfpunkte (KB-Artikel-Checkliste)
2. Checkbox `STLGS_ChecksToKBDone__c` = true bestätigen
3. "Übergeben an 2nd Level" → Case-Owner wechselt auf Queue `STLGS_ProServices`
4. Beim ersten Zuweisen an ProServices wird `STLGS_ProServicesCase__c` = true gesetzt (einmalig, nie zurückgesetzt) → steuert Sharing
5. ProServices sieht den Case im Portal, klickt "In Bearbeitung" → Owner wechselt auf ProServices-User
6. Handover-Kommentar wird als CaseRecordFeedItem (Visibility: All) geschrieben, nicht als interner Kommentar (CRM-1461)

**ProServices-Portal (Experience Cloud):**

- 8 Kopfverteiler (Dispatcher) — sehen alle ProServices-Cases, verteilen an Techniker
- Kopfverteiler haben eingeschränkte Buttons: kein "Zurück an SD", kein "In Bearbeitung" (CRM-1557)
- Lookup-Feld `STLGS_ProServicesUser__c` gefiltert nach PermSet "Kopfverteiler" für Zuweisung
- File-Sharing: Apex Trigger Action `STLGS_TA_SetFileVisibilityProServices` setzt Sichtbarkeit auf "AllUsers" für Dateien an ProServices-Cases

### Eskalation: Itenos (DSL/Router)

Bei Netzwerk-/DSL-Störungen wird der Case an Itenos eskaliert:

1. SD-Agent setzt `STLGS_SyncItenos__c` = true (aktiviert bidirektionale Sync)
2. Case-Owner wechselt auf Queue "Itenos"
3. **Flow `STLG_SendTicketItenos`** reagiert auf FeedItem-Erstellung (TextPost) und erstellt einen `STLGS_CaseComment__c`-Record
4. **Flow `STLG_ItenosIntegration`** prüft ob `STLG_TMFTicketId__c` existiert:
   - Kein TMF-ID → Skyvva `CreateTicket-Request` (POST TMF API)
   - TMF-ID vorhanden → Skyvva `UpdateTicket-Request` (PATCH TMF API)
5. Itenos sendet Updates via Event-Based POST an Salesforce REST-Endpoint
6. **Flow `STLGS_MapItenosStatus`** mappt Itenos-Status auf Case-Status:
   - "in progress" → "In Bearbeitung 2nd Level" + Owner auf Itenos-Queue
   - "pending" oder "resolved" → "Zurück von 2nd Level"

**Deeplink zum Itenos-Portal:** `https://kundenstatistik.itenos.de/monitoring/host/services?host={LOBW-XXXX}` — Variable aus `Account.STLGS_RouterIdentification__c` (CRM-1545).

### Themenbereich & KB-Artikel

Jeder SD-Case hat einen **Themenbereich** (`STLGS_TopicArea__c`) der die Anfrage kategorisiert. Bei der Case-Erstellung wählt der Agent über die LWC `stlgs_searchArticleDetails` einen KB-Artikel als Arbeitsanweisung. Die Data Categories der KB-Artikel sind 1:1 auf die Themenbereiche gemappt.

**Knowledge-Artikel-Workflow (CRM-2446, Backlog):**
- SD-Agents erstellen Artikel-Entwürfe
- ServiceDesk Lead prüft und gibt frei
- RecordType: `STLGS_ServiceDeskKnowledge`
- Data Category Group: `STLGS_ServiceDesk`
- KB-Artikel sind nur für SD sichtbar, nicht für Kundenservice/Vertrieb (CRM-1579)

### Case-Abschluss

Zum Schließen eines SD-Cases sind zwei Felder Pflicht:

1. **`STLGS_Resolution__c`** — Lösungspunkt (abhängig vom Themenbereich)
2. **`STLGS_GeneralDescription__c`** — Allgemeine Beschreibung der Lösung

### Vollstörung (Disruption)

Bei Totalausfällen wird die Checkbox `STLGS_IsDisruption__c` gesetzt. Solange aktiv:
- Case kann **nicht geschlossen** werden (Validation Rule `STLGS_PreventClosureOnDisruption`)
- Optional: `STLGS_EmergencyRouter__c` = true wenn Notfallrouter bereitgestellt (CRM-1839)

## Business Rules

- **Prüfpunkte vor 2nd Level:** Status "Zugewiesen an 2nd Level" erfordert `STLGS_ChecksToKBDone__c = true`, es sei denn TopicArea = "Allgemein" (VR `STLGS_PreventStatusChange2ndLevelSD`)
- **Pflichtfelder bei Close:** `STLGS_Resolution__c` + `STLGS_GeneralDescription__c` müssen gefüllt sein (VR `STLGS_SDCaseResolutionMandatoryFields`)
- **Vollstörung blockiert Close:** Case kann nicht geschlossen werden solange `STLGS_IsDisruption__c = true` (VR `STLGS_PreventClosureOnDisruption`)
- **SD Cases Read-Only für Vertrieb:** RD & VO können SD-Cases einsehen aber nicht bearbeiten (CRM-1529). Ausnahme: "In Bearbeitung nehmen" setzt Owner auf den Vertriebsuser (CRM-1507)
- **ProServices-Sharing:** `STLGS_ProServicesCase__c` = true wird beim ersten Zuweisen an ProServices-Queue gesetzt und steuert die Sharing Rules. Einmal gesetzt, nie zurückgesetzt.
- **Übergabe-Status:** Bei Übergabe an VO/RD wird immer "Zugewiesen an 2nd Level" gesetzt (nicht die VO/RD-spezifischen Statuswerte) (CRM-1350)
- **SD darf keine Service-Cases erstellen:** Global Action für Standard-Kundenvorgang ist für SD-Profil blockiert (CRM-1477)
- **Kontakte Read-Only für SD:** SD-User dürfen Kontaktnamen nicht bearbeiten (CRM-1541, CRM-1566)

## Technische Umsetzung

### Datenmodell — Case-Felder (SD-spezifisch)

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_SubjectSD__c` | Text(255) | Individuelle Kurzbeschreibung des Anliegens durch den Agent |
| `STLGS_TopicArea__c` | Picklist | Themenbereich — kategorisiert die Anfrage (siehe Picklist-Tabelle) |
| `STLGS_Resolution__c` | Picklist (abhängig) | Lösungspunkt — abhängig von TopicArea (siehe Picklist-Tabelle) |
| `STLGS_LeadingArticle__c` | Lookup(Knowledge__kav) | Verknüpfter KB-Artikel als Arbeitsanweisung |
| `STLGS_GeneralDescription__c` | TextArea | Allgemeine Beschreibung der Lösung (Pflicht bei Close) |
| `STLGS_ChecksToKBDone__c` | Checkbox | Bestätigt: alle Prüfpunkte aus KB-Artikel durchgeführt |
| `STLGS_ProServicesCase__c` | Checkbox | Einmalig true wenn Case erstmals an ProServices-Queue zugewiesen |
| `STLGS_ProServicesUser__c` | Lookup(User) | ProServices-Techniker der den Case bearbeitet |
| `STLGS_CommentTimestamp__c` | DateTime | Zeitstempel des letzten SD-Kommentars (via Flow) |
| `STLGS_IsDisruption__c` | Checkbox | Vollstörung — blockiert Case-Close |
| `STLGS_EmergencyRouter__c` | Checkbox | Notfallrouter bereitgestellt (CRM-1839) |
| `STLGS_CaseRecordTypeDeveloperName__c` | Formel(Text) | Gibt `RecordType.DeveloperName` zurück — technisches Hilfsfeld |

### Datenmodell — Itenos-Felder (Case)

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLG_TMFTicketId__c` | Text (ExternalId, Unique) | TMF-Ticket-ID für bidirektionale Sync |
| `STLGS_SyncItenos__c` | Checkbox | Aktiviert bidirektionale Itenos-Synchronisation |
| `STLG_ItenosStatus__c` | Picklist | Status des Itenos-Tickets (Werte: "New") |
| `STLG_ItenosIntegrationComment__c` | TextArea | Status-/Fehlermeldungen der Itenos-Integration |
| `STLGS_ITENOSResponseDateTime__c` | DateTime | Zeitstempel der letzten Itenos-Antwort |

### Datenmodell — Account-Felder (SD-relevant)

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_RouterIdentification__c` | Text | Router-ID (z.B. "LOBW-4290") — für Itenos-Portal-Deeplink |
| `STLGS_TerminalIPAddress__c` | Text | IP-Adresse des Terminals |

### Datenmodell — Custom Object `STLGS_CaseComment__c`

Speichert Kommentare für die bidirektionale Itenos-Kommunikation.

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `Case__c` | Lookup(Case) | Zugehöriger SD-Case |
| `Author__c` | Text | Autor des Kommentars (Default: "Lotto BW") |
| `STLGS_Content__c` | LongTextArea(32768) | Kommentar-Inhalt |
| `STLGS_ExternalId__c` | Text (ExternalId, Unique) | Itenos-Comment-ID für Sync |

### Datenmodell — Picklist `STLGS_TopicArea__c` (vollständig)

| API-Wert | Label | Status |
|----------|-------|--------|
| `A4Drucker__c` | A4 Drucker | Aktiv |
| `General__c` | Allgemein | Aktiv |
| `Fehler VDE-Prüfung` | Fehler VDE-Prüfung | Aktiv (→ [field-service.md](field-service.md)) |
| `Ladenbau__c` | Ladenbau | **Inaktiv** |
| `LottoKompakt__c` | Lotto Kompakt | Aktiv |
| `Lottowand__c` | Lottowand | Aktiv |
| `Spielauftrag__c` | Spielauftrag | Aktiv |
| `Terminal__c` | Terminal | **Inaktiv** |
| `TerminalHardwareprobleme__c` | Terminal - Hardwareprobleme | Aktiv |
| `TerminalKundendisplayHardware__c` | Terminal - Kundendisplay Hardware | Aktiv |
| `TerminalKundendisplaySoftware__c` | Terminal - Kundendisplay Software | Aktiv |
| `Terminallaufzeiten__c` | Terminallaufzeiten | Aktiv |
| `TerminalPasswortproblem__c` | Terminal - Passwortproblem | Aktiv |
| `TerminalRouter__c` | Terminal - Router | Aktiv |
| `TerminalSoftwareprobleme__c` | Terminal - Softwareprobleme | Aktiv |
| `Thermodrucker__c` | Thermodrucker | **Inaktiv** |
| `ThermodruckerHardwareprobleme__c` | Thermodrucker - Hardwareprobleme | Aktiv |
| `VDE Prüfung` | VDE Prüfung | Aktiv (→ [field-service.md](field-service.md)) |
| `Wartung__c` | Wartung | Aktiv (→ [field-service.md](field-service.md)) |

### Datenmodell — Picklist `STLGS_Resolution__c` (vollständig, nach TopicArea)

Resolution ist eine **abhängige Picklist** — die verfügbaren Werte werden durch den gewählten TopicArea gesteuert. "Duplikat" ist für fast alle Themenbereiche verfügbar.

**Terminal - Router:**

| API-Wert | Label |
|----------|-------|
| `DSL Funktionalität instand gesetzt` | DSL Funktionalität instand gesetzt |
| `Duplikat` | Duplikat |
| `Großstörung` | Großstörung |
| `Lan Verkabelung ersetzt` | Lan Verkabelung ersetzt |
| `Routerneukonfiguration` | Routerneukonfiguration |
| `Routerneustart` | Routerneustart |
| `Routertausch` | Routertausch |
| `Routerverkabelung` | Routerverkabelung |
| `Service bis Übergabepunkt vollständig` | Service bis Übergabepunkt vollständig |
| `Terminalneuregistrierung` | Terminalneuregistrierung |
| `Terminaltausch` | Terminaltausch |
| `Terminal Verkabelung korrigiert` | Terminal Verkabelung korrigiert |

**Terminal - Softwareprobleme:**

| API-Wert | Label |
|----------|-------|
| `Duplikat` | Duplikat |
| `Großstörung` | Großstörung |
| `Terminalneuregistrierung` | Terminalneuregistrierung |
| `Terminalneustart` | Terminalneustart |
| `Terminaltausch` | Terminaltausch |

**Terminal - Hardwareprobleme:**

| API-Wert | Label |
|----------|-------|
| `Bedienerdisplayverkabelung korrigiert` | Bedienerdisplayverkabelung korrigiert |
| `Duplikat` | Duplikat |
| `Großstörung` | Großstörung |
| `Kamerascheibe gereinigt` | Kamerascheibe gereinigt |
| `Neuen Zigbee Stick bestellen (via RD)` | Neuen Zigbee Stick bestellen (via RD) |
| `Scanfehler optisches Modul` | Scanfehler optisches Modul |
| `Terminalneustart` | Terminalneustart |
| `Terminaltausch` | Terminaltausch |
| `Thermorolle ausgetauscht` | Thermorolle ausgetauscht |
| `Zigbee Stick umgesteckt` | Zigbee Stick umgesteckt |

**Terminal - Kundendisplay Hardware:**

| API-Wert | Label |
|----------|-------|
| `Duplikat` | Duplikat |
| `Kundendisplaytausch` | Kundendisplaytausch |
| `Verkabelung korrigiert` | Verkabelung korrigiert |

**Terminal - Kundendisplay Software:**

| API-Wert | Label |
|----------|-------|
| `Duplikat` | Duplikat |
| `Kundendisplayneustart` | Kundendisplayneustart |
| `Kundendisplaytausch` | Kundendisplaytausch |
| `Software neuaufsetzen (MCS)` | Software neuaufsetzen (MCS) |
| `Terminalneuregistrierung` | Terminalneuregistrierung |
| `Verkabelung korrigiert` | Verkabelung korrigiert |

**Terminal - Passwortproblem:**

| API-Wert | Label |
|----------|-------|
| `Duplikat` | Duplikat |
| `Passwortfehler Zähler zurückgesetzt` | Passwortfehler Zähler zurückgesetzt |
| `Passwort zurückgesetzt` | Passwort zurückgesetzt |

**Terminallaufzeiten:**

| API-Wert | Label |
|----------|-------|
| `Allgemein` | Allgemein |
| `Duplikat` | Duplikat |

**Thermodrucker - Hardwareprobleme:**

| API-Wert | Label |
|----------|-------|
| `Drucker resettet` | Drucker resettet |
| `Druckkopfreinigung` | Druckkopfreinigung |
| `Duplikat` | Duplikat |
| `Neue Thermorolle` | Neue Thermorolle |
| `Rollenmaterial entfernt` | Rollenmaterial entfernt |
| `Stecker vom Drucker und Terminal aus und wieder eingesteckt` | Stecker vom Drucker und Terminal aus und wieder eingesteckt |
| `Thermodruckertausch` | Thermodruckertausch |
| `Thermorolle glatt geklopft` | Thermorolle glatt geklopft |

**Lottowand:**

| API-Wert | Label |
|----------|-------|
| `Allgemein` | Allgemein |
| `Duplikat` | Duplikat |
| `Lan Kabel ersetzt` | Lan Kabel ersetzt |
| `LED Lichterleisten defekt` | LED Lichterleisten defekt |
| `Möbelstück defekt` | Möbelstück defekt |
| `Neukonfiguration der Software` | Neukonfiguration der Software |
| `Power Lan aus- & eingesteckt` | Power Lan aus- & eingesteckt |
| `Power Lan ersetzt` | Power Lan ersetzt |
| `Routerneustart` | Routerneustart |
| `Smart Device Tausch` | Smart Device Tausch |
| `Stromlos gestellt & wieder eingeschaltet` | Stromlos gestellt & wieder eingeschaltet |
| `Switch Verkabelung` | Switch Verkabelung |
| `Thermodrucker Tausch` | Thermodrucker Tausch |
| `Thermorolle ausgetauscht` | Thermorolle ausgetauscht |
| `Werbemonitor Tausch` | Werbemonitor Tausch |

**Spielauftrag:**

| API-Wert | Label |
|----------|-------|
| `ABO - Antrag erneut ausgefüllt` | ABO - Antrag erneut ausgefüllt |
| `An Kundenservice verwiesen` | An Kundenservice verwiesen |
| `Duplikat` | Duplikat |
| `GlüxCard - Antrag erneut ausgefüllt` | GlüxCard - Antrag erneut ausgefüllt |
| `Stornierung durchgeführt` | Stornierung durchgeführt |
| `Stornierung nicht durchgeführt` | Stornierung nicht durchgeführt |
| `Terminal neugestartet` | Terminal neugestartet |
| `Terminal Tausch` | Terminal Tausch |

**Allgemein:**

| API-Wert | Label |
|----------|-------|
| `Allgemein` | Allgemein |
| `Ast an RD verwiesen` | Ast an RD verwiesen |
| `Duplikat` | Duplikat |
| `Kontaktdaten ausgehändigt` | Kontaktdaten ausgehändigt |

**A4 Drucker:**

| API-Wert | Label |
|----------|-------|
| `A4 Druckertausch` | A4 Druckertausch |
| `Duplikat` | Duplikat |
| `Korrektes Papierformat eingestellt` | Korrektes Papierformat eingestellt |
| `Neuer Toner durch RD` | Neuer Toner durch RD |
| `Papierreste entfernt` | Papierreste entfernt |
| `Verkabelung korrigiert` | Verkabelung korrigiert |

**Lotto Kompakt:**

| API-Wert | Label |
|----------|-------|
| `Duplikat` | Duplikat |
| `Routerneustart` | Routerneustart |
| `Routerverkabelung` | Routerverkabelung |
| `Terminalneuregistrierung` | Terminalneuregistrierung |
| `Terminalneustart` | Terminalneustart |
| `Terminaltausch` | Terminaltausch |

**VDE Prüfung:** (→ Details in [field-service.md](field-service.md))

| API-Wert | Label |
|----------|-------|
| `Gerät entsorgt & TMS aktualisiert` | Gerät entsorgt & TMS aktualisiert |
| `Gerät repariert/entsorgt & TMS aktualisiert` | Gerät repariert/entsorgt & TMS aktualisiert |
| `Gerät repariert & TMS aktualisiert` | Gerät repariert & TMS aktualisiert |
| `TMS aktualisiert` | TMS aktualisiert |

**Fehler VDE-Prüfung:** (→ Details in [field-service.md](field-service.md))

| API-Wert | Label |
|----------|-------|
| `Austausch initiiert` | Austausch initiiert |

**Wartung:** (→ Details in [field-service.md](field-service.md))

| API-Wert | Label |
|----------|-------|
| `Thermodrucker Wartung abgeschlossen` | Thermodrucker Wartung abgeschlossen |

**Inaktive Resolution-Werte:**

| API-Wert | Label |
|----------|-------|
| `Ast Termin für Technikersitzung (ITENOS)` | Ast Termin für Technikersitzung (ITENOS) |
| `Router Neukonfiguration (ITENOS)` | Router Neukonfiguration (ITENOS) |
| `Router Neustart` | Router Neustart |
| `Terminal Neuregistrierung` | Terminal Neuregistrierung |
| `Terminal Neuregistrierung (PS)` | Terminal Neuregistrierung (PS) |
| `Terminal Neustart` | Terminal Neustart |
| `Terminal Tausch durch PS` | Terminal Tausch durch PS |

### Automation

| Flow / Komponente | Typ | Zweck |
|-------------------|-----|-------|
| `STLGS_CreateServiceDeskCase` | Screen Flow | Case-Erstellung mit KB-Artikel-Auswahl (CRM-1287) |
| `STLGS_SetSubjectSD` | Record-Triggered (Before Save, Case) | Setzt Subject = Leading Article Titel + SubjectSD (CRM-1636) |
| `STLGS_UpdateSDCaseOnEmail` | Record-Triggered (After Save, EmailMessage) | Aktualisiert CommentTimestamp am Parent-SD-Case bei Email-Versand |
| `STLG_SendTicketItenos` | Record-Triggered (After Save, FeedItem) | Erstellt CaseComment + triggert Itenos-Integration bei TextPost mit IntegrationTMF-Permission |
| `STLG_ItenosIntegration` | Auto-Launched (Subflow) | Entscheidet Create vs. Update und ruft Skyvva-Interface auf |
| `STLGS_MapItenosStatus` | Record-Triggered (After Save, Case) | Mappt Itenos-Status-Änderungen auf Case-Status (pending/resolved → Zurück von 2nd Level, in progress → In Bearbeitung 2nd Level) |
| `STLGS_TA_SetFileVisibilityProServices` | Apex Trigger Action (BeforeInsert, ContentDocumentLink) | Setzt File-Visibility auf "AllUsers" für Dateien an ProServices-Cases und deren Accounts |
| `STLGS_SkyvvaMappingResponseTMF` | Apex (Skyvva Mapping) | Transformiert TMF-API-Response: "id" → "systemId" im Payload |
| `STLGS_SkyvvaMappingResponseCommentTMF` | Apex (Skyvva Mapping) | Transformiert Kommentar-Response: "id" → "noteId" für Comment-Sync |
| `STLG_SkyvvaMessageTrigger` | Trigger (skyvvasolutions__IMessage__c) | Delegiert an MetadataTriggerHandler für dynamische Trigger-Konfiguration |

### Integrationen

**Itenos (TMF API via Skyvva):**
- Bidirektionale Ticket-Synchronisation (Case ↔ Itenos TroubleTicket)
- POST: `CreateTicket-Request` — neues Ticket bei Ersteskalation
- PATCH: `UpdateTicket-Request` — Update bei Kommentaren/Statusänderungen
- Event-Based POST von Itenos: Status- und Kommentar-Updates → REST-Endpoint in Salesforce
- Custom Object `STLGS_CaseComment__c` als Kommentar-Bridge
- Deeplink: Itenos-Portal mit Router-ID (`STLGS_RouterIdentification__c`)

**Email2Case (Leitstand):**
- Automatische Case-Erstellung bei "Regelweg gestört"-Emails vom Leitstand
- Email-Adresse in Custom Label `STLG_LeitstandEmail`

**ACD/Omnichannel:**
- Integration für UAT2 vorbereitet (CRM-1464)
- Embers-Warteschlange für SD eingerichtet (CRM-1558)

### UI-Komponenten

| Flow / Komponente | Typ | Zweck |
|-------------------|-----|-------|
| `stlgs_searchArticleDetails` | LWC | KB-Artikel-Suche und -Auswahl bei Case-Erstellung (FlowScreen + RecordPage) |
| `STLGS_CustomCommentFeederController` | Apex Controller | Custom-Kommentar-Anzeige am SD-Case |
| `STLGS_DisplayArticleDetailsController` | Apex Controller | KB-Artikel-Details im Case-Kontext |
| `STLGS_OpeningHoursController` | Apex Controller | Ladenöffnungszeiten-Anzeige am SD-Case (CRM-1332) |

**FlexiPages (Record Pages):**

| Flow / Komponente | Typ | Zweck |
|-------------------|-----|-------|
| `STLGS_ServiceDeskCaseRecordPage` | FlexiPage | Haupt-Case-Seite für SD |
| `STLGS_ServiceDeskAccountPage` | FlexiPage | Account-Seite für SD-App |
| `STLGS_ServiceDeskArticleRecordPage` | FlexiPage | KB-Artikel-Seite für SD |
| `STLG_ServiceDeskContactRecordPage` | FlexiPage | Kontakt-Seite für SD-App |
| `Service_Desk_UtilityBar` | FlexiPage | Utility Bar der SD-App |
| `STLGS_ServiceDeskPath` | Path Assistant | Geführter Pfad für SD-Case-Bearbeitung |

## Konfiguration

- **RecordType:** `STLGS_ServiceDeskCase` (`012Tr000003l2pRIAQ`)
- **Business Process:** `STLGS_ServiceDeskSupportProcess` (9 Status-Werte, Default: In Progress)
- **App:** `STLGS_ServiceDesk` — eigene Lightning-App für SD-Team
- **Queues:**
  - `STLGS_ServiceDesk` — Haupt-Queue (Role: STLGS_ServiceDesk)
  - `STLGS_ProServices` — 2nd Level Hardware (Public Group: STLGS_ProServices)
  - `STLGS_EmbersServiceDesk` — Embers-Integration (CRM-1558)
  - `STLGS_MCS` — Managed Computer Services (system.user@lotto-bw.de)
  - Itenos — Netzwerk/DSL-Eskalation
  - Regionaldirektionen 1-8 — für Übergabe an RD
- **Profiles:** `STLGS_ServiceDesk` (SD-Agent), `STLGS_ServiceDesk Lead` (SD-Teamleitung)
- **Permission Sets:**
  - `STLGS_ServiceDesk` — App-Zugang + Custom Permission + Controller-Zugriff
  - `STLGS_AccessServiceDeskCasesRU` — Read/Update auf SD-Cases (für Vertrieb)
  - `STLGS_AccessCasesTMF` — Case-Zugriff für TMF-Integration
  - `STLG_TMF_Integration` / `STLGS_IntegrationTMF` — TMF-API-Zugriff
- **Permission Set Groups:** `STLGS_ServiceDeskPSG`, `STLGS_ServiceDeskLead`, `STLG_IntegrationTMF`
- **Custom Permissions:** `STLGS_ServiceDesk` (CRM-1276), `IntegrationTMF` (steuert Itenos-Flow-Trigger)
- **Role:** `STLGS_ServiceDesk` — in der Rollenhierarchie
- **Data Category Group:** `STLGS_ServiceDesk` — für KB-Artikel-Kategorisierung
- **Knowledge RecordType:** `STLGS_ServiceDeskKnowledge`
- **Custom Label:** `STLG_LeitstandEmail` — Email-Adresse für Email2Case

## Bekannte Probleme & Workarounds

- **KB-Artikel-Suche unzuverlässig:** Suche über LWC findet nicht immer alle Artikel auf Anhieb (CRM-1498). Workaround: mehrfach suchen oder Artikel-Titel exakt eingeben.
- **Doppelte Artikel-Anzeige bei Case-Erstellung:** Bei bestimmten Suchbegriffen werden Artikel doppelt angezeigt (CRM-1533).
- **CRM-3032 (Backlog):** Neue Themenbereiche und Lösungspunkte angefordert aber noch nicht umgesetzt.
- **CRM-2446 (Backlog):** KB-Artikel-Freigabeworkflow (SD-Agent erstellt → SD-Lead gibt frei) noch nicht implementiert.
- **CRM-2451 (Backlog):** Masterticket-Funktion für Incidents (ein Haupt-Case mit verknüpften Einzel-Cases) noch nicht umgesetzt.
- **Inaktive Picklist-Werte:** 3 inaktive TopicArea-Werte (`Ladenbau__c`, `Terminal__c`, `Thermodrucker__c`) und 7 inaktive Resolution-Werte — vermutlich nach Umbenennung/Aufteilung nicht gelöscht.
- **Itenos Deeplink Encoding:** Router-IDs mit Sonderzeichen könnten URL-Encoding-Probleme verursachen — aktuell keine bekannten Fälle.

## Referenzen

### Jira-Epics

| Key | Summary | Status |
|-----|---------|--------|
| CRM-94 | SD - Case Management | Fertig |
| CRM-1223 | SD - ProServices Portal | Fertig |
| CRM-1224 | SD - Integration Itenos | Fertig |
| CRM-1278 | SD - Rechte, Rollen & Profiles | Fertig |
| CRM-2446 | SD: KB Artikel Freigabeworkflow | Backlog |
| CRM-2451 | SD: Masterticket Incidents | Backlog |
| CRM-3032 | SD: Neue Themenbereiche & Lösungspunkte | Backlog |

### Jira-Stories (Auswahl, nach Thema)

**Case-Erstellung & Layout:**
CRM-1272, CRM-1273, CRM-1274, CRM-1275, CRM-1287, CRM-1332, CRM-1335, CRM-1343, CRM-1349, CRM-1351, CRM-1454, CRM-1459, CRM-1490, CRM-1494, CRM-1500, CRM-1503, CRM-1504, CRM-1505, CRM-1558, CRM-1559, CRM-1565, CRM-1579, CRM-1580, CRM-1581, CRM-1584

**Status & Übergabe:**
CRM-1276, CRM-1342, CRM-1350, CRM-1461, CRM-1482, CRM-1485, CRM-1495, CRM-1496, CRM-1497, CRM-1507, CRM-1529, CRM-1572

**ProServices Portal:**
CRM-1229, CRM-1347, CRM-1460, CRM-1470, CRM-1480, CRM-1491, CRM-1502, CRM-1506, CRM-1557

**Itenos-Integration:**
CRM-1225, CRM-1226, CRM-1228, CRM-1288, CRM-1309, CRM-1453, CRM-1515, CRM-1516, CRM-1518, CRM-1545, CRM-1546

**Rechte & Profile:**
CRM-1278, CRM-1279, CRM-1280, CRM-1281, CRM-1282, CRM-1283, CRM-1284, CRM-1285, CRM-1340, CRM-1478, CRM-1499, CRM-1528, CRM-1573, CRM-1821, CRM-1837

**Themenbereiche & KB:**
CRM-1287, CRM-1471, CRM-1487, CRM-1498, CRM-1533, CRM-1634, CRM-1636, CRM-1676, CRM-2446, CRM-2448, CRM-2539, CRM-3032

**Disruption & Spezialfelder:**
CRM-1810, CRM-1839, CRM-1475, CRM-1561

### Confluence

| Seite | Space |
|-------|-------|
| Annahmestellenservice Prozesse | Vertrieb |

### Codebase

**Flows:** `force-app/main/default/flows/STLGS_CreateServiceDeskCase.flow-meta.xml`, `STLGS_SetSubjectSD.flow-meta.xml`, `STLGS_UpdateSDCaseOnEmail.flow-meta.xml`, `STLG_SendTicketItenos.flow-meta.xml`, `STLG_ItenosIntegration.flow-meta.xml`, `STLGS_MapItenosStatus.flow-meta.xml`

**Apex:** `force-app/main/default/classes/STLGS_TA_SetFileVisibilityProServices.cls`, `STLGS_SkyvvaMappingResponseTMF.cls`, `STLGS_SkyvvaMappingResponseCommentTMF.cls`, `STLGS_CustomCommentFeederController.cls`, `STLGS_DisplayArticleDetailsController.cls`, `STLGS_OpeningHoursController.cls`

**LWC:** `force-app/main/default/lwc/stlgs_searchArticleDetails/`

**Custom Object:** `force-app/main/default/objects/STLGS_CaseComment__c/`

## Änderungshistorie

| Datum | Änderung | Quelle |
|-------|----------|--------|
| 2026-02-20 | Initiale Erstellung | CRM-94, CRM-1223, CRM-1224, CRM-1278, Codebase-Analyse |
| 2026-02-20 | Cross-Reference ergänzt | Verweis auf ruecklastschrift.md |
