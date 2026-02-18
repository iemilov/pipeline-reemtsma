# Domain Knowledge: Lotto Baden-Württemberg

## Glossar

| Abkürzung              | Deutsch                      | Englisch                                      |
| ---------------------- | ---------------------------- | --------------------------------------------- |
| **ASt**                | Annahmestelle                | Sales Point / Lottery Retailer                |
| **ASten**              | Annahmestellen               | Sales Points (plural)                         |
| **RD**                 | Regionaldirektion             | Regional Management                           |
| **VO**                 | Vertriebsorganisation         | Sales Organization (Central)                  |
| **VS**                 | Vertriebssteuerung            | Sales Control                                 |
| **RP**                 | Regierungspräsidium           | Government Licensing Authority                |
| **TK**                 | Testkauf                      | Test Purchase / Mystery Shopping              |
| **VDE**                | Verband der Elektrotechnik    | Electrical Safety Inspection                  |
| **LMS**                | Learning Management System    | External training platform                    |
| **ASt-Leiter**         | Annahmestellenleiter          | Store Manager / License Holder                |
| **Antrag**             | Antrag                        | Application (open/takeover/relocate)          |
| **Vorgang**            | Kundenvorgang                 | Case / Customer Incident                      |
| **Leitung**            | Leitung/Lizenz                | Licensed operating permission (person)        |
| **Lizenzinhaber**      | Lizenzinhaber                 | License Holder (natural person)               |
| **Filialverantwortliche** | Filialverantwortliche      | Branch Responsible (legal entity)             |
| **Aegis**              | Aegis                         | POS/Terminal management system                |
| **ELO**                | ELO                           | Electronic document archive                   |
| **GBV**                | Geschäftsbesorgungsvertrag    | Business management contract (legal entity)   |
| **Mahnstufe**          | Mahnstufe                     | Warning level (TK sanctions)                  |
| **Ampelstatus**        | Ampelstatus                   | Traffic light status (TK compliance)          |
| **VT-Strafe**          | Vertragsstrafe                | Contractual penalty                           |

## Organisationsstruktur

### RD — Regionaldirektion

- **Aussendienst**: Gebietsleiter (territory managers) — Kundenbesuch, Testkauf-Begleitung
- **Innendienst**: Back-Office — Anträge vorbereiten, Vorgänge erstellen
- **Regionaldirektor**: Genehmigt Anträge (ersetzt Unterschrift), Eskalationsinstanz
- Erstellt: Anträge, Vorgänge, Kündigungen (ASt-initiiert)

### VO — Vertriebsorganisation (Zentrale)

- Zentrale Bearbeitung: Anträge prüfen, Aegis/CRM aktualisieren, Verträge erstellen
- Kommunikation mit RP (Regierungspräsidium)
- Erstellt: Kündigungen (STLG-initiiert), Dokumente, RP-Meldungen
- Pflegt: Account-Status, Terminallaufzeiten in Aegis

### RP — Regierungspräsidium

- Externe Behörde, genehmigt/lehnt Standortlizenzen ab
- Empfängt: Anträge auf Erlaubnis, Außerbetriebnahme-Meldungen

### Skopos (extern)

- Testkauf-Agentur, führt Mystery-Shopping durch
- Case Owner für TK-Vorgänge (nicht ändern!). In der Regel nur Ersttest.

### Auroma (extern)

- Testkauf-Agentur, führt Mystery-Shopping durch
- Case Owner für TK-Vorgänge (nicht ändern!) In der Regel nur Nachtests. Aber auch Ersttest möglich.

## Externe Systeme & Integrationen

| System                  | Funktion                                                       | Sync-Richtung                                         |
| ----------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| **Aegis**               | Terminal/POS-System, Terminallaufzeiten, Steuernummer, Verträge | Bidirektional (VO pflegt in Aegis → Sync nach SF)     |
| **ELO**                 | Dokumentenarchiv (Verträge, Führungszeugnis, Schufa etc.)       | Kein direkter Sync — Checklisten-Bestätigung in SF    |
| **uberall / Google Maps** | Verzeichnisdienst, Standortsuche auf lotto-bw.de             | SF → uberall (Öffentliche Daten + Ladenöffnungszeiten) |
| **LMS**                 | Online-Pflichtschulung (6 Module)                               | CSV-Import (`lernstand.csv`) → SF Cases               |
| **Telefonleitung**      | Auto-Bestellung bei Antrag "Übergeben an RP"                   | Trigger aus SF                                        |

