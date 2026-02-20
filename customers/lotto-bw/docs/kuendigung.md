# Kündigung & Außerbetriebnahme — Domain Knowledge

> Letzte Aktualisierung: 2026-02-20 | Quellen: ~51 Jira-Stories, 3 Confluence-Seiten, 9 Flows, 4 Apex-Klassen, 22 Custom Fields, 7 Validation Rules, 3 Quick Actions, 1 VF Page

## Überblick

Die Kündigung ist der Prozess zur Beendigung des Vertragsverhältnisses zwischen Lotto BW und einer Annahmestelle (Store). Es gibt zwei Richtungen: ASt-initiiert (Annahmestelle kündigt) und STLG-initiiert (Lotto kündigt). Die Kündigung wird als Case mit Typ "Kündigung" im B2B-Bereich verwaltet. Akteure sind die Regionaldirektion (RD) als Ersteller bei ASt-Kündigungen, die Vertriebsorganisation (VO) als Ersteller bei STLG-Kündigungen und als abschließende Instanz, sowie das Regierungspräsidium (RP) als Meldungsempfänger bei Außerbetriebnahme. Die Außerbetriebnahme ist der nachgelagerte regulatorische Prozess, bei dem die Erlaubnis offiziell erlischt.

Siehe auch: [docs/testkauf.md](testkauf.md) — TK-Ampelstatus "geschlossen" löst automatisch Kündigung aus, [docs/service-desk.md](service-desk.md) — SD-Cases für technische Probleme (gleiche Accounts, anderer RecordType), [docs/ruecklastschrift.md](ruecklastschrift.md) — Rücklastschrift-Prozess (Zahlungsschwierigkeiten als möglicher Kündigungsgrund), [docs/vertragsrelevante-datenaenderung.md](vertragsrelevante-datenaenderung.md) — Anliegen-Typ "Kündigung durch Lotto veranlassen".

## Geschäftsprozess

### Event-basiertes Kündigungsmodell (CRM-2610)

**IST (alt):** Für jede Änderung am Kündigungsvorgang (Verschiebung, Rücknahme) wurde ein separater Case mit eigenem `STLGS_TerminationType__c` erstellt. Dadurch war oft unklar, was das aktuelle Kündigungsdatum ist.

**SOLL (aktuell):** Es gibt nur EINEN Kündigungsvorgang pro Kündigung. Änderungen werden über Quick Actions als Events (`STLGS_Event__c`) am Case erzeugt — auch wenn der Case bereits "In Bearbeitung VO" ist und für die RD schreibgeschützt. Die VO wird per Chatter-Post über Updates informiert.

**Event-Typen:**

| Event-Typ | Auslöser | Wirkung |
|-----------|----------|---------|
| Kündigung | Auto bei Case-Erstellung | Initiales Event, dokumentiert Anlage |
| Erfolgt früher | Quick Action durch RD | Aktualisiert Kündigungsdatum (vorgezogen) |
| Erfolgt später | Quick Action durch RD | Aktualisiert Kündigungsdatum (verschoben) |
| Rücknahme | Quick Action durch RD | Kündigung wird zurückgenommen |

Bei jedem Event werden die Felder `STLGS_GeneralDescription__c`, `STLGS_TerminatedAt__c`, `STLGS_TerminationLetterDate__c` und `STLGS_IsTerminationElo__c` erfasst. Validation: Alle Felder müssen gesetzt sein, damit das Event gespeichert werden kann.

**Hinweis:** `STLGS_TerminationType__c` wird bei Case-Erstellung automatisch auf "Kündigung" gesetzt. Bei Events über "Kündigung anpassen" darf der Typ NICHT "Kündigung" sein (nur Erfolgt früher/später/Rücknahme) — CRM-2716.

### Kündigungstypen (`STLGS_TerminationType__c`)

| Wert | Beschreibung |
|------|-------------|
| Kündigung | Standard-Kündigung (Default bei Erstellung) |
| Rücknahme der Kündigung | Kündigung wird zurückgenommen |
| Kündigung erfolgt früher | Terminanpassung (vorgezogen) |
| Kündigung erfolgt später | Terminanpassung (verschoben) |

### Kündigungsrichtung (`STLGS_TerminatedBy__c`)

| Wert | Beschreibung | Ersteller |
|------|-------------|-----------|
| Annahmestelle | ASt-initiiert (Store kündigt selbst) | RD |
| Lotto | STLG-initiiert (Lotto kündigt) | VO |

### Kündigungsgründe (`STLGS_TerminationReason__c`)

19 Picklist-Werte, ergänzt durch Freitext in `STLGS_GeneralDescription__c`:

