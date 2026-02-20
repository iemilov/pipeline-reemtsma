# Field Service — Domain Knowledge

> Letzte Aktualisierung: 2026-02-20 | Quellen: 25 Jira-Stories (3 Epics), 4 Flows, 1 Confluence-Seite, 2 lokale Docs

## Überblick

Field Service umfasst die vor-Ort-Prüfungen und Wartungen an Annahmestellen-Geräten durch das ProServices-Team. Es gibt zwei Hauptprozesse: die **VDE Prüfung** (jährliche elektrische Sicherheitsprüfung aller Geräte gemäß VDE-Vorschriften) und die **Thermodruckerwartung** (jährliche Wartung und ggf. Tausch von Thermodruckern und Terminals). Beide Prozesse nutzen den gleichen Case-RecordType (`STLGS_ServiceDeskCase`) wie der Service Desk, aber mit eigenen TopicArea-Werten, eigenen Feldern und eigener Automation.

**Akteure:**

- **ProServices (2nd Level):** Externe Hardware-Spezialisten, führen VDE-Prüfungen und Wartungen vor Ort durch. Arbeiten über das Experience-Cloud-Portal.
- **Service Desk (1st Level):** Koordination, erstellt Cases (einzeln oder massenhaft), nimmt erledigte Cases zurück, schließt nach Prüfung.
- **Field Service (Intern):** Prüft zurückgemeldete Cases, gibt frei zum Abschluss.

Siehe auch: [docs/service-desk.md](service-desk.md) — Service Desk Case Management, ProServices Portal, Queues, Permissions. [docs/testkauf.md](testkauf.md) — Testkauf-Cases (anderer RecordType, gleiche Accounts).

## Geschäftsprozess

### VDE Prüfung (Elektrische Sicherheitsprüfung)

**Jährlicher Zyklus:** Alle aktiven Annahmestellen (Status Betriebsbereit/Gesperrt) erhalten einen VDE-Prüfungs-Case. Die Erstellung erfolgt entweder einzeln per Quick Action am Account oder massenhaft via API.

**Ablauf:**

1. **Case-Erstellung:** Quick Action "Neue VDE Prüfung" am Account (für SD/FS/Admin) oder Massenanlage via Composite Tree API. Case wird mit TopicArea "VDE Prüfung", Status "New", `ChecksToKBDone = true` erstellt. Subject: `{StoreNumber} - VDE Prüfung {Jahr}`.
2. **Automatische Asset-Generierung:** Flow `STLGS_CreateAssetsVDECases` erzeugt pro Case eine Menge Standard-Assets basierend auf `Account.STLGS_SalesType__c`:
   - **Vollannahmestelle:** 12 Assets (Elite Terminal, A4 Drucker, Display, 3x Lichtleiste, Hub Switch, 2x EJD, Los Display, Smart Device)
   - **Lotto Kompakt:** 7 Assets (Kompakt Terminal, Kundenmodul, 2x EJD, Los Display, Smart Device)
   - Die Zuordnung wird über Custom Metadata `STLGS_VDEAssetCreation__mdt` gesteuert (17 Records).
   - Zusätzliche Assets können manuell am Case angelegt werden (CRM-2961) — z.B. bei Stores mit mehreren Terminals.
3. **Zuweisung an ProServices:** Case wird an ProServices Queue zugewiesen → Email-Benachrichtigung via Flow `STLGS_SendEmailToProServices`.
4. **Prüfung vor Ort:** ProServices füllt pro Asset die Prüfdaten aus:
   - **Kein Fehler:** `SerialNumber` (Pflicht) + `STLGS_InspectionDate__c` im Format MM/JJ (Pflicht) + `STLGS_InspectionStickerApplied__c = true` (Pflicht)
   - **Fehler gefunden:** `SerialNumber` (Pflicht) + `Description` (Pflicht) + `STLGS_ErrorFound__c = true`
   - **Fest verbaut:** `STLGS_PermanentlyInstalled__c = true` — Gerät benötigt keine VDE-Prüfung. Hinweis: Foto als Nachweis muss als Kommentar am Case hochgeladen werden (CRM-2957).