## Account & Annahmestelle

### Vertragsarten

- **Natürliche Person**: Einzelperson als Lizenzinhaber (= ASt-Leiter), ein Standort, kann mehrere Standorte haben (klassischer Mehrfachstandortbetreiber)
- **Juristische Person**: Firma als Vertragspartner, kann mehrere Standorte haben, Filialverantwortliche pro Standort

### Vertriebsform (`STLGS_SalesType__c`)

- **Vollannahmestelle**: Vollsortiment Lotto-Produkte
- **Lotto Kompakt**: Eingeschränktes Sortiment

### Account Status

- `Potentielle ASt` → `Betriebsbereit` → `Geschlossen` → `Löschbereit`
- `Erlaubnis erloschen` (nach Außerbetriebnahme + RP-Meldung)

### Bankverbindung

- < 10.000€ Wochenumsatz: Geschäftskonto erforderlich
- >= 10.000€ Wochenumsatz: Treuhandkonto erforderlich

## Antrag — Lifecycle

### Antragstypen

1. **Neueröffnung** — Neuer Standort
2. **Übernahme** — Bestehender Standort, neuer Betreiber
3. **Verlegung** — Umzug (gleicher PLZ-Bereich)
4. **Upgrade** — Kompakt → Vollannahmestelle
5. **Downgrade** — Vollannahmestelle → Kompakt

### Status-Flow

```text
Zusammenarbeit prüfen → Antrag vorbereiten → Freigabe Regionaldirektor
→ An Zentrale übergeben → Geprüft durch Zentrale → Übergeben an RP
→ Genehmigt durch RP → Vertrag abgeschlossen → [Erlaubnis erloschen]
```

Ablehnungspfade: `Durch ASt abgelehnt`, `Durch RD abgelehnt`, `Abgelehnt durch RP`, `Zurückgezogen`

### Validierungen

- **Vorlaufzeit**: Neueröffnung >= 6 Wochen, Übernahme >= 4 Wochen
- **Führungszeugnis**: Max. 6 Monate alt
- **Schufa-Auskunft**: Max. 6 Monate alt (alle Seiten + Deckblatt)
- **Gewerbeanmeldung**: Muss bei Übergabe an VO vorliegen

### Automatisierungen bei Status-Wechsel

- **Geprüft durch Zentrale**: 2x Pflichtschulung-Cases erstellt (Präsenz + Online)
- **Übergeben an RP**: Telefonleitung automatisch bestellt
- **Genehmigt durch RP** (bei Verlegung/Übernahme): Außerbetriebnahme-Datum am alten Antrag auto-gesetzt

### Antrag-Tabs

- **Details**: Standortinfos, geplante Betriebstermine, Dringlichkeit
- **Öffentliche Daten**: Sucheinträge & Google Maps (benötigt ASt-Zustimmung)
- **Terminallaufzeiten**: Wann Lotto-Terminal aktiv
- **Begründung**: Geschäftliche Rechtfertigung
- **Bankdaten**: SEPA-Mandat (IBAN, Kontoinhaber)
- **Vertragsabschluss**: Dokumentengenerierung
- **Checkliste**: RD bestätigt Dokumentation in ELO
- **RP**: Behördenkommunikation

## Vorgänge (Cases) — Übersicht

### Vorgangstypen

| Typ                              | Erstellt durch | Besonderheiten                                    |
| -------------------------------- | -------------- | ------------------------------------------------- |
| Allgemeines Anliegen             | RD             | Catchall für nicht-kategorisierte Anliegen         |
| Bestellung                       | RD             | Herkunft: Email, Telefon, Brief, POS, Terminal, Box |
| Terminallaufzeiten               | RD             | Änderung Terminalzeiten → VO pflegt in Aegis       |
| Öffnungszeiten                   | RD             | Ladenöffnungszeiten (für lotto-bw.de, uberall)     |
| Bankdaten                        | RD             | SEPA/Kontodaten-Änderung                          |
| Vertragsrelevante Daten ändern   | RD             | Siehe eigene Sektion unten                        |
| Service Desk                     | VO/RD          | Technische Probleme (Terminal, Drucker, Passwort)  |
| Kündigung                        | RD oder VO     | Siehe eigene Sektion unten                        |

### Generischer Status-Flow (Vorgänge)