| Wert | Kategorie |
|------|-----------|
| Geschäftsaufgabe - Alter | ASt-initiiert |
| Geschäftsaufgabe - Mietverhältnis | ASt-initiiert |
| Geschäftsaufgabe - wirtsch. Gründe | ASt-initiiert |
| Geschäftsaufgabe - Sonstiges | ASt-initiiert |
| Geschäftsübergabe | ASt-initiiert |
| Keine weitere Zusammenarbeit mit Lotto | ASt-initiiert |
| Ende Pacht-/Franchiseverhältnis | ASt-initiiert |
| Wechsel der Vertragsart | ASt-initiiert |
| Wechsel auf jur. Person | ASt-initiiert |
| Fristl. Kündigung - nicht mehr tätig | STLG-initiiert |
| Fristl. Kündigung - Zahlungsschwierigkeiten | STLG-initiiert |
| Fristl. Kündigung - Sonstiges | STLG-initiiert |
| Fristl. Kündigung Insolvenz | STLG-initiiert |
| Fristlose Kündigung - Strafverfahren | STLG-initiiert |
| Kündigung wg. Testkauf – Jugendschutz | STLG-initiiert (TK) |
| Kündigung wg. Testkauf – Spielerschutz | STLG-initiiert (TK) |
| Probezeit | STLG-initiiert |
| keine Lizenzverlängerung | STLG-initiiert |
| Sonstiges | Beide |

### Workflow — ASt-Kündigung (RD erstellt)

```text
RD erstellt Kündigung (Quick Action am Account)
  → Auto: Event "Kündigung" wird erstellt (CRM-2716)
  → Auto: STLGS_TerminationType__c = "Kündigung" (Preset)
  → RD füllt aus: Grund, Datum, Leitung-Status, Beschreibung
    → RD kann via "Kündigung anpassen" editieren (Quick Action)
      → Bleibt in "In Bearbeitung RD" (CRM-2758)
    → RD → "Übergeben an VO"
      → VR: STLGS_ValidateTerminationLetterDate (Briefdatum Pflicht)
      → VR: STLGS_TerminationMandatoryFields (ELO-Checkbox Pflicht bei Lotto-Kündigung)
      → Validation: TerminatedAt, TerminationLetterDate, TerminationReason, IsTerminationElo müssen gesetzt sein
      → STLGS_TerminateLine__c ist NICHT Pflicht bei VO-erstellten Cases (CRM-2742)
    → VO setzt Kündigungsdatum am Account (Quick Action)
      → Flow STLGS_AccountTerminatedBy synct TerminatedBy Case→Account
      → Flow STLGS_UpdateShutdownDateOnRequest synct Datum→Request
    → VO erstellt Kündigungsbestätigung (Dokumentengenerierung)
    → VO handhabt Leitung-Status
    → VO schließt Case
      → VR: STLGS_TerminationClosedMandatoryFields (Leitungsdisposition Pflicht)
  → Bei Terminänderung: RD nutzt Quick Action "Erfolgt früher"/"Erfolgt später"
    → Neues Event wird erstellt, Chatter-Post an VO
  → Bei Rücknahme: RD nutzt Quick Action "Rücknahme"
```

### Workflow — STLG-Kündigung (VO erstellt)

```text
VO erstellt Kündigung + setzt Kündigungsdatum am Account
  → Auto: Event "Kündigung" wird erstellt
  → Case geht an RD mit Status "Neu" (NICHT "Übergeben an RD"!) (CRM-2918)
  → VO erstellt Kündigungsbrief (Quicktext-basiert, siehe Dokumentvorlagen)
  → RD ergänzt: Möbelgeld, Leitung-Status, Beschreibung
    → RD kann Kündigungstyp NICHT ändern bei Lotto-Kündigungen (CRM-2779)
    → RD "Kündigung anpassen": bleibt in "In Bearbeitung RD" (CRM-2758)
    → RD → "Übergeben an VO" (expliziter Button-Klick erforderlich)
      → Flow STLGS_ResetTerminationOnRDChange (Status-Reset, Counter++)
  → VO schließt Case
  → Duplikate: Wenn RD zusätzlichen Kündigungsvorgang erstellt hat → VO prüft und schließt Duplikat (CRM-2918)
```

### TK-initiierte Kündigung (automatisch)

Wenn der TK-Ampelstatus auf `geschlossen` wechselt, wird automatisch ein untergeordneter Vorgang "TK Schließung" erstellt. Dieser triggert den Kündigungsprozess. Bei juristischen Personen kommt vorher eine "TK Sperrung" (4 Wochen Betriebssperre) — nur wenn auch die Sperrung nicht bestanden wird, folgt die Kündigung.

### Leitungslogik (kritische Business Rule)

Zwei Felder steuern die Leitungsdisposition:

**`STLGS_TerminateLine__c` (User-editierbar, 2 Werte):**

| Wert | Bedeutung |
|------|-----------|
| Leitung wird nicht mehr benötigt | Leitung sofort kündigen |
| Leitung wird ggf. weiter benötigt | Evtl. Übernahme, 4 Wochen abwarten |

