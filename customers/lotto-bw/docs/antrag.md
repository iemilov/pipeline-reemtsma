# Zulassungsantrag (Request) — Domain Knowledge

> Letzte Aktualisierung: 2026-03-02 | Quellen: ~110 Jira-Stories, 5 Confluence-Seiten, 13 Flows, 10 Apex-Klassen, ~80 Custom Fields, 6 Validation Rules, 6 Quick Actions, 5 FlexiPages

## Überblick

Der Zulassungsantrag (`STLGS_Request__c`) ist der zentrale Prozess zur Eröffnung, Verlegung oder Übernahme einer Lotto-Annahmestelle (Store). Er durchläuft einen 13-stufigen Status-Lifecycle von der initialen Prüfung durch die Regionaldirektion (RD) bis zur Genehmigung durch das Regierungspräsidium (RP) und dem Vertragsabschluss.

**Akteure:**
- **RD (Regionaldirektion):** Erstellt Antrag, sammelt Dokumente, gibt frei
- **VO (Vertriebsorganisation / Zentrale):** Prüft, leitet an RP weiter, erstellt Vertrag
- **RP (Regierungspräsidium Karlsruhe):** Genehmigt oder lehnt Erlaubnis ab
- **Antragsteller:** Liefert Unterlagen (Schufa, Führungszeugnis, SEPA etc.)

**Eigenes Objekt:** `STLGS_Request__c` (MasterDetail zu Account/Store)

Siehe auch: [docs/kuendigung.md](kuendigung.md) — Außerbetriebnahme/Shutdown am Antrag, [docs/testkauf.md](testkauf.md) — TK-Kündigung erzeugt Shutdown am Antrag, [docs/filialverantwortung-wechseln.md](filialverantwortung-wechseln.md) — Wechsel Filialverantwortlicher (BranchManager) am Antrag, [docs/pflichtschulung.md](pflichtschulung.md) — Pflichtschulung bei "Geprüft durch Zentrale" (Präsenz + Online), [docs/vertragsrelevante-datenaenderung.md](vertragsrelevante-datenaenderung.md) — "Keine Inbetriebnahme" setzt Request auf "Erlaubnis erloschen".

## Geschäftsprozess

### Antragstypen (`STLGS_Type__c`)

| Wert | Beschreibung |
|------|-------------|
| Neueröffnung | Neue Annahmestelle an neuem Standort |
| Verlegung | Bestehende ASt zieht an neue Adresse um (innerhalb gleicher PLZ: kein neuer Account nötig) |
| Übernahme | Neuer Betreiber übernimmt bestehenden Standort |
| Migration | (inaktiv) Legacy-Migrationsdaten |

### Vertragsart (`STLGS_SalesType__c`)

| Wert | Beschreibung |
|------|-------------|
| Vollannahmestelle | Vollsortiment Lotto-Produkte |
| Lotto Kompakt | Eingeschränktes Sortiment |

### Natürliche vs. Juristische Person

| Aspekt | Natürliche Person | Juristische Person |
|--------|-------------------|-------------------|
| RecordType | `STLGS_StandardRequest` / `STLGS_ReadOnlyRequest` | `STLGS_BusinessRequest` / `STLGS_ReadOnlyBusinessRequest` |
| Kontakte | ASt-Leiter (`STLGS_AccountLead__c`) | Filialverantwortlicher (`STLGS_BranchManager__c`) + Geschäftsführer (`STLGS_ManagingDirector__c`) |
| Business Account | — | `STLGS_BusinessAccount__c` (GmbH/Firma als eigener Account) |
| Führungszeugnis | 1× (ASt-Leiter) | 2× (Filialverantwortlicher + Geschäftsführer BA) |
| Vertragsart-Feld | nicht am RecordType | `STLGS_ContractType__c` nur auf Business RecordType |
| Dokumente | ASt-Leitungs-Vertrag | GBV (Gewerblicher Betriebsvertrag) + Anlage 1 (Standorte) |

### Status-Lifecycle (`STLGS_Status__c`, 13 Werte)

```text
Phase 1 — RD-Bereich (editierbar):
  [1] Zusammenarbeit prüfen (Default)
  [2] Antrag vorbereiten
  [3] Freigabe Regionaldirektor
  [4] Durch ASt abgelehnt
  [5] Durch RD abgelehnt

--- RecordType-Switch: Standard/Business → ReadOnly-Variante ---
--- Flow STLGS_ConfirmRequest: Validierung + Snapshot Zielwerte ---

Phase 2 — Zentrale/RP-Bereich (read-only für RD):
  [6] An Zentrale übergeben
  [7] Geprüft durch Zentrale
  [8] Übergeben an RP
  [9] Genehmigt durch RP
  [10] Abgelehnt durch RP
  [11] Zurückgezogen

Phase 3 — Vertragsabschluss:
  [12] Vertrag abgeschlossen (Auto wenn 6 Checkboxen = true)

Phase 4 — Ende:
  [13] Erlaubnis erloschen (Shutdown/Außerbetriebnahme)
```

**Zwei-Phasen-Architektur:** Der RecordType-Switch bei "An Zentrale übergeben" ist das Kernkonzept. Phase 1 (Standard/Business RecordType) zeigt nur Status 1-5, ist editierbar durch RD. Phase 2 (ReadOnly RecordType) zeigt Status 6-13, ist read-only für RD. Jeder RecordType hat eine eigene Lightning Page (FlexiPage).

### Workflow — Neueröffnung (nat. Person)