5. **Fehler-Folgeprozess:** Wenn `STLGS_ErrorFound__c = true` auf einem Asset gesetzt wird:
   - Flow `STLGS_UpdateVDECaseOnErrorFound` setzt `STLGS_IsErrorFound__c = true` am Parent-Case
   - Flow erstellt automatisch einen Child-Case mit TopicArea "Fehler VDE-Prüfung", Owner = Service Desk Queue, Subject = "Fehler VDE-Prüfung {AssetName}"
   - Der Child-Case muss separat bearbeitet und geschlossen werden
6. **Case-Abschluss VDE:**
   - Flow `STLGS_CheckOpenVDECases` verhindert Schließen des Parent-Case wenn offene Child-Cases existieren
   - Am Parent-Case: Prüfplaketten-Felder für Terminal und Thermodrucker ausfüllen (`STLGS_IsInspectionLabelTerminal__c`, `STLGS_InspectionLabelDateTerminal__c`, `STLGS_InspectionLabelThermalPrinter__c`, `STLGS_InspectionLabelDateThermalPrinter__c`)
   - Zusatzfelder: `STLGS_ExecutionDate__c`, `STLGS_PersonOnSite__c`, `STLGS_Inspector__c`, `STLGS_TestingDevice__c`

**VDE 2026 Durchführung (abgeschlossen 07.02.2026):**
- 2.037 Cases erstellt für alle aktiven Stores
- 52 zusätzliche Assets für 46 Sonderfälle (Stores mit Extra-Hardware aus Aegis)
- Sonder-Hardware-Codes: `LSGELITE` → zusätzliches Elite Terminal, `A4P` → zusätzlicher A4 Drucker, `LKOMPAKT` → zusätzliches Kompakt Terminal

### Thermodruckerwartung

**Jährlicher Zyklus:** Alle aktiven Annahmestellen mit Vertragsbeginn > 12 Monate erhalten einen Wartungs-Case. Cases werden ausschließlich massenhaft via API erstellt.

**Ablauf:**

1. **Case-Erstellung (Massenanlage):** Composite Tree API mit folgenden Feld-Werten:
   - RecordType: `STLGS_ServiceDeskCase`
   - TopicArea: `Wartung__c`
   - Status: `Zugewiesen an 2nd Level` (direkt, ohne Zwischenschritt)
   - Owner: Queue ProServices (`00GTr000005KTsfMAG`)
   - Subject: `{StoreNumber} - Wartung Thermodrucker und Terminal {Jahr}`
   - `STLGS_ChecksToKBDone__c = true`, `STLGS_ProServicesCase__c = true`
   - `STLGS_LeadingArticle__c = ka0Tr000000t7P3IAI` (KB-Artikel)
   - **Kein Asset-Flow** bei TopicArea "Wartung" (anders als VDE Prüfung)
2. **Wartung vor Ort:** ProServices füllt die Wartungsfelder am Case aus:
   - Gelieferter Thermodrucker SN, Entnommener Thermodrucker SN
   - Testdruck/Diagnosedruck (10 Blatt), Fehler gefunden, Terminal gereinigt
   - Druckerzustand (Picklist), Bemerkungen Thermodrucker (Rich Text)
   - Prüfplaketten: Terminal + Thermodrucker (Checkbox + Datum)
   - Ausführungsdatum, anwesende Person, Prüfer
3. **Rückmeldung:** ProServices gibt Case zurück an SD/Field Service (Status "Zurück von 2nd Level")
4. **Case-Abschluss:** Field Service prüft die Rückmeldung, setzt Resolution "Thermodrucker Wartung abgeschlossen" + `STLGS_GeneralDescription__c` und schließt den Case.

**Wartung 2026 (Stand 19.02.2026):**
- 1.845 neue Cases geplant (aktive Stores ohne bestehenden Wartungs-Case)
- Vorbereitet, noch nicht ausgeführt

**Wartung 2025 — Bestandsaufnahme:**
- 950 Cases gesamt: 476 Closed, 469 "Zurück von 2nd Level" (Mass Close nötig), 5 noch bei ProServices

### Feedbackprozess Terminaltausch (geplant)

CRM-2450: Strukturierter Feedbackprozess bei Terminaltausch — aktuell im Backlog, noch keine Kinder-Stories. Ziel: standardisierte Rückmeldung nach Hardware-Tausch.

## Business Rules