**`STLGS_Line__c` (abgeleitetes Feld, 3 Werte):**

| Wert | Ableitung |
|------|-----------|
| Leitung wird nicht mehr benötigt | `STLGS_TerminateLine__c` = "wird nicht mehr benötigt" |
| Leitung offen lassen | `STLGS_TerminateLine__c` = "wird ggf. weiter benötigt" UND noch innerhalb 4-Wochen-Frist |
| Leitung wird weiter benötigt | Nachfolger-Store hat offenen Übernahme-Antrag (`Account.STLGS_SuccessorStore__r.STLGS_LeadingRequest__c` ist nicht leer) |

**Automatische Übergänge:**
- "Keine Nachfolge" → automatisch `STLGS_TerminateLine__c` = "wird nicht mehr benötigt"
- 28 Tage nach Status "Übergeben an VO" + kein LeadingRequest → automatisch "wird nicht mehr benötigt"
- VO schließt Kündigung typischerweise erst wenn Übernahme-Antrag Status "Geprüft durch Zentrale" erreicht
- Flow `STLGS_CaseTerminateLine` handhabt die Leitungslogik (CRM-2774)

**Nachfolge (`STLGS_SuccessionThrough__c`, 4 Werte):**

| Wert | Leitungs-Auswirkung |
|------|---------------------|
| Übernahme | Leitung wird ggf. weiter benötigt |
| Neueröffnung | Leitung wird nicht mehr benötigt (neue Leitung) |
| Keine Nachfolge | Leitung wird nicht mehr benötigt |
| Nachfolge offen | Leitung wird ggf. weiter benötigt |

### Außerbetriebnahme (nachgelagerter Prozess)

Die Außerbetriebnahme ist der regulatorische Schritt nach Abschluss der Kündigung. Sie wird über das `STLGS_Request__c`-Objekt (Antrag) verwaltet.

**Picklist `STLGS_ReasonShutdown__c` (3 Werte):**

| Picklist-Wert | Auslöser | Prozess |
|---------------|----------|---------|
| **Vertragskündigung** | Kündigung abgeschlossen | Account: Betriebsbereit → Geschlossen, VO meldet an RP |
| **Verlegung** | Umzug an neue Adresse | Alter Antrag → Erlaubnis erloschen wenn neuer "Genehmigt durch RP" |
| **Keine Inbetriebnahme** | Antrag zurückgezogen vor Start | Vorgang "Vertragsrel. Daten ändern" → Anliegen "Keine Inbetriebnahme" |

**Sonderfall Übernahme** (kein eigener Picklist-Wert): Neuer Betreiber übernimmt → alter Standort geschlossen, neuer Antrag für Nachfolger. Ergibt sich aus dem Übernahme-Antrag, nicht über `STLGS_ReasonShutdown__c`.

**Endstatus Account:** `Erlaubnis erloschen`

**Regulatory Reporting:**
- VO erstellt "Meldung Außerbetriebnahme und Erlöschen einer erteilten Erlaubnis" (VF Page: `STLGS_PDFDocumentAusserbetriebnahme`)
- Dokument geht an Regierungspräsidium Karlsruhe
- Flow `STLGS_CheckOnShutdown` monitort ob Shutdown-Datum erreicht ist und aktualisiert Request-Status (CRM-2470)

### Dokumentvorlagen (Quicktexts)

Kündigungsbriefe werden über Quicktext-Vorlagen generiert. Die Generierung erfolgt über den Vertragsabschluss-Tab am Antrag.

**Natürliche Person:**

| Template-ID | Anlass | Rechtsgrundlage | Jira |
|-------------|--------|-----------------|------|
| T023 | ASt-Leitung nicht mehr tätig | §1 Abs. 4 ASt-Leiter-Vertrag | CRM-2557 |
| T024 | Strafverfahren | §22 Abs. 2 d) ASt-Leiter-Vertrag | CRM-2672 |
| T025 | Zahlungsschwierigkeiten | §22 Abs. 2 a) ASt-Leiter-Vertrag | CRM-2457 |
| T026 | Insolvenz | — | CRM-2555 |
| T033 | Rücknahme der Kündigung | — | CRM-2673 |
| T042 | Probezeit | — | CRM-2556 |
| — | Kündigungsbestätigung (bis 1 Jahr / bis 10 Jahre / ab 10 Jahre / über 25 Jahre) | — | CRM-2216 |
| — | Kündigung erfolgt früher | — | CRM-2558 |
| — | Kündigung erfolgt später | — | CRM-2559 |

**Juristische Person:**

| Template-ID | Anlass | Jira |
|-------------|--------|------|
| — | Kündigung Standort — Auflösung Standort + aktualisierte Anlage 1 | CRM-2543 |
| — | Kündigung GBV — Kündigungsbestätigung GBV + Auflösung Standort | CRM-2551 |
| — | Kündigung Standort Testkauf (Lotto) + aktualisierte Anlage 1 | CRM-2060 |
| — | Kündigungsbestätigung (Kündigung Standort) | CRM-2212 |