```text
Voraussetzung: Potentielle ASt ist angelegt, Antragsbesuch erstellt

1. RD erstellt Antrag (Quick Action am Account)
   → Flow STLGS_CreateRequest: Wizard, kopiert AccountLead
   → Antragsnummer = zukünftige ASt-Nummer (6-stellig)
   → Status: "Zusammenarbeit prüfen"

2. RD erfasst Antragsdaten (idealerweise mit Antragsteller vor Ort)
   Registerkarte Details:
     → Vertragsbeginn geplant, Bewerbungsdatum
     → Regelbesteuerung oder Kleinunternehmer
     → Örtliche Gegebenheiten, Räumlichkeiten-Checkbox
     → Potenzial der ASt (prognostizierter Wochenumsatz)
     → Branche (aus Gewerbeanmeldung!)
   Registerkarte Begründung:
     → Weiterführende Begründung für Neueröffnung/Übernahme
   Registerkarte Bankdaten:
     → SEPA-Mandat (IBAN, BIC, Bankname, Kontoart)
     → Treuhandkonto Pflicht bei Wochenumsatz > 10.000€

3. RD setzt Status auf "Antrag vorbereiten"

4. RD generiert Dokumente (Registerkarte Dokumentengenerierung)
   → Erlaubnisantrag RP, Zusatzerklärung, SEPA-Mandat
   → Download/Druck → Antragsteller unterschreibt → ELO ablegen

5. RD bestätigt Dokumenten-Checkliste
   → Schufa + Führungszeugnis: Ausstellungsdatum ≤ 6 Monate
   → Gewerbeanmeldung: spätestens 4 Wochen nach Eröffnung nachreichen

6. RD gibt frei → "Freigabe Regionaldirektor"
   → Button "Freigeben" (nur für Regionaldirektoren sichtbar)
   → Flow STLGS_ConfirmRequest validiert:
     - Alle Pflichtdokumente vorhanden
     - Schufa/Führungszeugnis nicht älter als 182 Tage
     - Vertragsbeginn ≥ 6 Wochen in Zukunft (Neueröffnung) / 4 Wochen (Übernahme)
     - EU-Staatsangehörigkeit oder Aufenthaltserlaubnis
     - Treuhandkonto wenn Potenzial ≥ 10.000€
     - Bankdaten: werden als Pflicht angezeigt, RD kann aber auch ohne Bankdaten freigeben
       → Hinweis: Bankdaten müssen spätestens 4 Wochen nach Freigabe nachgereicht werden
       → Auto: Flow STLGS_CreateBankdataOnVOHandover erstellt Bankdaten-Case wenn IBAN fehlt
     - Gewerbeanmeldung: wird als Pflicht angezeigt, RD kann aber auch ohne freigeben
       → Hinweis: Gewerbeanmeldung muss spätestens 4 Wochen nach Eröffnung nachgereicht werden
   → Snapshot: Zielwerte (ASt-Anzahl Gemeinde/Landkreis/Region, Einwohner)
   → RecordType-Switch → ReadOnly
   → Status: "An Zentrale übergeben"
   → Freigabe ersetzt bisherige Unterschrift des Regionaldirektors

7. VO prüft → "Geprüft durch Zentrale"
   → Auto: Schulungs-Case wird erstellt (Flow STLGS_CreateTrainingOnGeprueft)

8. VO übergibt an RP → "Übergeben an RP"

9. RP genehmigt → "Genehmigt durch RP"
   → VO setzt 6 Vertrags-Checkboxen:
     ☐ Vertrag erstellt & versendet
     ☐ Vertrag unterschrieben zurück
     ☐ Leitung beauftragt
     ☐ Leitungstermin bestätigt
     ☐ Steuernummer vorhanden
     ☐ Gewerbeanmeldung vorhanden
   → Wenn alle 6 = true → Auto-Status "Vertrag abgeschlossen" (Flow STLGS_SetRequestToClosed)

10. Account wechselt von "Potentielle ASt" zu "Betriebsbereit"
```

### Workflow — Verlegung

Wie Neueröffnung, mit Unterschieden:
- Antrag wird von bestehender aktiver ASt aus angelegt
- Zusätzliche Felder: Vorherige Adresse (`STLGS_PreviousStreet__c`, `_PostalCode__c`, `_City__c`)
- Neue Adresse Pflicht: `STLGS_Street__c`, `STLGS_Postalcode__c`, `STLGS_City__c`
- Verlegungsdatum (`STLGS_TransferDate__c`) muss mind. 6 Wochen in der Zukunft liegen
- Bei Verlegung/Übernahme: Flow `STLGS_CopyPreviousRPFileNumber` kopiert `FileNumberRP` des vorherigen Antrags als Snapshot in `STLGS_FileNumberRPPrevious__c` (CRM-3041)
- Bei Ablehnung/Rücknahme: Flow `STLGS_RollbackLeadingRequest` stellt den vorherigen genehmigten Antrag als führenden Antrag wieder her

### Workflow — Übernahme

Wie Neueröffnung, mit Unterschieden:
- Vorgänger-ASt muss verknüpft sein (`STLGS_PredecessorStore__c`)
- Durchschnittsumsatz Vorgänger wird übernommen (`STLGS_AverageTurnoverPredecessor__c`)
- Validation: Kündigungsdatum der Vorgänger-ASt muss gesetzt sein bevor Freigabe möglich (VR `STLGS_TerminatedOnEmpty`)
- Vertragsstart-Frist: 4 Wochen (statt 6 Wochen bei Neueröffnung)

### Leading Request (Führender Antrag)

Jeder aktive Account hat genau einen **führenden Antrag** (`Account.STLGS_LeadingRequest__c`). Er bestimmt Compliance-Felder, RecordType und Vertragsdaten am Account.

**Zuweisung durch Flow** `STLGS_UpdateAccStatusOnCreateUpdateRequest` (After Save, Create+Update):

```text
Entry: Status ≠ "Erlaubnis erloschen" (OR-Logik, feuert bei fast jedem Update)
Decision: SetLeadingAt__c IS NOT BLANK?
  → JA (Pfad B): Account-Update OHNE Leading-Request-Änderung
  → NEIN (Pfad A): Account.LeadingRequest = $Record.Id
Beide Pfade → SetLeadingAt__c = NOW() + ~20 Compliance-Felder vom Request auf Account kopiert
```

**Guard-Feld** `STLGS_SetLeadingAt__c` (CRM-2775): Wird beim ersten Update gesetzt und verhindert, dass nachfolgende Updates den Leading Request erneut zuweisen. Der DateTime-Wert selbst wird nicht ausgewertet — nur `IS NOT BLANK` zählt.