```text
Neu → In Bearbeitung RD → Übergeben an VO → In Bearbeitung VO → Geschlossen
                                      ↕ Übergeben an RD (Rückfrage)
```

## Vertragsrelevante Datenänderungen

### Anliegen-Typen (lösen diesen Vorgang aus)

- Steuernummer ändern (Aegis-Update)
- Abrechnungsemail ändern
- Telefonnummer ASt ändern
- Kontaktdaten Filialverantwortliche/Lizenzinhaber (Name, Staatsangehörigkeit, Geburtsdatum → Aegis)
- Juristische Person: Firmenname, Adresse → Aegis
- **Upgrade/Downgrade** (Vertriebsform-Wechsel)
- **Verspätete Inbetriebnahme** / **Keine Inbetriebnahme**
- **Wechsel zu Agenturstandort**
- **Kündigung durch Lotto veranlassen**

### Workflow

1. RD erstellt Vorgang, bleibt bei RD bis Übergabe
2. RD → `Übergeben an VO`
3. VO findet in Liste "Offene Vertragsrelevante Datenänderungen VO"
4. VO aktualisiert Aegis/CRM, @mention an RD-User im Activity Stream
5. VO schließt ODER → `Übergeben an RD` (bei Rückfragen)

## Testkauf (TK) — Test Purchase / Mystery Shopping

### Testtypen nach Quartal

| Quartal   | Vollannahmestelle              | Kompakt         |
| --------- | ------------------------------ | --------------- |
| Q1        | Jugendschutz + Spielerschutz   | Jugendschutz    |
| Q2/Q3     | Jugendschutz                   | Jugendschutz    |
| Q4        | keine Testkäufe                | keine Testkäufe |

### Ampelstatus & Sanktionen

| Ampel          | Bedeutung                  | Mahnstufe              |
| -------------- | -------------------------- | ---------------------- |
| **Grün**       | Bestanden                  | —                      |
| **Gelb**       | Warnung                    | 1. Abmahnung          |
| **Rot**        | Alarm                      | 2. / ern. 2. Abmahnung |
| **Gesperrt**   | 4-Wochen-Betriebssperre    | ern. 2. Abmahnung     |
| **Geschlossen** | Kündigung ausgelöst        | —                      |

- **VT-Strafe aktuelles Jahr** = kumulierte Vertragsstrafen aus nicht bestandenen TKs
- Ampelstatus wird chronologisch über alle TKs berechnet

### TK Status-Flow

```text
TK durchgeführt → TK-Ergebnis nicht geprüft → TK-Ergebnis geprüft
→ TK-Abmahnung (Dokument generiert) → TK-Abrechnung → Geschlossen
```

Sonderstatus: `TK-Beschwerde` (für Annullierung)

**Status Label → API-Name Mapping:**

| Label | API-Name (fullName) |
| ----- | ------------------- |
| TK-Abmahnung | `Testkauf Abmahnung` |
| TK-Abrechnung | `Abrechnung` |
| TK-Beschwerde | `In Klärung / Beschwerde` |

### Sonderfälle

- **Fehlanfahrt**: Agentur konnte nicht testen (geschlossen, Urlaub etc.) — VO entscheidet ob berechtigt
- **Nachschulung**: Freiwillig (bei Gelb → zurück auf Grün), Pflicht (bei Rot → zurück auf Gelb)
- **Annullieren**: Status → TK-Beschwerde → Ergebnis auf "annulliert" → TK-Ergebnis geprüft. **Wichtig**: Alle nachfolgenden TKs müssen chronologisch neu bewertet werden

### Untergeordnete Vorgänge (auto-generiert)

- **TK Schließung**: Auto-Kündigung bei Ampel = Geschlossen
- **TK Sperrung** (nur juristische Person): Auto-Sperrvorgang bei Ampel = Gesperrt, inkl. Sub-Case für Filialverantwortung ändern

### Batch Processing

**Class:** `STLGS_UpdateTestPurchaseBatch`

- **Manual execution:** `Database.executeBatch(new STLGS_UpdateTestPurchaseBatch(), 200);`
- Processes TK cases with status "TK durchgeführt" from previous calendar week
- Week calculation uses `Date.today().toStartOfWeek().addDays(-7)` → **Monday to Sunday** (German locale)
- `LAST_WEEK` in SOQL start query uses same locale-based week definition
- Verified 2026-02-18: Simulation with Mon-Sun matched manual processing results