**TK-Kündigungsbriefe (4 Varianten):**

| Variante | Quicktext-ID | Jira |
|----------|-------------|------|
| nat. Person — Kündigung TK Jugendschutz | 00600611 | CRM-2754 |
| nat. Person — Kündigung TK Spielerschutz | 00600613 | CRM-2755 |
| jur. Person — Kündigung TK Jugendschutz | 00555879 | CRM-2756 |
| jur. Person — Kündigung TK Spielerschutz | 00555861 | CRM-2757 |

**Hinweis:** Vorlagen referenzieren den ASt-Leitungs-Vertrag mit verallgemeinertem Wortlaut, da Vertragsversionen zwischen Lotto Kompakt, Vollannahmestelle und älteren Verträgen variieren. User können Text im Editor anpassen.

## Business Rules

- **Kündigungsdatum muss Samstag sein** (Ende einer Abrechnungsperiode) — `STLGS_TerminatedAt__c`
- **Briefdatum Pflicht bei Übergabe:** VR `STLGS_ValidateTerminationLetterDate` — Briefdatum muss gesetzt sein beim Wechsel auf "Übergeben an VO"
- **ELO-Archivierung Pflicht:** VR `STLGS_TerminationMandatoryFields` — ELO-Checkbox (`STLGS_IsTerminationElo__c`) muss vor Übergabe an VO/RD gesetzt sein (nur bei Lotto-Kündigungen für RD-Übergabe)
- **Leitungsdisposition vor Schließung:** VR `STLGS_TerminationClosedMandatoryFields` — Leitung-Status muss bestätigt sein bevor Case geschlossen werden kann
- **Shutdown-Pflichtfelder:** VR `STLGS_MandatoryFieldsForShutdown` — Shutdown-Datum und -Grund müssen gesetzt sein bevor Request auf "Erlaubnis erloschen" gesetzt werden kann
- **Störung blockiert Schließung:** VR `STLGS_PreventClosureOnDisruption` — Case kann nicht geschlossen werden wenn eine Vollstörung aktiv ist
- **4-Wochen-Frist Leitungsübernahme:** Wenn nach 4 Wochen kein Übernahme-Antrag vorliegt → Leitung wechselt automatisch auf "wird nicht mehr benötigt"
- **RD-Änderungen setzen Status zurück:** Flow `STLGS_ResetTerminationOnRDChange` setzt Status auf "Übergeben an VO" zurück und zählt Handover-Counter hoch (CRM-2949)
- **RD "Kündigung anpassen" bleibt in "In Bearbeitung RD":** Wenn Status "In Bearbeitung RD" ist und RD über Quick Action "Kündigung anpassen" editiert, darf KEIN automatischer Statuswechsel auf "Übergeben an VO" stattfinden. Nur expliziter Button-Klick löst Handover aus (CRM-2758)
- **RD darf Kündigungstyp bei Lotto-Kündigungen nicht ändern:** Bei "Kündigung durch Lotto" ist `STLGS_TerminationType__c` für RD read-only (CRM-2779)
- **Wiedervorlage für RD:** RD kann `STLG_FollowupDate__c` (Wiedervorlage am) sowohl bei Erstellung als auch bei Bearbeitung setzen (CRM-2746)
- **VO-Beschreibungsänderung erzeugt Verlaufs-Eintrag:** Wenn VO `STLGS_GeneralDescription__c` aktualisiert, wird automatisch ein neuer Eintrag im Kündigungsverlauf erstellt (CRM-2747)
- **Chatter-Benachrichtigung:** Bei "Kündigung durch Lotto" wird KEINE Chatter-Benachrichtigung an VO bei RD-Änderungen gesendet — nur bei Events (CRM-2743)

## Technische Umsetzung

### Datenmodell