**Backfill 02.03.2026:** 2.679 von 3.074 aktiven ASten (87%) hatten `SetLeadingAt__c = NULL` am Leading Request. Ohne Backfill hätte jedes beliebige Update den Request erneut als Leading gesetzt — auch wenn ein neuerer Antrag bereits Leading sein sollte.

**Rollback bei Verlegung:** Flow `STLGS_RollbackLeadingRequest` stellt bei Ablehnung/Rücknahme einer Verlegung den vorherigen genehmigten Antrag als Leading wieder her.

**Bekannte Einschränkung:** Verlegungsantrag wird bei Erstellung sofort zum Leading Request, obwohl er fachlich erst nach RP-Genehmigung + Verlegungsdatum Leading werden sollte. Die Logik dafür existiert noch nicht (Problem 1, zurückgestellt).

### Ablehnung / Abbruch

| Status | Auslöser | Pflichtfelder |
|--------|----------|---------------|
| Durch ASt abgelehnt | Antragsteller zieht zurück | `STLGS_DeclineReasons__c` + `STLGS_DeclineDate__c` |
| Durch RD abgelehnt | RD will nicht kooperieren | `STLGS_DeclineReasons__c` + `STLGS_DeclineDate__c` |
| Abgelehnt durch RP | RP verweigert Erlaubnis | — |
| Zurückgezogen | Nach Übergabe an Zentrale | — |

**Ablehnungsgründe (`STLGS_DeclineReasons__c`):** Kein Interesse, Kein Potential

**Hinweis:** Bei Abbruch muss der ASt-Status manuell auf "Keine potentielle ASt" gesetzt werden.

## Business Rules

- **Antragsnummer = 6-stellige ASt-Nummer:** VR `STLGS_ValidateNameOnUpdate` — Name muss Regex `^[0-9]{6}$` entsprechen
- **Vertragsbeginn-Frist:** VR `STLGS_ContractStartCheck` — min. 6 Wochen in Zukunft bei "An Zentrale übergeben"; VR `STLGS_ContractStartCheck2` — min. 4 Wochen (Übernahme)
- **Dokumente-Gültigkeit:** Schufa + Führungszeugnis dürfen max. 182 Tage alt sein (geprüft in `STLGS_DisplayMandatoryRequestFields`)
- **Treuhandkonto-Pflicht:** Wenn Potenzial ≥ 10.000€ → Checkbox `STLGS_HasEscrowAccount__c` muss gesetzt sein
- **Ablehnung Pflichtfelder:** VR `STLGS_MandatoryFieldsForDecline` — Gründe + Datum bei Ablehnung
- **Shutdown Pflichtfelder:** VR `STLGS_MandatoryFieldsForShutdown` — Datum + Grund bei "Erlaubnis erloschen"
- **Vorgänger-Kündigung bei Übernahme:** VR `STLGS_TerminatedOnEmpty` — Kündigungsdatum muss gesetzt sein
- **Auto-Vertrag-abgeschlossen:** Wenn Status "Genehmigt durch RP" + alle 6 Checkboxen = true → Auto-Status "Vertrag abgeschlossen" (Before-Save Flow `STLGS_SetRequestToClosed`)
- **Steuernummer-Sync:** Wenn Account-Steuernummer von leer auf Wert wechselt → `STLGS_TaxNumberAvailable__c` = true am führenden Antrag (Flow `STLGS_UpdateRequestTaxNumber`)
- **Freigabe = digitale Unterschrift:** RD-Freigabe im System ersetzt die bisherige physische Unterschrift des Regionaldirektors

## Technische Umsetzung

### Datenmodell

**Hauptobjekt:** `STLGS_Request__c` (MasterDetail → Account)

**Kern-Felder:**

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_Status__c` | Picklist | Status (13 Werte, siehe Lifecycle) |
| `STLGS_Type__c` | Picklist | Antragstyp: Neueröffnung, Verlegung, Übernahme (+ Migration inaktiv) |
| `STLGS_SalesType__c` | Picklist | Vertragsart: Vollannahmestelle, Lotto Kompakt |
| `STLGS_Store__c` | MasterDetail | Verknüpfte Annahmestelle |
| `STLGS_HasRequest__c` | Checkbox | Antrag vorhanden |

**Personen/Kontakte:**

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_AccountLead__c` | Lookup (Contact) | ASt-Leiter (nat. Person) |
| `STLGS_BranchManager__c` | Lookup (Contact) | Filialverantwortlicher (jur. Person) |
| `STLGS_ManagingDirector__c` | Lookup (Contact) | Geschäftsführer (jur. Person) |
| `STLGS_BusinessAccount__c` | Lookup (Account) | Juristische Person (Business Account) |