### Key Validation Rules

- `STLGS_PreventStatusChange2ndLevelSD`: Status "Zugewiesen an 2nd Level" requires `STLGS_ChecksToKBDone__c=true`

### Processing Logic

Batch groups open TK cases by Account, then applies rules based on count and results.
Cases sorted by `STLGS_TestPurchaseExecutionDate__c ASC` (Pos 0 = older, Pos 1 = newer).

**Automatisch** = `nicht geprüft` → `geprüft` → `Abrechnung` (3 DML updates, triggers Ampelstatus-Berechnung)
**Manuell** = `nicht geprüft` (1 DML update, then manual review by VO)

| Cases/Acc | Szenario                                     | Bedingung                     | Modus                            |
| --------- | -------------------------------------------- | ----------------------------- | -------------------------------- |
| 1         | bestanden                                    | in LAST_WEEK                  | Automatisch                      |
| 1         | nicht bestanden                              | —                             | Manuell                          |
| 1         | Nachschulung                                 | —                             | Manuell (CRM-2497)              |
| 2         | beide bestanden                              | beide in LAST_WEEK            | Automatisch (beide)              |
| 2         | Pos 0 bestanden, Pos 1 nicht bestanden       | Pos 0 in LAST_WEEK            | Pos 0 Automatisch, Pos 1 Manuell |
| 2         | Pos 1 bestanden, Pos 0 nicht best./Fehlanf.  | Pos 1 in LAST_WEEK            | Manuell                          |
| 2         | Pos 1 bestanden, Pos 0 nicht in LAST_WEEK    | Pos 1 in LAST_WEEK            | Manuell                          |
| 2         | Nachschulung                                 | —                             | Manuell (CRM-2497)              |
| 2         | Fehlanfahrt                                  | —                             | Manuell                          |
| >2        | beliebig                                     | —                             | Manuell (alle in LAST_WEEK)      |

## Kündigung (Termination)

### Kündigungstypen

1. **Durch die Annahmestelle** (ASt-initiiert): RD erstellt
2. **Durch Lotto** (STLG-initiiert): VO erstellt

### Kündigungsgründe (Picklist)

Geschäftsaufgabe wegen Alters, Zahlungsschwierigkeiten, Spielerschutz-Verstoß, Sonstiges (+ Freitext)

### Workflow — ASt-Kündigung (RD erstellt)

1. RD erstellt Kündigung (Grund, Datum, Leitung-Status, Beschreibung)
2. RD kann via "Kündigung anpassen" editieren (Änderungen im Verlauf protokolliert)
3. RD → `Übergeben an VO`
4. VO setzt Kündigungsdatum am Account (Quickaction)
5. VO erstellt Kündigungsbestätigung (Dokumentengenerierung am Antrag)
6. VO handhabt Leitung-Status → schließt

### Workflow — STLG-Kündigung (VO erstellt)

1. VO erstellt Kündigung + setzt Kündigungsdatum am Account
2. VO erstellt Kündigungsbrief
3. VO übergibt an RD (Inhaberwechsel)
4. RD ergänzt: Möbelgeld, Leitung-Status, Beschreibung
5. RD → `Übergeben an VO` → VO schließt

### Leitungslogik (kritische Business Rule)

| Leitung-Status                  | Bedeutung                          | Folgeaktion                                  |
| ------------------------------- | ---------------------------------- | -------------------------------------------- |
| wird nicht mehr benötigt        | STLG-initiiert                     | VO beendet Leitung sofort                    |
| wird ggf. weiter benötigt       | ASt-initiiert, evtl. Übernahme     | VO wartet 4 Wochen auf Übernahme-Antrag      |
| wird weiter benötigt            | Übernahme-Antrag vorhanden         | Auto-gesetzt wenn Antrag verknüpft           |

- Keine Übernahme nach 4 Wochen → Auto-Wechsel zu "wird nicht mehr benötigt"
- VO schließt Kündigung typischerweise erst wenn Übernahme-Antrag Status "Geprüft durch Zentrale" erreicht

## Außerbetriebnahme (Decommissioning)

### 4 Gründe mit unterschiedlichen Auslösern