**Hauptobjekt:** Case (Typ: `Kündigung` via `STLGS_Type__c`)

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_TerminationType__c` | Picklist | Art: Kündigung, Rücknahme, früher/später |
| `STLGS_TerminatedBy__c` | Picklist | Initiator: Lotto oder Annahmestelle |
| `STLGS_TerminatedAt__c` | Date | Kündigungsdatum (muss Samstag sein) |
| `STLGS_TerminatedOnCalculated__c` | Formula | Zieht `Account.STLGS_TerminatedOn__c` |
| `STLGS_TerminationLetterDate__c` | Date | Datum des Kündigungsschreibens |
| `STLGS_TerminationReason__c` | Picklist | Kündigungsgrund (19 Werte, siehe Abschnitt Kündigungsgründe) |
| `STLGS_IsTerminationElo__c` | Checkbox | In ELO archiviert |
| `STLGS_TerminateLine__c` | Picklist | Leitungsdisposition — 2 Werte: "Leitung wird nicht mehr benötigt", "Leitung wird ggf. weiter benötigt" |
| `STLGS_Line__c` | Picklist | Abgeleiteter Leitungsstatus — 3 Werte: "Leitung wird weiter benötigt", "Leitung wird nicht mehr benötigt", "Leitung offen lassen" |
| `STLGS_TerminateLineVO__c` | Checkbox | Leitungskündigung via VO |
| `STLGS_SuccessionThrough__c` | Picklist | Nachfolge-Art — 4 Werte: "Übernahme", "Neueröffnung", "Keine Nachfolge", "Nachfolge offen" |
| `STLGS_IsStoreConstructionELO__c` | Checkbox | Ladeneinrichtungsdokumentation in ELO archiviert |
| `STLGS_StartLockOut__c` | Date | Beginn Betriebssperre (TK) |
| `STLGS_EndLockOut__c` | Date | Ende Betriebssperre (TK) |

**Account-Felder:**

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_TerminatedBy__c` | Picklist | Wer hat gekündigt (synced von Case) |
| `STLGS_TerminatedOn__c` | Date | Kündigungsdatum am Account |
| `STLGS_TerminateLineVO__c` | Checkbox | Leitungskündigung |

**STLGS_Event__c (Termination Event):**

Record Type: `STLGS_TerminationRecordType` (CRM-2700)

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_TerminationReason__c` | Text | Kündigungsgrund |
| `STLGS_TerminationLetterDate__c` | Date | Briefdatum |
| `STLGS_TerminateLine__c` | Picklist | Leitungsdisposition |
| `STLGS_IsTerminationInELO__c` | Checkbox | ELO-Archivierung |

**STLGS_Request__c (Shutdown/Außerbetriebnahme):**

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_ShutdownDate__c` | Date | Außerbetriebnahme-Datum (synced von Account.STLGS_TerminatedOn__c) |
| `STLGS_ShutdownReportedToRPAt__c` | Date | Wann an RP gemeldet |
| `STLGS_ReasonShutdown__c` | Picklist | Außerbetriebnahme-Grund (3 Werte, siehe Abschnitt Außerbetriebnahme) |
| `STLGS_IsPredecessorTerminated__c` | Checkbox | Vorgänger-Antrag gekündigt |

### Automation

**Flows (9):**

| Flow | Typ | Zweck |
|------|-----|-------|
| `STLGS_UpdateTermination` | Autolaunched | Aktualisiert Kündigungs-Case-Felder (Typ, Initiator, Datum, Briefdatum) |
| `STLGS_AdaptTermination` | Screen Flow (Quick Action) | "Kündigung anpassen" — editiert bestehende Kündigung (CRM-2718) |
| `STLGS_ResetTerminationOnRDChange` | Autolaunched | Setzt Status zurück + reassigned an VO bei RD-Änderungen (CRM-2949) |
| `STLGS_AccountTerminatedBy` | Autolaunched | Synct `TerminatedBy` von Case → Account |
| `STLGS_CreateUpdateTerminationEvent` | Autolaunched | Erstellt/aktualisiert Event-Records für Kündigungs-Tracking (CRM-2702) |
| `STLGS_CaseTerminateLine` | Autolaunched | Leitungskündigungs-Logik (CRM-2774) |
| `STLGS_UpdateShutdownDateOnRequest` | Autolaunched | Synct Shutdown-Datum Account → Request (CRM-2439) |
| `STLGS_UpdateShutdownDateOnPreviousRequest` | Autolaunched | Aktualisiert Vorgänger-Request bei Shutdown |
| `STLGS_CheckOnShutdown` | Autolaunched | Monitort Shutdown-Datum und aktualisiert Request-Status (CRM-2470) |

**Apex-Klassen:**

| Klasse | Typ | Zweck |
|--------|-----|-------|
| `STLGS_TA_AppendCaseRemarks` | Trigger Action (BeforeInsert/BeforeUpdate) | Hängt Bemerkungen mit Timestamp an `STLGS_GeneralDescription__c` an — chronologisches Protokoll (CRM-2964, CRM-2610) |
| `STLGS_GenerateContractPDFController` | VF Controller | Generiert Außerbetriebnahme-PDF + andere Vertragsdokumente |
| `STLGS_TextMergeService` | Service | Text-Merge für Dokumentengenerierung |
| `STLGS_TextMergeLookupService` | Service | Lookup-Service für Text-Merge-Felder |

**Quick Actions (3):**

| Action | Objekt | Zweck |
|--------|--------|-------|
| `Account.STLGS_NewTermination` | Account | Erstellt Kündigungs-Case mit vorausgefüllten Feldern (Standard Quick Action) |
| `Account.STLGS_NewTerminationFlow` | Account | Flow-basierte Version der Kündigungserstellung (CRM-2723) |
| `Case.STLGS_AdaptTermination` | Case | "Kündigung anpassen" — ruft Flow `STLGS_AdaptTermination` auf (CRM-2718) |