**Prozess-Daten:**

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_ApplicationDate__c` | Date | Bewerbungsdatum |
| `STLGS_ReceiptDate__c` | Date | Eingangsdatum |
| `STLGS_ContractStartPlanned__c` | Date | Geplanter Vertragsbeginn |
| `STLGS_SigningDate__c` | Date | Unterschriftsdatum |
| `STLGS_ApprovalDate__c` | Date | Genehmigungsdatum |
| `STLGS_ApprovalDuration__c` | Date | Genehmigungsdauer |
| `STLGS_TransferDate__c` | Date | Verlegungsdatum |
| `STLGS_DeclineDate__c` | Date | Ablehnungsdatum |
| `STLGS_DeclineReasons__c` | Picklist | Ablehnungsgrund: Kein Interesse, Kein Potential |
| `STLGS_Potential__c` | Currency | Potenzial (Wochenumsatz-Prognose) |
| `STLGS_Industry__c` | Text | Branche (aus Gewerbeanmeldung) |
| `STLGS_Reason__c` | Html | Weiterführende Begründung |

**Dokumente/Compliance-Checkliste (Checkboxen):**

| Feld (API-Name) | Beschreibung |
|-----------------|-------------|
| `STLGS_HasCriminalRecord__c` | Führungszeugnis Lizenzinhaber |
| `STLGS_HasCriminalRecordBusinessAccount__c` | Führungszeugnis Geschäftsführer (jur. Person) |
| `STLGS_HasSchufa__c` | Schufa-Auskunft |
| `STLGS_HasSEPAMandate__c` | SEPA-Mandat |
| `STLGS_HasBusinessRegistration__c` | Gewerbeanmeldung |
| `STLGS_HasBusinessRegistrationMain__c` | Gewerbeanmeldung (Hauptgewerbe ohne Lotto) |
| `STLGS_HasCommercialRegisterExtract__c` | Handelsregisterauszug |
| `STLGS_HasSitePlan__c` | Lageplan |
| `STLGS_HasEscrowAccount__c` | Treuhandkonto |
| `STLGS_HasAdditionPermission__c` | Zusatzgenehmigung |
| `STLGS_HasFurtherExplanation__c` | Weiterführende Begründung |
| `STLGS_DidHandoverDataProtectionASt__c` | Datenschutz-Unterlage übergeben |
| `STLGS_ResidencePermit__c` | Aufenthaltserlaubnis (Nicht-EU) |
| `STLGS_PermissionSelfEmplyment__c` | Erlaubnis zur Selbstständigkeit |
| `STLGS_IssueDateCriminalRecord__c` | Ausstellungsdatum Führungszeugnis (Date) |
| `STLGS_IssueDateCriminalRecordBA__c` | Ausstellungsdatum Führungszeugnis GF (Date) |
| `STLGS_DateIssueSchufa__c` | Ausstellungsdatum Schufa (Date) |

> **NP/JP-Zuordnung:** `HasSchufa__c` + `DateIssueSchufa__c` = nur NP. `HasCommercialRegisterExtract__c` = nur JP. Alle anderen (inkl. `HasSEPAMandate__c`, `HasCriminalRecordBusinessAccount__c`, `IssueDateCriminalRecordBA__c`) = NP + JP.

**Vertrags-Checkboxen (Phase "Genehmigt durch RP"):**

| Feld (API-Name) | Beschreibung |
|-----------------|-------------|
| `STLGS_ContractCreatedSent__c` | Vertrag erstellt & versendet |
| `STLGS_ContractBackSigned__c` | Vertrag unterschrieben zurück |
| `STLGS_CableRequested__c` | Leitung beauftragt |
| `STLGS_CableAppConfirmed__c` | Leitungstermin bestätigt |
| `STLGS_TaxNumberAvailable__c` | Steuernummer vorhanden |
| `STLGS_BusinessRegAvailable__c` | Gewerbeanmeldung vorhanden |

**Verlegung/Übernahme-Felder:**

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_PredecessorStore__c` | Lookup | Vorgänger-Annahmestelle |
| `STLGS_StoreNumberPredecessor__c` | Text | ASt-Nummer Vorgänger |
| `STLGS_AverageTurnoverPredecessor__c` | Currency | Durchschnittsumsatz Vorgänger |
| `STLGS_PreviousStreet__c` | Text | Bisherige Straße |
| `STLGS_PreviousPostalCode__c` | Text | Bisherige PLZ |
| `STLGS_PreviousCity__c` | Text | Bisheriger Ort |
| `STLGS_Street__c` | Text | Neue Straße |
| `STLGS_Postalcode__c` | Text | Neue PLZ |
| `STLGS_City__c` | Text | Neuer Ort |

**RP/Regulatorik:**

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_FileNumberRP__c` | Text | Aktenzeichen RP |
| `STLGS_FileNumberRPPreviousApprovalCalc__c` | Formel | Aktenzeichen RP vorherige Genehmigung (Formel: `PredecessorStore.LeadingRequest.FileNumberRP`) |
| `STLGS_FileNumberRPPrevious__c` | Text | Aktenzeichen RP vorherige Genehmigung — Snapshot (CRM-3041, CRM-2977) |
| `STLGS_ApprovalDate__c` | Date | Genehmigungsdatum RP |
| `STLGS_ReceiptDate__c` | Date | Eingangsdatum RP |
| `STLGS_ApprovalDuration__c` | Number | Genehmigungsdauer |
| `STLGS_SetLeadingAt__c` | DateTime | Guard-Feld: verhindert erneute Leading-Zuweisung bei Updates (CRM-2775) |
| `STLGS_FilenumberSince__c` | Date | Aktenzeichen seit |
| `STLGS_RemarksRP__c` | Html | Hinweise RP |
| `STLGS_StorePremises__c` | Checkbox | Räumlichkeiten-Hinweis (Spielbank, Spielhalle, Gaststätte etc.) |
| `STLGS_PremisesHint__c` | Text | Räumlichkeiten-Hinweis Text |

**Besteuerung/Finanzen:**

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_AccountType__c` | Picklist | Kontoart: Geschäftskonto, Treuhandkonto |
| `STLGS_IsStandardTaxation__c` | Checkbox | Regelbesteuerung |
| `STLGS_IsSmallBusinessOwner__c` | Checkbox | Kleinunternehmer |
| `STLGS_IsCommercialGamesAgent__c` | Checkbox | Gewerblicher Spielevermittler |
| `STLGS_IsOperatedByAgency__c` | Checkbox | Agentur-betrieben |
| `STLGS_ECCard__c` | Checkbox | EC-Karte |
| `STLGS_IloProfit__c` | Checkbox | ILO Profit |

**Zielwerte/Planung (Snapshot bei Freigabe):**

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_CountAStCounty__c` | Number | ASt-Anzahl Gemeinde IST |
| `STLGS_CountAStCountyPlus1__c` | Number | ASt-Anzahl Gemeinde +1 (PLAN) |
| `STLGS_CountAStDistrict__c` | Number | ASt-Anzahl Landkreis IST |
| `STLGS_CountAStDistrictPlus1__c` | Number | ASt-Anzahl Landkreis +1 (PLAN) |
| `STLGS_CountResidents__c` | Number | Einwohnerzahl |
| `STLGS_CountyTarget__c` | Number | Zielwert Gemeinde |
| `STLGS_DistrictTarget__c` | Number | Zielwert Landkreis |
| `STLGS_MaximalAStCount__c` | Text | Maximale ASt-Anzahl ("+2" wenn > 10.000 Einwohner) |

**Schulung/Training:**

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_PlayerProtectionTraining__c` | Date | Jugend-/Spielerschutz-Schulung |
| `STLGS_ProductTerminalTraining__c` | Date | Produkt- & Terminal-Schulung |
| `STLGS_IsELearningCompleted__c` | Checkbox | E-Learning abgeschlossen |
| `STLGS_TrainingHint__c` | Text | Schulungs-Hinweis |
| `STLGS_InitialTerminalHours__c` | Html | Initiale Terminallaufzeiten |