- **VDE — Fehler gefunden (Asset):** Wenn `STLGS_ErrorFound__c = true`, müssen `SerialNumber` und `Description` ausgefüllt sein (Validation Rule `STLGS_ErrorFound`)
- **VDE — Kein Fehler (Asset):** Wenn `STLGS_ErrorFound__c = false` und Felder geändert werden, müssen `SerialNumber`, `STLGS_InspectionDate__c` und `STLGS_InspectionStickerApplied__c = true` ausgefüllt sein (Validation Rule `STLGS_ErrorNOTFound`)
- **VDE — InspectionDate Format:** `STLGS_InspectionDate__c` muss Format MM/JJ haben (5 Zeichen, "/" an Position 3, Monat 01-12) (Validation Rule `STLGS_InspectionDateValidation`)
- **VDE — Parent-Case Close blockiert:** VDE-Case kann nicht geschlossen werden wenn offene Child-Cases existieren (Flow `STLGS_CheckOpenVDECases`)
- **VDE — Resolution "TMS aktualisiert" blockiert:** Bei `STLGS_IsErrorFound__c = true` + vorhandenem Child-Case darf die Resolution "TMS aktualisiert" nicht verwendet werden (Validation Rule `STLGS_CaseResolutionVDEErrorFound`)
- **VDE — Quick Action Zugriff:** Nur Service Desk, Field Service und Admins können VDE-Cases über die Quick Action erstellen (CRM-2908)
- **Wartung — Status "Zugewiesen an 2nd Level":** Erfordert `STLGS_ChecksToKBDone__c = true` (Validation Rule `STLGS_PreventStatusChange2ndLevelSD`, geteilt mit SD)
- **Wartung — Case Close:** Erfordert `STLGS_Resolution__c` + `STLGS_GeneralDescription__c` (Validation Rule `STLGS_SDCaseResolutionMandatoryFields`, geteilt mit SD)
- **Beide — Portal-Sichtbarkeit:** `STLGS_ProServicesCase__c = true` für Sichtbarkeit im ProServices Experience Cloud Portal
- **Alle Validation Rules:** Bypass via `$Setup.STLG_BypassSwitch__c.STLG_ValidationRuleSwitch__c`

## Technische Umsetzung

### Datenmodell — Asset (VDE-spezifisch)

| Feld (API-Name) | Typ | Beschreibung |
|------------------|-----|--------------|
| `Case__c` | Lookup(Case) | Verknüpfung zum VDE-Prüfungs-Case |
| `STLGS_Type__c` | Picklist | Asset-Kategorie (siehe Picklist-Werte unten) |
| `STLGS_ErrorFound__c` | Checkbox | Fehler bei VDE-Prüfung gefunden |
| `STLGS_InspectionDate__c` | Text(20) | Prüfdatum im Format MM/JJ (z.B. "03/26") |
| `STLGS_InspectionStickerApplied__c` | Checkbox | Prüfplakette angebracht |
| `STLGS_Name__c` | Text | Gerätename (aus CMT-Label) |
| `STLGS_PermanentlyInstalled__c` | Checkbox | Gerät fest verbaut (keine VDE-Prüfung nötig) |
| `SerialNumber` | Text (Standard) | Seriennummer des Geräts (Pflichtfeld bei Prüfung) |
| `Description` | Text (Standard) | Bemerkungen (Pflicht bei Fehler) |

### Datenmodell — Case (Field-Service-Felder)

**Gemeinsame Felder (VDE + Wartung):**

| Feld (API-Name) | Typ | Beschreibung |
|------------------|-----|--------------|
| `STLGS_ExecutionDate__c` | DateTime | Datum/Uhrzeit der Durchführung |
| `STLGS_PersonOnSite__c` | Text | Anwesende Person vor Ort |
| `STLGS_Inspector__c` | Text | Name des Prüfers |
| `STLGS_IsErrorFound__c` | Checkbox | Fehler gefunden (Master-Flag am Case, gesetzt via Flow bei Asset-Error) |

**VDE-spezifische Felder:**