**Validation Rules (7):**

| Rule | Objekt | Zweck |
|------|--------|-------|
| `STLGS_TerminationMandatoryFields` | Case | ELO-Checkbox Pflicht vor Übergabe |
| `STLGS_TerminationClosedMandatoryFields` | Case | Leitungsdisposition vor Schließung |
| `STLGS_TerminationTypeMandatory` | Case | Kündigungstyp Pflicht bei STLGS-Records |
| `STLGS_ValidateTerminationLetterDate` | Case | Briefdatum Pflicht bei "Übergeben an VO" |
| `STLGS_PreventClosureOnDisruption` | Case | Keine Schließung bei aktiver Vollstörung |
| `STLGS_MandatoryFieldsForShutdown` | STLGS_Request__c | Shutdown-Datum + Grund Pflicht für "Erlaubnis erloschen" |
| `STLGS_TerminatedOnEmpty` | STLGS_Request__c | Validierung des TerminatedOn-Feldes |

**VF Pages (1):**

| Page | Zweck |
|------|-------|
| `STLGS_PDFDocumentAusserbetriebnahme` | "Meldung Außerbetriebnahme und Erlöschen einer erteilten Erlaubnis" — offizielles Dokument für Regierungspräsidium Karlsruhe |

**Flex Pages (1):**

| Page | Zweck |
|------|-------|
| `Termination_Event_Record_Page` | Record Page für STLGS_Event__c Termination Events |

### Integrationen

- **ELO (Dokumentenmanagement):** Kündigungsunterlagen werden in ELO archiviert. Checkbox `STLGS_IsTerminationElo__c` bestätigt die Archivierung. Kein technischer API-Sync — manueller Prozess.
- **Regierungspräsidium Karlsruhe:** Außerbetriebnahme-Meldung wird als PDF generiert und versandt. Kein elektronischer Datenfluss.

## Konfiguration

- **CMT `STLG_2ndLvlCaseCreationConfig.Abo_Kuendigungsbriefe_Spielauftragsaende`:** Automatisierte Kündigungsbrief-Erstellung. Owner Queue: `STLG_2ndLevelLotto`, Scheduled 08:00 UTC.
- **Quick Action `STLGS_NewTermination`:** Vorausgefüllte Felder basierend auf Profil — `STLGS_TerminatedBy__c` wird automatisch auf "Annahmestelle" gesetzt wenn User Profil `STLGS_Sales` hat.
- **STLGS_Event__c Record Type `STLGS_TerminationRecordType`:** Eigener Record Type für Kündigungs-Events mit spezifischen Picklist-Werten (CRM-2700).

## Bekannte Probleme & Workarounds

### Daten-Synchronisation Case ↔ Account ↔ Request

Mehrere Flows halten Daten zwischen Case, Account und Request synchron:
- `STLGS_AccountTerminatedBy`: Case.TerminatedBy → Account.TerminatedBy
- `STLGS_UpdateShutdownDateOnRequest`: Account.TerminatedOn → Request.ShutdownDate

**Risiko:** Wenn Felder manuell direkt am Account geändert werden (statt über den Case), können die Flows die Synchronisation nicht triggern. Die Datenintegrität hängt davon ab, dass User den Kündigungs-Case als Einstiegspunkt verwenden.

### Zwei Quick Actions für Kündigung

Es existieren zwei Quick Actions für die Kündigungserstellung:
- `Account.STLGS_NewTermination` (Standard Quick Action — ältere Version)
- `Account.STLGS_NewTerminationFlow` (Flow-basierte Version, CRM-2723)

**Risiko:** Unklar ob beide im Layout aktiv sind oder ob die ältere Version deaktiviert wurde. Potenzielle Verwirrung für User.

### Handover-Counter

Flow `STLGS_ResetTerminationOnRDChange` zählt einen Handover-Counter hoch bei jeder RD-Änderung (CRM-2949). Dieser Counter dient der Nachverfolgung, wie oft ein Case zwischen RD und VO hin- und hergereicht wurde.

### Bekannte Bugs (behoben)

- **CRM-2774 (behoben):** Bei Kündigung durch STLG wird "Grund des Erlöschens" am Antrag nicht gesetzt. Root Cause: Flow/Trigger prüft `STLGS_TerminatedBy__c` nicht korrekt.
- **CRM-2916 (behoben):** PROD: Kündigungsdatum und Kündigungsgrund fehlen im Kündigungsverlauf — funktioniert in UAT2, Deployment-Gap.
- **CRM-2884 (behoben):** RD5 kann Kündigung nicht anlegen/speichern — Validation Rule oder Feldberechtigungs-Problem.
- **CRM-2820 (behoben):** TK-Kündigung-Trigger: Wenn ein offener Kündigungsvorgang aus einem annullierten TK existiert, wird bei erneutem TK-Versagen (Ampel "TK Schliessung") KEIN neuer Kündigungsvorgang erstellt. Fix: Prüfung auf offene Kündigungs-Cases entfernt/angepasst.
- **CRM-2790 (behoben):** Feld "Allgemeine Beschreibung" fehlt plötzlich in UAT2 für Admin und VO am Vorgang Kündigung.
- **CRM-2088 (behoben):** Schriftgröße in Abmahndokument, Kündigung und Sperre zu klein.