| Grund                      | Auslöser                          | Prozess                                                              |
| -------------------------- | --------------------------------- | -------------------------------------------------------------------- |
| **Vertragskündigung**      | Kündigung abgeschlossen           | Account: Betriebsbereit → Geschlossen, VO meldet an RP              |
| **Übernahme**              | Neuer Betreiber übernimmt         | Alter Standort geschlossen, neuer Antrag für Nachfolger              |
| **Verlegung**              | Umzug an neue Adresse             | Alter Antrag → Erlaubnis erloschen wenn neuer "Genehmigt durch RP"  |
| **Keine Inbetriebnahme**   | Antrag zurückgezogen vor Start    | Vorgang "Vertragsrel. Daten ändern" → Anliegen "Keine Inbetriebnahme" |

- VO erstellt immer: "Meldung Außerbetriebnahme und Erlöschen einer erteilten Erlaubnis"
- Endstatus Account: `Erlaubnis erloschen`

## Upgrade / Downgrade

- **Upgrade**: Kompakt → Vollannahmestelle
- **Downgrade**: Vollannahmestelle → Kompakt
- Ausgelöst via Vorgang "Vertragsrelevante Daten ändern" → Anliegen "Upgrade" / "Downgrade"
- VO aktualisiert Vertriebsform im Antrag + erstellt Änderungsmitteilung an RP
- Neue Verträge je nach Vertragsart:
  - Natürliche Person: neuer Annahmestellenleitungs-Vertrag
  - Juristische Person: neuer GBV oder Update Anlage 1

## Pflichtschulung Jugend- und Spielerschutz (Mandatory Training)

### Overview

Each ASt-Leiter must complete mandatory youth/player protection training annually. Training is tracked via Cases of type `Pflichtschulung Jugend- und Spielerschutz` with two training types:

| Training Type | Description                | Created by                                             |
| ------------- | -------------------------- | ------------------------------------------------------ |
| **Präsenz**   | In-person classroom training | Flow `STLGS_UpdateAccStatusOnCreateUpdateRequest`      |
| **Online**    | E-learning via external LMS  | Flow `STLGS_CreateTrainingOnGeprueft` (CRM-2568)       |

### Key Fields on Training Cases

| Field                               | Description                                                      |
| ----------------------------------- | ---------------------------------------------------------------- |
| `STLGS_TrainingType__c`             | "Präsenz" or "Online"                                            |
| `STLGS_TrainingYear__c`             | Training year (e.g., "2025", "2026")                             |
| `STLGS_Type__c`                     | "Pflichtschulung Jugend- und Spielerschutz"                      |
| `STLGS_TrainingModulesCompleted__c` | Number of completed online modules                               |
| `STLGS_TrainingModulesTotal__c`     | Total online modules (currently 6)                               |
| `STLGS_TrainingModulesProgress__c`  | Formula field: `Completed/Total * 100` (read-only)               |
| `STLGS_LastUpdatedLMS__c`           | Timestamp of last LMS sync (auto-set by flow `STLG_CaseSetLastUpdatedLMS`) |
| `STLGS_LeadingRequest__c`           | Lookup to the Request that triggered case creation               |

### Flow Architecture

**Case Creation:**