| Feld (API-Name) | Typ | Beschreibung |
|------------------|-----|--------------|
| `STLGS_IsInspectionLabelTerminal__c` | Checkbox | Prüfplakette am Terminal angebracht |
| `STLGS_InspectionLabelDateTerminal__c` | Date | Datum der Prüfplakette Terminal |
| `STLGS_InspectionLabelThermalPrinter__c` | Checkbox | Prüfplakette am Thermodrucker angebracht |
| `STLGS_InspectionLabelDateThermalPrinter__c` | Date | Datum der Prüfplakette Thermodrucker |
| `STLGS_ReExamination__c` | Checkbox | Wiederholungsprüfung erforderlich |
| `STLGS_TestingDevice__c` | Picklist | Prüfgerät (siehe Picklist-Werte unten) |
| `STLGS_WasAStInformedDefectDevices__c` | Checkbox | ASt über defekte Geräte informiert |

**Wartung-spezifische Felder:**

| Feld (API-Name) | Typ | Beschreibung |
|------------------|-----|--------------|
| `STLGS_DeliveredThermalPrinterSN__c` | Text | Seriennummer gelieferter Thermodrucker |
| `STLGS_RemovedThermalPrinterSN__c` | Text | Seriennummer entnommener Thermodrucker |
| `STLGS_IsTestPrintDone__c` | Checkbox | Testdruck/Diagnosedruck (10 Blatt) durchgeführt |
| `STLGS_IsTerminalCleaned__c` | Checkbox | Terminal gereinigt |
| `STLGS_PrinterStatus__c` | Picklist | Druckerzustand (siehe Picklist-Werte unten) |
| `STLGS_DescriptionThermalPrinter__c` | Rich Text | Bemerkungen Thermodrucker (Ergebnisse, Störungen, Defekte) |

### Datenmodell — Picklist-Werte

**`STLGS_Type__c` (Asset):**

| API-Wert | Label | Beschreibung |
|----------|-------|--------------|
| `Lottowand` | Lottowand | Geräte der Lottowand-Kategorie |
| `Terminal & Drucker` | Terminal & Drucker | Terminal- und Druckergeräte |
| `weitere Geräte` | weitere Geräte | Sonstige Geräte (EJD, Smart Device, Hub Switch etc.) |

**`STLGS_PrinterStatus__c` (Case — Wartung):**

| API-Wert | Label | Beschreibung |
|----------|-------|--------------|
| `sehr gut` | sehr gut | Drucker in einwandfreiem Zustand |
| `gut` | gut | Drucker funktionsfähig, normale Abnutzung |
| `sichtbare Gebrauchsspuren` | sichtbare Gebrauchsspuren | Gebrauchsspuren erkennbar |
| `beschädigt (bitte Beschädigung im Bemerkungsfeld erfassen)` | beschädigt | Drucker beschädigt — Details in Bemerkungsfeld erforderlich |

**`STLGS_TestingDevice__c` (Case — VDE):**

| API-Wert | Label | Beschreibung |
|----------|-------|--------------|
| `Benning ST 755+` | Benning ST 755+ | Standardprüfgerät für VDE-Prüfung |

**TopicArea-Werte (Field Service):** → Vollständige Picklist in [service-desk.md](service-desk.md)

| API-Wert | Label | Beschreibung |
|----------|-------|--------------|
| `VDE Prüfung` | VDE Prüfung | Jährliche elektrische Sicherheitsprüfung |
| `Fehler VDE-Prüfung` | Fehler VDE-Prüfung | Folgeprozess bei Asset-Fehler |
| `Wartung__c` | Wartung | Jährliche Thermodrucker-/Terminal-Wartung |

**Resolution-Werte (Field Service):** → Vollständige Resolution-Picklist in [service-desk.md](service-desk.md)

| API-Wert | Label | TopicArea |
|----------|-------|-----------|
| `TMS aktualisiert` | TMS aktualisiert | VDE Prüfung |
| `Gerät repariert & TMS aktualisiert` | Gerät repariert & TMS aktualisiert | VDE Prüfung |
| `Gerät entsorgt & TMS aktualisiert` | Gerät entsorgt & TMS aktualisiert | VDE Prüfung |
| `Gerät repariert/entsorgt & TMS aktualisiert` | Gerät repariert/entsorgt & TMS aktualisiert | VDE Prüfung |
| `Austausch initiiert` | Austausch initiiert | Fehler VDE-Prüfung |
| `Thermodrucker Wartung abgeschlossen` | Thermodrucker Wartung abgeschlossen | Wartung |

### Datenmodell — Custom Metadata (`STLGS_VDEAssetCreation__mdt`)

Steuert die automatische Asset-Generierung bei VDE-Case-Erstellung. 17 Records:

**Vollannahmestelle (12 Assets):**

| CMT Record | Asset-Name (Label) | STLGS_Type__c |
|------------|-------------------|---------------|
| `Elite_Terminal_Voll` | Elite Terminal | Terminal & Drucker |
| `A4_Drucker_Voll` | A4 Drucker | Terminal & Drucker |
| `Display_Voll` | Display | Lottowand |
| `Lichtleiste_1_Voll` | Lichtleiste 1 | Lottowand |
| `Lichtleiste_2_Voll` | Lichtleiste 2 | Lottowand |
| `Lichtleiste_3_Voll` | Lichtleiste 3 | Lottowand |
| `Los_Display_Voll` | Los Display | Lottowand |
| `Hub_Switch_Voll` | Hub Switch | weitere Geräte |
| `EJD_gross_Voll` | EJD groß | weitere Geräte |
| `EJD_klein_Voll` | EJD klein | weitere Geräte |
| `Smart_Device_Voll` | Smart Device | weitere Geräte |

**Lotto Kompakt (7 Assets):**

| CMT Record | Asset-Name (Label) | STLGS_Type__c |
|------------|-------------------|---------------|
| `Kompakt_Terminal_Kompakt` | Kompakt Terminal | Terminal & Drucker |
| `Kundenmodul_Kompakt` | Kundenmodul | Terminal & Drucker |
| `Los_Display_Kompakt` | Los Display | Lottowand |
| `EJD_gross_Kompakt` | EJD groß | weitere Geräte |
| `EJD_klein_Kompakt` | EJD klein | weitere Geräte |
| `Smart_Device_Kompakt` | Smart Device | weitere Geräte |

Hinweis: Vollannahmestelle hat 11 Records oben — das 12. Asset ergibt sich aus dem Standard-Layout. Lotto Kompakt hat 6 Records oben. Die Zählung "12 bzw. 7 Standard-Assets" stammt aus dem VDE-2026-Projekt und schließt ggf. implizite Assets ein.

### Automation

| Flow / Komponente | Typ | Zweck |
|-------------------|-----|-------|
| `STLGS_CreateAssetsVDECases` | Record-Triggered (After Save) | Erstellt automatisch Assets bei VDE-Case-Erstellung basierend auf CMT + SalesType |
| `STLGS_CheckOpenVDECases` | Record-Triggered (Before Save) | Verhindert Schließen des VDE Parent-Case wenn offene Child-Cases existieren |
| `STLGS_UpdateVDECaseOnErrorFound` | Record-Triggered (After Save, Asset) | Setzt `IsErrorFound` am Parent-Case und erstellt Child-Case "Fehler VDE-Prüfung" bei Asset-Fehler |
| `STLGS_SendEmailToProServices` | Record-Triggered (After Save) | Email-Benachrichtigung bei Zuweisung an ProServices Queue/User. Spezialbehandlung für TopicArea "Wartung" |

**Validation Rules (Asset):**

| Flow / Komponente | Typ | Zweck |
|-------------------|-----|-------|
| `STLGS_ErrorFound` | Validation Rule (Asset) | Bei `ErrorFound = true`: SerialNumber + Description Pflicht |
| `STLGS_ErrorNOTFound` | Validation Rule (Asset) | Bei `ErrorFound = false` + Feldänderung: SerialNumber + InspectionDate + StickerApplied Pflicht |
| `STLGS_InspectionDateValidation` | Validation Rule (Asset) | InspectionDate muss Format MM/JJ haben (5 Zeichen, "/" an Pos 3, Monat 01-12) |

**Validation Rules (Case):**

| Flow / Komponente | Typ | Zweck |
|-------------------|-----|-------|
| `STLGS_CaseResolutionVDEErrorFound` | Validation Rule (Case) | VDE-Case mit ErrorFound + Child-Case: Resolution "TMS aktualisiert" blockiert |

### UI-Komponenten