### Technische Schulden

- **Kein dedizierter RecordType auf Case:** Kündigung wird über `STLGS_Type__c = 'Kündigung'` gesteuert, nicht über einen eigenen Record Type. Das bedeutet, dass alle STLGS-Validation Rules und Flows den Type zusätzlich prüfen müssen.
- **Event-Tracking parallel zum Case:** `STLGS_Event__c` dupliziert teilweise Case-Informationen (Reason, LetterDate, Line). Der Mehrwert gegenüber Case-History ist unklar.
- **LWC `stlgs_generateTPDocuments` obsolet:** Wurde durch QuickText-Ansatz ersetzt, existiert aber noch im Code.

## Referenzen

### Jira

**Grundlagen & Prozessdefinition:**
- **CRM-113:** Kündigung ASt TBD (initial)
- **CRM-116:** Kündigung durch Lotto — Prozess
- **CRM-119:** Kündigung — Workflow/Status anpassen
- **CRM-120:** Kündigung → Nachfolge durch Neueröffnung
- **CRM-111:** Kündigung — Nachfolge durch
- **CRM-117:** Kündigung — Möbelgeld als eigener Vorgang
- **CRM-1071:** Kündigung — RD nur Picklist

**Event-basiertes Modell (CRM-2610 Epic):**
- **CRM-2610:** Kündigung über Events flach auf dem Case abbilden (Architektur-Umbau)
- **CRM-2700:** `STLGS_TerminationRecordType` — Event Record Type
- **CRM-2702:** `STLGS_CreateUpdateTerminationEvent` — Event-Erstellung
- **CRM-2716:** Kündigung Preset & Not used for Read-Only Cases & Event on creation
- **CRM-2718:** `STLGS_AdaptTermination` — Quick Action Kündigung anpassen
- **CRM-2723:** `Account.STLGS_NewTerminationFlow` — Flow-basierte Kündigungserstellung
- **CRM-2964:** `STLGS_TA_AppendCaseRemarks` — Bemerkungen-Protokoll

**Handover & Berechtigungen:**
- **CRM-2732:** Kündigung — Übergeben an RD → Übergeben an VO
- **CRM-2742:** VO legt Kündigung an — Leitung darf nicht Pflicht sein
- **CRM-2743:** Keine Chatter-Benachrichtigung bei Änderung an Kündigung für VO
- **CRM-2745:** RD kann Kündigung durch Lotto nicht bearbeiten
- **CRM-2746:** Kündigung — Wiedervorlage am für VO oder RD
- **CRM-2747:** Kündigung VO aktualisiert Allgemeine Beschreibung — neuer Eintrag im Verlauf
- **CRM-2758:** Kündigung durch Lotto — RD → VO: keine korrekte Handover-Logik
- **CRM-2779:** Kündigung durch Lotto — Kündigungstyp für RD disablen
- **CRM-2949:** `STLGS_ResetTerminationOnRDChange` — RD-Reset-Logik

**Leitungslogik & Shutdown:**
- **CRM-1811:** Rücknahme der Kündigung — Leitung wird weiter benötigt
- **CRM-2439:** `STLGS_UpdateShutdownDateOnRequest` — Shutdown-Datum-Sync
- **CRM-2470:** `STLGS_CheckOnShutdown` — Shutdown-Monitoring
- **CRM-2774:** Kündigung durch STLG — Antrag: Grund des Erlöschens wird nicht gesetzt

**TK-initiierte Kündigung:**
- **CRM-1862:** nat. Person — Kündigung Testkauf
- **CRM-1985:** TK: Prozess ASt wird geschlossen (natürliche Person) > Kündigung
- **CRM-1986:** TK: Prozess ASt wird geschlossen (juristische Person) > 4-Wochen-Sperre + Kündigung
- **CRM-2060:** TK Kündigung jur. Person bei Testkauf
- **CRM-2744:** Kündigung Testkauf — Kündigungsgrund
- **CRM-2820:** Anpassung Trigger Kündigung aufgrund TK