- **Präsenz-Flow** (`STLGS_UpdateAccStatusOnCreateUpdateRequest`): Creates case WITH `ContactId` (via formula from Request's BranchManager/AccountLead)
- **Online-Flow** (`STLGS_CreateTrainingOnGeprueft`): Creates case when Request reaches status "Geprüft durch Zentrale". Triggers on `STLGS_Request__c` AfterSave.

**ContactId Logic:**

The ContactId is determined by the Request's record type:

- Business Account → `STLGS_BranchManager__r.Id` (Filialleiter)
- Person Account → `STLGS_AccountLead__r.Id`

Formula used in Präsenz-Flow:

```text
IF(CONTAINS({!$Record.STLGS_RecordTypeDeveloperName__c}, "Business"),
   {!$Record.STLGS_BranchManager__r.Id},
   {!$Record.STLGS_AccountLead__r.Id})
```

**BeforeSave Trigger** (`STLGS_UpdateLeadingRequestOnCase`): Sets `STLGS_LeadingRequest__c` and `ContactId` on new Cases — but only if `STLGS_LeadingRequest__c` is NULL. If the creating flow already sets `STLGS_LeadingRequest__c`, this trigger is skipped entirely.

### Known Issue: Online Cases Missing ContactId (fixed 2026-02-17)

**Root Cause:** The Online-Flow sets `STLGS_LeadingRequest__c` but NOT `ContactId`. The BeforeSave trigger that should compensate doesn't fire because its entry condition requires `STLGS_LeadingRequest__c = null`.

**Data Fix:** 194 existing cases (77 from 2025, 117 from 2026) were corrected via script. ContactId was copied from matching Präsenz cases (same Account + Training Year).

**Permanent Fix:** CRM-3019 — Add ContactId formula to the Online-Flow (temporary until CRM-2992 migrates to Training/TrainingMember model).

### LMS Integration

- External LMS provides online training modules for ASt-Leiter
- Progress data available as CSV export (`lernstand.csv`)
- 6 total modules per training; percentage maps to module count (100%=6, 33%=2, 16%=1)
- Sync script: `business/docs/LMS/sync-lernstand.py` (dry-run default, `--apply` for Prod updates)
- Flow `STLG_CaseSetLastUpdatedLMS` auto-sets `STLGS_LastUpdatedLMS__c` when module fields change

## VDE Prüfung (Electrical Safety Inspection)

### Asset Creation

Flow-based automated asset creation based on `Account.STLGS_SalesType__c`:

| Sales Type          | Number of Assets   |
| ------------------- | ------------------ |
| "Vollannahmestelle" | 12 standard assets |
| "Lotto Kompakt"     | 7 standard assets  |

### Custom Asset Fields

| Field                              | Type           | Description                           |
| ---------------------------------- | -------------- | ------------------------------------- |
| `Case__c`                          | Lookup(Case)   | Related inspection case               |
| `STLGS_Type__c`                    | Picklist       | e.g., "Terminal & Drucker", "Lottowand", "weitere Geräte" |
| `STLGS_ErrorFound__c`             | Checkbox       | Error discovered during inspection    |
| `STLGS_InspectionStickerApplied__c` | Checkbox     | Inspection sticker applied            |
| `STLGS_InspectionDate__c`         | Date           | Date of inspection                    |

## Dokumenttypen & Templates

### Vertragsabschluss-Dokumente

- **Annahmestellenleitungs-Vertrag** (natürliche Person)
- **GBV — Geschäftsbesorgungsvertrag** (juristische Person)
- **Anlage 1** (GBV-Anhang: Standortliste)
- **Neueröffnung/Übernahme — Anschreiben an ASt**
- **Neueröffnung — Begleitbrief RD**
- **Verlegung — Anschreiben an ASt**

### Behördliche Dokumente

- **Antrag auf Erlaubnis** (an RP)
- **Änderungsmitteilung** (Upgrade/Downgrade → RP)
- **Meldung Außerbetriebnahme und Erlöschen einer erteilten Erlaubnis** (an RP)

### TK-Dokumente (auto-generiert bei Status-Wechsel)

- **Abmahnschreiben** (Warnung bei nicht bestandenem TK)
- **Sperr-Schreiben** (Betriebssperre bei schwerem Verstoß)

### Sonstige

- **Kündigungsbestätigung** / **Kündigungsbrief**
- **Pflichtschulung-Einladung** (Präsenz + Online)

## Technische Referenz

### Common Field Name Pitfalls

Frequently confused field names — use the correct spelling to avoid deployment errors:

| Correct                          | Common Mistake                      |
| -------------------------------- | ----------------------------------- |
| `STLGS_RegionalDirectorate__c`   | ~~RegionalDirection~~               |
| `STLGS_SubjectSD__c`             | ~~SubjectDescription~~              |
| `STLG_TMFTicketId__c`            | ~~T_MFTicketId~~                    |
| `STLGS_ProServicesCase__c`       | Means "Sichtbar für ProServices"    |
| `STLG_FollowupDate__c`           | ~~FollowUpDate~~ (capital U)        |

### Bulk Data Operations

#### Preferred Approach: Composite Tree API

```bash
POST /services/data/v65.0/composite/tree/Case
```

- Maximum 200 records per request
- Each record requires `referenceId` in `attributes`
- Add 2-second pause between batches for rate limiting

**Avoid:** `sf data import bulk` has persistent line ending issues on macOS — prefer Composite Tree API.

### Important Record IDs (Production)

| Record                            | ID                      | Notes                     |
| --------------------------------- | ----------------------- | ------------------------- |
| RecordType `STLGS_ServiceDeskCase` | `012Tr000003l2pRIAQ`   | Service Desk case type    |
| Queue `ProServices`               | `00GTr000005KTsfMAG`    | ProServices queue         |