| Flow / Komponente | Typ | Zweck |
|-------------------|-----|-------|
| `Account.STLGS_NewVDECheckCase` | Quick Action | Erstellt VDE-Case mit vorbefüllten Feldern (TopicArea, Status, Subject mit StoreNumber + Jahr). Nur für SD/FS/Admin. |
| `STLGS_ProServices` | List View (Case) | Offene ProServices-Cases (ohne TopicArea "Wartung"), geteilt mit Portal |
| `Pro_Services_Maintenance` | List View (Case) | Offene Wartungs-Cases (TopicArea "Wartung"), geteilt mit Portal |
| LWC `stlgs_searchArticleDetails` | LWC | KB-Artikel-Suche, auch für VDE/Wartung → Details in [service-desk.md](service-desk.md) |
| VDE Asset-Bearbeitung (CRM-2909) | LWC | Direkte Assetbearbeitung im VDE Case (eingebettet in Case Record Page) |

### Integrationen

- **ProServices Portal:** Experience Cloud, Zugriff auf VDE-Cases und Wartungs-Cases über dedizierte List Views. Geteilte Infrastruktur mit SD → Details in [service-desk.md](service-desk.md)
- **Email an ProServices:** Flow `STLGS_SendEmailToProServices` sendet Benachrichtigung bei Case-Zuweisung. Empfänger: `it-fieldservice@lotto-bw.de` (intern) / `iknos-lottobw+fieldservice@iknos.net` (ProServices Portal-User). Enthält Deeplink zum Portal.
- **Aegis (Terminal-Daten):** VDE-Sonderfälle (zusätzliche Assets) werden auf Basis von Aegis-Daten ermittelt (Hardware-Codes: LSGELITE, A4P, LKOMPAKT)
- **Massenanlage via Composite Tree API:** Standardmethode für jährliche Case-Erstellung (VDE + Wartung). 200 Records/Batch, 2s Pause. → Details zu Bulk-Operationen in MEMORY.md

## Konfiguration

- **RecordType:** `STLGS_ServiceDeskCase` (`012Tr000003l2pRIAQ`) — geteilt mit Service Desk
- **Queues:** `STLGS_ProServices` (`00GTr000005KTsfMAG`) für VDE und Wartung. Zusätzliche Queue "ProServices - Wartung" in Planung (CRM-2670, Status: Spezifizieren).
- **Email-Adressen:** `it-fieldservice@lotto-bw.de` (intern), `iknos-lottobw+fieldservice@iknos.net` (ProServices extern)
- **KB-Artikel:** `ka0Tr000000t7P3IAI` — Leading Article für Wartungs-Cases
- **Custom Metadata:** `STLGS_VDEAssetCreation__mdt` — 17 Records für Asset-Vorlagen (11 Voll + 6 Kompakt)
- **Bypass Switch:** `$Setup.STLG_BypassSwitch__c.STLG_ValidationRuleSwitch__c` — deaktiviert Asset Validation Rules (für Massenoperationen)
- **Quick Action:** `Account.STLGS_NewVDECheckCase` — sichtbar für Service Desk, Field Service, Admin Profiles
- **Profiles/PermSets:** Geteilte Infrastruktur mit SD → [service-desk.md](service-desk.md) (ProServices, ServiceDesk, ServiceDesk Lead)

## Bekannte Probleme & Workarounds

- **CRM-2959 (Backlog):** VDE Geräte sollen in bestimmter Reihenfolge angezeigt werden — aktuell unsortiert
- **CRM-2984 (Next):** VDE Portal: Related Cases der ASt sollen keine Priorität anzeigen
- **CRM-2636 (Spezifizieren):** Wartungs-Cases sollen von ProServices "erledigt" (neuer Zwischenstatus) werden können, nicht direkt "Geschlossen" — finale Schließung durch Field Service
- **CRM-2670 (Spezifizieren):** Zusätzliche Warteschlange "ProServices - Wartung" zur Trennung von VDE und Wartungs-Cases
- **CRM-2450 (Backlog):** Feedbackprozess bei Terminaltausch — noch nicht spezifiziert
- **Wartung 2025 — 469 offene Cases:** Status "Zurück von 2nd Level" → Mass Close nötig (Resolution "Thermodrucker Wartung abgeschlossen" + GeneralDescription)
- **CMT Asset-Zählung:** Die CMT hat 11 (Voll) bzw. 6 (Kompakt) Records — die dokumentierten "12 bzw. 7 Standard-Assets" aus dem VDE-2026-Projekt weichen leicht ab. Ursache unklar (möglicherweise wurde ein Asset außerhalb der CMT angelegt).

## Referenzen

**Jira Epics:**