**Dokumentvorlagen & Quicktexts:**
- **CRM-2088:** Schriftgröße in Abmahndokument, Kündigung und Sperre zu klein
- **CRM-2147:** Code Refactoring — Consolidate Sperre, Kündigung und Abmahnung
- **CRM-2169:** TK: Dateinamen für Sperre und Kündigung anpassen
- **CRM-2212:** jur. Person — Kündigungsbestätigung (Kündigung Standort)
- **CRM-2216:** nat. Person — Kündigungsbestätigung verschiedene Vertragsdauer
- **CRM-2457:** Kündigung durch Lotto: fristl. wg. Zahlungsschwierigkeiten (T025)
- **CRM-2543:** jur. Person — Kündigung Standort Auflösung + aktualisierte Anlage 1
- **CRM-2551:** jur. Person — Kündigung GBV Kündigungsbestätigung + Auflösung Standort
- **CRM-2555:** Kündigung durch Lotto: fristl. wg. Insolvenz (T026)
- **CRM-2556:** Kündigung durch Lotto: Probezeit (T042)
- **CRM-2557:** Kündigung durch Lotto: nicht mehr tätig (T023)
- **CRM-2558:** Kündigung Bestätigung: Kündigung erfolgt früher
- **CRM-2559:** Kündigung Bestätigung: Kündigung erfolgt später
- **CRM-2560:** Kündigung Bestätigung: Rücknahme der Kündigung
- **CRM-2672:** Kündigung durch Lotto — Strafverfahren (T024)
- **CRM-2673:** Kündigung — Rücknahme (T033)
- **CRM-2754:** Quicktext nat. Person — Kündigung TK Jugendschutz
- **CRM-2755:** Quicktext nat. Person — Kündigung TK Spielerschutz
- **CRM-2756:** Quicktext jur. Person — Kündigung TK Jugendschutz
- **CRM-2757:** Quicktext jur. Person — Kündigung TK Spielerschutz
- **CRM-2803:** Kündigung durch Lotto — Sonstiges jur. + nat. Person (abgebrochen)

**Sonstige Kündigungsgründe:**
- **CRM-2918:** Nachschulung Kündigung (Schulungsnotizen)

**Bugs (alle behoben):**
- **CRM-2774:** Grund des Erlöschens wird nicht gesetzt bei STLG-Kündigung
- **CRM-2790:** Feld Allgemeine Beschreibung fehlt plötzlich in UAT2
- **CRM-2820:** TK-Kündigung-Trigger blockiert durch offenen Vorgang
- **CRM-2884:** RD5 Kündigung kann nicht angelegt werden
- **CRM-2916:** Kündigungsdatum + -grund fehlen im Kündigungsverlauf (PROD)

### Confluence

- **Dokumente im Vertrieb** (SLI Space, Page 1462239249) — Übersicht aller Dokumentvorlagen pro Vorgangstyp (nat./jur. Person), inkl. Kündigung
- **Untitled live doc 2025-10-13** (Page 1643544578) — IST/SOLL-Analyse Event-basiertes Kündigungsmodell, detaillierte Feld-Mappings, Leitungslogik, Validation Rules
- **Kündigungen erfassen** (PM23SFV Space, Page 1502806609) — Endanwender-Dokumentation (minimaler Inhalt)

### Codebase

**Flows:** `force-app/main/default/flows/STLGS_*Termination*`, `STLGS_*Shutdown*` (9 Flows)
**Apex:** `force-app/main/default/classes/STLGS_TA_AppendCaseRemarks.cls`, `STLGS_GenerateContractPDFController.cls`, `STLGS_TextMerge*.cls`
**Case Fields:** `force-app/main/default/objects/Case/fields/STLGS_Terminat*` (9 Felder)
**Account Fields:** `force-app/main/default/objects/Account/fields/STLGS_Terminat*` (3 Felder)
**Request Fields:** `force-app/main/default/objects/STLGS_Request__c/fields/STLGS_Shutdown*` (4 Felder)
**Event Fields:** `force-app/main/default/objects/STLGS_Event__c/fields/STLGS_Terminat*` (5 Felder)
**Validation Rules:** Case (5), STLGS_Request__c (2)
**Quick Actions:** `force-app/main/default/quickActions/Account.STLGS_NewTermination*`, `Case.STLGS_AdaptTermination`
**VF Page:** `force-app/main/default/pages/STLGS_PDFDocumentAusserbetriebnahme.page`

## Änderungshistorie

| Datum | Änderung | Quelle |
|-------|----------|--------|
| 2026-02-20 | Initiale Erstellung | Codebase-Analyse (9 Flows, 22 Fields, 7 VR, 3 QA, 1 VF Page), domain-knowledge.md |
| 2026-02-20 | Jira/Confluence-Anreicherung | ~51 Jira-Stories, 3 Confluence-Seiten: Event-basiertes Modell (CRM-2610), Leitungslogik korrigiert (2 vs. 3 Felder), Dokumentvorlagen (8 Templates), Handover-Logik (CRM-2758/-2779), 6 Bugs dokumentiert, vollständige Jira-Referenzen |
| 2026-02-20 | Cross-Reference ergänzt | Verweis auf ruecklastschrift.md |
| 2026-02-20 | Cross-Reference ergänzt | Verweis auf vertragsrelevante-datenaenderung.md |