**Shutdown/Außerbetriebnahme** (Prozessdetails siehe [kuendigung.md](kuendigung.md), Abschnitt "Außerbetriebnahme"):

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_ShutdownDate__c` | Date | Außerbetriebnahme-Datum |
| `STLGS_ShutdownReportedToRPAt__c` | Date | Wann an RP gemeldet |
| `STLGS_ReasonShutdown__c` | Picklist | Grund: Vertragskündigung, Verlegung, Keine Inbetriebnahme |
| `STLGS_IsPredecessorTerminated__c` | Checkbox | Vorgänger-Antrag gekündigt |

**Case-Verknüpfung:**

| Feld (API-Name) | Objekt | Beschreibung |
|-----------------|--------|-------------|
| `STLGS_LeadingRequest__c` | Case | Lookup zum führenden Antrag (gesetzt via Flow `STLGS_UpdateLeadingRequestOnCase` bei Case-Erstellung) |

**Junction-Objekt: RequestContactRelation (`STLGS_RequestContactRelation__c`):**

Verknüpft Contacts mit Anträgen (JP). Backed die "Geschäftsführer"-Related-List auf der BusinessRequest FlexiPage.

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `Contact__c` | Lookup(Contact) | Verknüpfter Contact (z.B. Geschäftsführer) |
| `STLGS_Request__c` | Lookup(STLGS_Request__c) | Verknüpfter Antrag |
| `STLGS_Type__c` | Picklist | Rolle: `Managing Director` |

### Record Types

| Developer Name | Label | Editierbar | Zweck |
|---------------|-------|------------|-------|
| `STLGS_StandardRequest` | Standard Request | Ja | Nat. Person, RD-Phase (Status 1-5) |
| `STLGS_BusinessRequest` | Business Request | Ja | Jur. Person, RD-Phase (Status 1-5) |
| `STLGS_ReadOnlyRequest` | Read-Only Request | Nein | Nat. Person, Zentrale/RP-Phase (Status 6-13) |
| `STLGS_ReadOnlyBusinessRequest` | Read-Only Business Request | Nein | Jur. Person, Zentrale/RP-Phase (Status 6-13) |

### Automation

**Flows (13):**

| Flow | Typ | Zweck |
|------|-----|-------|
| `STLGS_CreateRequest` | Screen Flow | Wizard: Neuen Antrag erstellen (Verlegung/Neueröffnung/Übernahme), kopiert AccountLead/BranchManager |
| `STLGS_ConfirmRequest` | Screen Flow (Quick Action) | "Freigeben": Validiert Pflichtdokumente, snapshotttet Zielwerte, setzt Status "An Zentrale übergeben", RecordType-Switch → ReadOnly |
| `STLGS_DisplayMandatoryRequestFields` | Screen Flow (Subflow) | Validierungs-Screen: Prüft Dokumente, Schulungsdaten, EU-Staatsangehörigkeit, Treuhandkonto, Schufa/FZ-Gültigkeit (≤182 Tage) |
| `STLGS_HandoverRequest` | Screen Flow (Quick Action) | "Übergabe an": Status-Wechsel mit optionalem Chatter-Kommentar, sammelt Ablehnungsgründe |
| `STLGS_SetRequestToClosed` | Record-Triggered (Before Update) | Auto-Status "Vertrag abgeschlossen" wenn Genehmigt durch RP + alle 6 Checkboxen = true |
| `STLGS_RollbackLeadingRequest` | Record-Triggered (After Update) | Bei Ablehnung/Rücknahme einer Verlegung: stellt vorherigen genehmigten Antrag als führenden Antrag wieder her |
| `STLGS_UpdateAccStatusOnCreateUpdateRequest` | Record-Triggered (After Save) | Setzt Leading Request am Account + RecordType + ~20 Compliance-Felder. Guard-Feld `SetLeadingAt__c` verhindert erneute Zuweisung (CRM-2775) |
| `STLGS_UpdateRequestTaxNumber` | Record-Triggered (Account, After Update) | Account-Steuernummer → `STLGS_TaxNumberAvailable__c` am führenden Antrag |
| `STLGS_UpdateRequestOnStatusChange` | Record-Triggered (After Update) | Bei "Genehmigt durch RP"/"Vertrag abgeschlossen": schließt verknüpften Case, postet Chatter. Bei "Keine Inbetriebnahme": setzt Shutdown (CRM-2483) |
| `STLGS_CreateBankdataOnVOHandover` | Record-Triggered (After Update) | Bei "An Zentrale übergeben" + fehlende IBAN: erstellt Bankdaten-Case automatisch |
| `STLGS_CreateTrainingOnGeprueft` | Record-Triggered (After Save) | Bei "Geprüft durch Zentrale" + Neueröffnung/Übernahme: erstellt Schulungs-Case (Pflichtschulung JS/SP) automatisch (CRM-2568) |
| `STLGS_UpdateShutdownDateOnPreviousRequest` | Record-Triggered (After Update) | Propagiert Shutdown-Datum auf vorherigen Antrag (CRM-2439) |
| `STLGS_CopyPreviousRPFileNumber` | Record-Triggered (Before Save) | Bei Status → "An Zentrale übergeben": kopiert FileNumberRP des vorherigen Antrags als Snapshot nach `STLGS_FileNumberRPPrevious__c`. Übernahme: PredecessorStore, Verlegung: selber Store (CRM-3041, CRM-2977) |

**Apex-Klassen:**

| Klasse | Zweck |
|--------|-------|
| `STLGS_RequestConfirmationCtrlExtension` | VF Controller — Zielwert-Vergleich (Einwohner, ASt-Zahlen, Region) für Bestätigungs-Seite |
| `STLGS_RequestDocumentPDFController` | SEPA-PDF-Generierung, unterscheidet Business/Standard RecordType |
| `STLGS_GenerateContractPDFController` | (OBSOLET) Ursprünglicher Vertrags-PDF-Controller, ersetzt durch TextMergeService |
| `STLGS_PDFDocumentTemplateCntr` | Aktueller PDF-Template-Controller für Antragsdokumente |
| `STLGS_TextMergeService` | Kern-Service: Platzhalter-Merge für Dokumentgenerierung (Datumsformatierung, Tokens, Business Rules) |
| `STLGS_TextMergeLookupService` | Lookup-Service: Anrede, Store-Manager, Vertragsunterschrift-Datum, Strafen-Text |
| `STLGS_GeneratePdfCustomRelatedListCntr` | GBV-Standort-Anhang PDF (Anlage 1) für jur. Personen |
| `STLGS_AppendixGBVLocationsPDFCntr` | VF Controller für GBV-Standortliste |
| `STLGS_CoverPagePDFLegalCntr` | Deckblatt-PDF für jur. Personen (Geschäftsführer-Liste) |

**Quick Actions (6):**

| Action | Typ | Zweck |
|--------|-----|-------|
| `STLGS_ConfirmRequest` | Flow | "Freigeben" — Validierung + Übergabe an Zentrale |
| `STLGS_Handover` | Flow | "Übergabe an" — Status-Wechsel mit Kommentar |
| `STLGS_UpdateRequest` | Update | Standard-Antrag editieren (minimal) |
| `STLGS_UpdateBusinessRequest` | Update | Business-Antrag editieren |
| `STLGS_UpdateRequestExtension` | Update | Antrag editieren (Extension-Version mit mehr Feldern) |
| `STLGS_ReadRequestExtension` | Update | Antrag read-only anzeigen (Extension) |

**Validation Rules (6):**

| Rule | Objekt | Zweck |
|------|--------|-------|
| `STLGS_ContractStartCheck` | Request | Geplanter Vertragsbeginn ≥ 6 Wochen bei Übergabe (bei Verlegung: prüft `TransferDate__c` statt `ContractStartPlanned__c`) |
| `STLGS_ContractStartCheck2` | Request | Geplanter Vertragsbeginn ≥ 4 Wochen bei Übergabe (bei Verlegung: prüft `TransferDate__c` statt `ContractStartPlanned__c`) |
| `STLGS_MandatoryFieldsForDecline` | Request | Ablehnungsgrund + Datum Pflicht bei Ablehnung |
| `STLGS_MandatoryFieldsForShutdown` | Request | Shutdown-Datum + Grund Pflicht bei "Erlaubnis erloschen" |
| `STLGS_TerminatedOnEmpty` | Request | Vorgänger-Kündigungsdatum Pflicht bei Übernahme |
| `STLGS_ValidateNameOnUpdate` | Request | Antragsnummer = exakt 6 Ziffern |

**FlexiPages (5):**

| Page | RecordType |
|------|-----------|
| `STLGS_RequestRecordPage` | StandardRequest |
| `STLGS_BusinessRequestRecordPage` | BusinessRequest |
| `STLGS_ReadOnlyRequestRecordPage` | ReadOnlyRequest |
| `STLGS_ReadOnlyBusinessRequestRecordPage` | ReadOnlyBusinessRequest |
| `STLG_StandardApiRequestRecordPage` | System/API-Zugriff |

### Integrationen

- **ELO (Dokumentenmanagement):** Generierte Dokumente (Erlaubnisantrag, SEPA, Vertrag) werden in ELO archiviert. Kein API-Sync — manueller Upload-Prozess.
- **RP Karlsruhe:** Erlaubnisantrag wird als PDF generiert und physisch eingereicht. Kein elektronischer Datenfluss.
- **Schulungs-System:** Auto-Erstellung Schulungs-Case bei "Geprüft durch Zentrale" (→ siehe Schulungs-Prozess).
- **Bankdaten:** Auto-Erstellung Bankdaten-Case bei fehlender IBAN (→ siehe Bankdaten-Prozess).

### Dokumente/PDFs

**Nat. Person — Neueröffnung:**
- Erlaubnisantrag RP (CRM-290)
- Zusatzerklärung Erlaubnisantrag
- SEPA-Basislastschrift (Core)-Mandat
- Treuhandkonto-Formular (3-fach, wenn > 10.000€)

**Nat. Person — Verlegung/Übernahme:**
- Erlaubnisantrag RP Verlegung/Übernahme (CRM-320, CRM-331)
- Annahmestellen-Antrag Verlegung (CRM-326)

**Jur. Person:**
- Erlaubnisantrag RP jur. Person (CRM-323)
- GBV (Gewerblicher Betriebsvertrag) — Lotto / Lotto-Kompakt
- Anlage 1 Standorte (CRM-2197)
- Begleitschreiben zum GBV und Anlage 1 (CRM-2428)
- Deckblatt jur. Person (Geschäftsführer-Liste)

**Verlängerung:**
- Erlaubnisantrag Verlängerung nat. Person (CRM-140)
- Erlaubnisantrag Verlängerung jur. Person (CRM-880)

## Konfiguration

- **Bypass:** `$Setup.STLG_BypassSwitch__c.STLG_ValidationRuleSwitch__c` — deaktiviert alle STLGS-Validation Rules (inkl. Request-VRs)
- **RecordType-Assignment:** `STLGS_StandardRequest` / `STLGS_BusinessRequest` für RD-Phase, `STLGS_ReadOnlyRequest` / `STLGS_ReadOnlyBusinessRequest` für Zentrale/RP-Phase. Switch via Flow `STLGS_ConfirmRequest`.
- **CMT `STLG_SalesforceUrl__mdt`:** Dynamische Org-URL für Flow-Navigations-Links (Toast-Messages etc.)
- **Quick Action Sichtbarkeit:** `STLGS_ConfirmRequest` nur sichtbar für Regionaldirektoren (Profil-basiert), `STLGS_Handover` für VO-Profile
- **FlexiPage-Zuordnung:** Jeder RecordType hat eine eigene Lightning Page (5 insgesamt, siehe FlexiPages-Tabelle)

## Bekannte Probleme & Workarounds

### Zwei Antragsnummern-Problematik

Antragsnummer = Account-Name = 6-stellige ASt-Nummer. Wenn die Nummer nachträglich geändert wird, muss auch die ELO-Akten-Nummer manuell angepasst werden. Kein automatischer Sync.

### Führender Antrag aktualisiert sich nicht

Das Feld "Führender Antrag" am Account aktualisiert sich nach Änderungen erst nach Page-Reload (CRM-335). UI-Refresh-Problem.

### Aktenzeichen RP bei Verlegung (CRM-3041, CRM-2977 — deployed + backfilled 02.03.2026)

Das Formelfeld `STLGS_FileNumberRPPreviousApprovalCalc__c` (`PredecessorStore.LeadingRequest.FileNumberRP`) zeigt nach einer Verlegung den falschen Wert, weil der LeadingRequest-Pointer am Account auf den neuen Antrag wechselt. Bei Verlegung ist das Feld immer NULL (kein PredecessorStore). Zusätzlich: bei **14 von 21 VL (67%)** zeigt das Calc-Feld eine Selbstreferenz (eigenes AZ statt Vorgänger-AZ), weil der VL-Antrag selbst Leading geworden ist.

**Fix V1 (CRM-3041):** Snapshot-Feld `STLGS_FileNumberRPPrevious__c` + Before-Save Flow. Trigger: `FileNumberRP__c IsChanged` → zu spät (erst nach RP-Genehmigung).
**Fix V2 (CRM-2977, deployed 02.03.2026):** Trigger geändert auf `Status = "An Zentrale übergeben"` → Snapshot wird beim Übergabe-Zeitpunkt erstellt (früher, VO hat den Wert sofort).
**Backfill (02.03.2026):** 368 bestehende VL/ÜN-Requests (341 ÜN + 27 VL) per Apex-Script nachgefüllt — repliziert die exakte Flow-Logik (ÜN: PredecessorStore, VL: selber Store mit `Id != $Record.Id`). Backup-CSVs in `business/docs/FileNumberRP/`.
**Geplant:** Screen Flow für nachträgliches Nachtragen — Button auf VL/ÜN-Request zeigt Vorgänger-Requests, VO kann AZ kopieren/eingeben.

### Fehlende Validierung bei Besteuerung

Entweder Regelbesteuerung ODER Kleinunternehmer muss gesetzt sein — aber die Validierung lässt zu, dass keines oder beides gesetzt wird.

### Gewerbeanmeldung-Nachreichung

Gewerbeanmeldung kann bei Übergabe an Zentrale fehlen und muss spätestens 4 Wochen nach Eröffnung nachgereicht werden. Kein automatisches Monitoring/Erinnerung.

## Referenzen

### Jira

**Antrag-Grundlagen & Layout:**
- **CRM-187:** Requests übersetzen in Anträge
- **CRM-189:** Antrag — Felder entfernen
- **CRM-205:** Anlage antragsrelevanter Felder
- **CRM-207:** Request Name = Antrags-Nr.
- **CRM-216:** Kontakt-Details Antragsteller am Antrag
- **CRM-229:** Anzahl aktive ASten am Antrag
- **CRM-295:** Neues Feld am Antrag: Branche
- **CRM-296:** Neues Feld Antrag: Aktenzeichen vom
- **CRM-297:** Neues Feld Antrag: Dauer der Genehmigung
- **CRM-298:** Neuer Status Antrag: Abgelehnt durch RP
- **CRM-299:** Neues Feld am Antrag: Eingangsdatum
- **CRM-322:** Neues Feld Antrag: Hinweise RP
- **CRM-332:** Zielwerte am Antrag — PLAN
- **CRM-818:** Neues Formelfeld am Account — Branche vom Antrag

**Nat. Person:**
- **CRM-197:** ASt-Leiter aus Antrag in Store anzeigen
- **CRM-399:** Antrag Contact (License Owner) bearbeitbar durch RD
- **CRM-983:** Email (Geschäftlich) als Pflichtfeld für Antrag

**Jur. Person:**
- **CRM-237:** Jur. Person kann nicht zum Antrag hinzugefügt werden
- **CRM-238:** Antrag jur. Person — zwei Führungszeugnisse
- **CRM-245:** Antrag jur. Person
- **CRM-267:** Neuer Ansprechpartner bei Antrag juristische Person
- **CRM-269:** Antrag jur. Person — Checkboxen
- **CRM-275:** Antrag juristische Person
- **CRM-913:** Antrag jur. Person — Treuhandkonto in Validierung anzeigen
- **CRM-967:** Antrag jur. Person — Freigabe Übernahme nicht möglich
- **CRM-1012:** Antrag Übernahme jur. Person kann nicht freigegeben werden

**Verlegung:**
- **CRM-3041:** Aktenzeichen RP bei Verlegung — Snapshot-Feld + Before-Save Flow
- **CRM-224:** Anschrift nur bei Antragsart "Verlegung" anzeigen
- **CRM-243:** Antrag Verlegung — Account bleibt read-only
- **CRM-314:** Aktive ASt — neuer Antrag nur Typ Verlegung
- **CRM-318:** Neuer Antrag über Button — Picklist Type Verlegung
- **CRM-319:** Neuer Antrag Verlegung — Antragsteller/Nr. aus ASt nehmen
- **CRM-325:** Antrag Verlegung — Bankdaten read-only für RD

**Übernahme:**
- **CRM-246:** Antragsart Übernahme — Vorgänger ASt
- **CRM-924:** Antrag Übernahme: Umsatz Vorgänger bei Übergabe an VO
- **CRM-935:** Antrag Verlegung: Umsatz ASt bei Übergabe an VO
- **CRM-988:** Antrag Übernahme — Umsatz Vorgänger
- **CRM-1245:** Historie Vorgänger ASt bei Übernahme

**Status & Workflow:**
- **CRM-226:** Antrag — Grund der Absage
- **CRM-240:** Antrag — Übergabe an
- **CRM-242:** Ablehnung Antrag kann nicht gespeichert werden
- **CRM-273:** Button neuer Antrag muss immer auswählbar sein
- **CRM-309:** Filialverantwortlich — read-only ab "An Zentrale übergeben"
- **CRM-1263:** Validierung Antrag — frühestmöglicher geplanter Vertragstart
- **CRM-1269:** Antrag automatisch auf Vertrag abgeschlossen
- **CRM-1301:** UAT2: Antrag kann nicht mehr ohne Antragsnummer angelegt werden

**Dokumente / Erlaubnisantrag:**
- **CRM-140:** Dokument Erlaubnisantrag Verlängerung
- **CRM-155:** Antrag RP — Dokumente gesammelt ausgeben
- **CRM-276:** Dokument nat. Person — Antrag
- **CRM-279:** Automatisches Laden bei Dokumentengenerierung
- **CRM-281:** Dokument jur. Person — Antrag
- **CRM-289:** Einwilligung Internet als Teil des ASt-Antrags
- **CRM-290:** Dokument Erlaubnisantrag RP nat. Person
- **CRM-308:** Aktenzeichen RP bisherige Genehmigung
- **CRM-310:** Dokument jur. Person Antrag — Fix
- **CRM-320:** Dokument Erlaubnisantrag RP nat. Person Verlegung/Übernahme
- **CRM-321:** Erlaubnisantrag erzeugen
- **CRM-323:** Dokument Erlaubnisantrag RP jur. Person
- **CRM-324:** Dokument Erlaubnisantrag RP
- **CRM-326:** Dokument Annahmestellen-Antrag Verlegung
- **CRM-331:** Dokument Erlaubnisantrag Verlegung
- **CRM-880:** Dokument Erlaubnisantrag Verlängerung jur. Person
- **CRM-893:** Dokument Erlaubnisantrag Verlängerung
- **CRM-2128:** Antrag Dokument Erlaubnisantrag — Anpassung Räumlichkeiten

**Bankdaten & Finanzen:**
- **CRM-263:** Bankdaten aus Account im Antrag anzeigen/bearbeitbar
- **CRM-274:** Potenzial > 10.000 → Checkbox Treuhandkonto
- **CRM-940:** Bankdaten können mobil nicht geändert werden

**Sonstiges:**
- **CRM-145:** Am Case führender Antrag, ASt-Leiter und Account einblenden
- **CRM-160:** Field History Antrag
- **CRM-210:** Vertragsart aus Antrag als Lookup an ASt anzeigen
- **CRM-218:** Aktive ASt — führender Antrag unter Vertragsrelevant
- **CRM-821:** Skyvva Schnittstelle Uberall "PublishStoreData-Request"
- **CRM-886:** Mobiles Arbeiten — Übersichtliche Kombinationsliste
- **CRM-1294:** Bericht: Accounts und führender Antrag — Felder bearbeiten
- **CRM-1339:** Prüfbericht — Gewerbeanmeldung vom Antrag
- **CRM-2483:** Status-Change Automation (Genehmigt → Case schließen)
- **CRM-2568:** Auto-Schulung bei "Geprüft durch Zentrale"

### Confluence

- **Antrag natürliche Person anlegen** (PM23SFV Space, Page 1502808445) — Endanwender-Dokumentation mit vollständigem Workflow (Screenshots)
- **Antrag juristische Person anlegen** (PM23SFV Space, Page 1502809423) — Endanwender-Doku mit Business Account + Filialverantwortlicher/GF
- **Datenobjekt Antrag** (Page 809041921) — Pflichtenheft: alle Felder, Status-Werte, Validierungen pro Antragstyp
- **Validierung Antrag** (Page 931790855) — Validierungsmatrix: welche Felder für welchen Antragstyp/Status geprüft werden
- **Fehler Validierung Antrag** (Page 928677891) — Bug-Tracking der Validierungs-Screens (Reihenfolge, fehlende Felder, Edge Cases)

### Codebase

**Request Object:** `force-app/main/default/objects/STLGS_Request__c/` (~80 Fields, 4 RecordTypes, 6 VR)
**Flows:** `force-app/main/default/flows/STLGS_*Request*`, `STLGS_Confirm*`, `STLGS_Handover*`, `STLGS_Create*Training*`, `STLGS_Create*Bankdata*`, `STLGS_Rollback*`, `STLGS_SetRequestToClosed`, `STLGS_Display*`, `STLGS_CopyPreviousRPFileNumber` (13 Flows)
**Apex:** `force-app/main/default/classes/STLGS_Request*`, `STLGS_*PDF*`, `STLGS_TextMerge*` (~10 Klassen)
**Quick Actions:** `force-app/main/default/quickActions/STLGS_Request__c.*` (6 Actions)
**FlexiPages:** `force-app/main/default/flexipages/STLGS_*Request*` (5 Pages)
**Case Lookup:** `force-app/main/default/objects/Case/fields/STLGS_LeadingRequest__c.field-meta.xml`

## Änderungshistorie

| Datum | Änderung | Quelle |
|-------|----------|--------|
| 2026-02-20 | Initiale Erstellung | Codebase-Analyse (~80 Fields, 12 Flows, 6 VR, 6 QA, 10 Apex, 4 RecordTypes, 5 FlexiPages), ~110 Jira-Stories, 5 Confluence-Seiten |
| 2026-02-20 | Cross-Reference ergänzt | Verweis auf pflichtschulung.md |
| 2026-02-20 | Cross-Reference ergänzt | Verweis auf vertragsrelevante-datenaenderung.md |
| 2026-02-26 | CRM-3041 ergänzt | Neues Feld `STLGS_FileNumberRPPrevious__c`, Flow `STLGS_CopyPreviousRPFileNumber`, Verlegung-Pflichtfelder (Adresse, TransferDate) |
| 2026-03-02 | CRM-2977 deployed + Backfill | Flow-Trigger geändert (Status → "An Zentrale übergeben"), 368 bestehende VL/ÜN-Requests backfilled (341 ÜN + 27 VL), VL-Selbstreferenz im Calc-Feld dokumentiert |