| Key | Summary | Status |
|-----|---------|--------|
| CRM-2453 | SD: VDE Prüfung durch Pro Service | UAT |
| CRM-2611 | SD: Thermodruckerwartung durch Pro Services | Fertig |
| CRM-2450 | SD: Feedbackprozess bei Terminaltausch | Backlog |

**Jira Stories (VDE — CRM-2453):**

| Key | Summary | Status |
|-----|---------|--------|
| CRM-2895 | VDE Cases anlegen | Fertig |
| CRM-2905 | VDE: Neue Felder am Case für VDE Prüfung | Fertig |
| CRM-2906 | VDE: Custom Metadata für Asseterstellung anlegen | Fertig |
| CRM-2907 | VDE: Neue Asset Felder anlegen | Fertig |
| CRM-2908 | VDE: Neuer Button am Store für VDE-Case | Fertig |
| CRM-2909 | VDE: LWC für direkte Assetbearbeitung im VDE Case | Fertig |
| CRM-2910 | VDE: Trigger zur automatischen Assetgenerierung | Fertig |
| CRM-2911 | VDE: Flow — Update Parent Case Error Field on Asset Error | Fertig |
| CRM-2912 | VDE: Button "Zurück an Fieldservice" + ErrorFound-abhängig | Fertig |
| CRM-2936 | SD: Portal — AST Detailseite erweitern | Fertig |
| CRM-2955 | VDE Felder am Child Case anzeigen | Fertig |
| CRM-2957 | VDE Gerät fest verbaut | Fertig |
| CRM-2958 | VDE: Related Cases der ASt am VDE Case anzeigen | Fertig |
| CRM-2959 | VDE Geräte in bestimmter Reihenfolge anzeigen | Backlog |
| CRM-2961 | VDE zusätzliches Asset am Case anlegen | Fertig |
| CRM-2984 | VDE Portal: Related Cases — keine Prio anzeigen | Next |

**Jira Stories (Wartung — CRM-2611):**

| Key | Summary | Status |
|-----|---------|--------|
| CRM-2632 | SD-Vorgang Thermodrucker — Community | Fertig |
| CRM-2633 | Vorgänge Thermodrucker Wartung anlegen | Fertig |
| CRM-2635 | Listview + Suche nach aktiven ASten | Fertig |
| CRM-2636 | Vorgang (Status) Wartung durch ProServices erledigt | Spezifizieren |
| CRM-2641 | SD-Vorgang Thermodrucker — Core | Fertig |
| CRM-2670 | Zusätzliche Warteschlange: ProServices — Wartung | Spezifizieren |
| CRM-2671 | Keine Email an ProServices bei Wartungs-Cases | Fertig |

**Confluence:**

- [VDE Prüfung](https://kommit.atlassian.net/wiki/spaces/CRM/pages/1714257921) — Prozessübersicht und Ticket-Referenzen

**Codebase:**

- Flows: `force-app/main/default/flows/STLGS_CreateAssetsVDECases.flow-meta.xml`, `STLGS_CheckOpenVDECases`, `STLGS_UpdateVDECaseOnErrorFound`, `STLGS_SendEmailToProServices`
- Asset-Felder: `force-app/main/default/objects/Asset/fields/STLGS_*.field-meta.xml`
- Case-Felder: `force-app/main/default/objects/Case/fields/STLGS_Is*`, `STLGS_Inspection*`, `STLGS_Delivered*`, `STLGS_Removed*`, `STLGS_PrinterStatus*`, `STLGS_Description*`
- Validation Rules: `force-app/main/default/objects/Asset/validationRules/STLGS_*.validationRule-meta.xml`
- Quick Action: `force-app/main/default/quickActions/Account.STLGS_NewVDECheckCase.quickAction-meta.xml`
- CMT: `force-app/main/default/customMetadata/STLGS_VDEAssetCreation.*.md-meta.xml`

**Lokale Docs:**

- `business/docs/thermodruckerwartung-plan.md` — Implementierungsplan Wartung 2026
- `business/docs/thermodruckerwartung-report.md` — Store-Analyse (1.845 Stores)

## Änderungshistorie

| Datum | Änderung | Quelle |
|-------|----------|--------|
| 2026-02-20 | Initiale Erstellung | CRM-2453, CRM-2611, CRM-2450, Codebase-Analyse |
