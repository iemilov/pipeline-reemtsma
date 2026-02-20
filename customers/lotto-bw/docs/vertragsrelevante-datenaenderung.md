# Vertragsrelevante Datenänderung — Domain Knowledge

> Letzte Aktualisierung: 2026-02-20 | Quellen: 29 Jira-Stories, 3 Flows, 2 Validation Rules, 1 Quick Action, 0 Confluence-Seiten

## Überblick

Vertragsrelevante Datenänderungen sind ein Sammelvorgang für alle Änderungen an Stammdaten einer Annahmestelle, die vertragliche oder behördliche Relevanz haben. Der Vorgang wird als Case vom Typ `Änderung vertragsrelevanter Daten` im RecordType `STLGS_EditCase` abgebildet. Die RD erstellt den Vorgang per Quick Action am Account, klassifiziert das Anliegen (11 verschiedene Typen) und übergibt an die VO. Die VO setzt die Änderung in Aegis/CRM um und schließt den Vorgang. Bei bestimmten Anliegen-Typen (z.B. "Keine Inbetriebnahme") werden automatisch Folgeprozesse auf dem verknüpften Antrag (Request) ausgelöst.

Siehe auch: [docs/kuendigung.md](kuendigung.md) — Anliegen-Typ "Kündigung durch Lotto veranlassen" löst Kündigungsprozess aus, [docs/filialverantwortung-wechseln.md](filialverantwortung-wechseln.md) — Eigener Vorgangstyp für FV-Wechsel (teilt den Flow `STLGS_UpdateRequestOnStatusChange`), [docs/antrag.md](antrag.md) — Antragsrelevante Daten und Außerbetriebnahme-Prozess, [docs/ruecklastschrift.md](ruecklastschrift.md) — Anderer B2B-Vorgangstyp (gleicher RecordType `STLGS_EditCase`).

## Geschäftsprozess

### Vorgang erstellen

1. **RD** klickt Quick Action "Change Contract-relevant Data" auf dem Account der Annahmestelle
2. Quick Action erstellt Case mit:
   - RecordType: `STLGS_EditCase`
   - `STLGS_Type__c`: `Änderung vertragsrelevanter Daten` (automatisch vorbelegt)
   - Subject: `Neue vertragsrelevante Daten erfasst am - DD-MM-YYYY` (Tagesformel)
   - Status: `New`
3. RD füllt auf dem Quick-Action-Layout:
   - **Subject** (Pflicht, vorbelegt)
   - **Gültig ab** (`STLGS_ValidFrom__c`, Pflicht) — Stichtag der Änderung
   - **Anliegen-Typ** (`STLGS_MasterDataChangeType__c`, optional bei Erstellung) — Klassifikation
   - **Beschreibung** (`STLGS_GeneralDescription__c`, optional) — Details zur Änderung

### Bearbeitung und Übergabe

4. RD bearbeitet den Vorgang, ergänzt ggf. den Anliegen-Typ und Details
5. RD übergibt an VO (Owner-Wechsel zur Queue `STLGS_SalesOrganization`)
   - **VR `STLGS_CheckMasterDataChangeType`** greift: `STLGS_MasterDataChangeType__c` muss gefüllt sein
6. VO findet den Vorgang in der Listenansicht "Offene Vertragsrelevante Datenänderungen VO"
7. VO setzt die Änderung in Aegis/CRM um
8. VO erwähnt den RD-User per @mention im Activity Stream (manuelle Benachrichtigung)
9. VO schließt den Vorgang — oder übergibt zurück an RD bei Rückfragen (`Übergeben an RD`)

### Sonderfall: Keine Inbetriebnahme (CRM-2483)

Bei Schließung eines Vorgangs mit Anliegen-Typ `Keine Inbetriebnahme` wird automatisch der verknüpfte Antrag (Request) aktualisiert:

1. Flow `STLGS_UpdateRequestOnStatusChange` prüft:
   - Request-Status muss `Genehmigt durch RP` oder `Vertrag abgeschlossen` sein
2. Request wird aktualisiert:
   - `STLGS_ReasonShutdown__c` = `Keine Inbetriebnahme`
   - `STLGS_ShutdownDate__c` = `STLGS_ValidFrom__c` (Gültig-ab aus dem Case)
   - `STLGS_Status__c` = `Erlaubnis erloschen`
3. Dies löst den Außerbetriebnahme-Prozess aus → Details siehe [docs/kuendigung.md](kuendigung.md)

### Sonderfall: Upgrade/Downgrade

Bei Anliegen-Typ `Upgrade auf Vollannahmestelle` oder `Downgrade auf Kompakt`:

- VO aktualisiert `STLGS_SalesType__c` am Account und im Antrag
- VO erstellt ggf. neue Verträge (Annahmestellenleitungs-Vertrag bei natürlicher Person, GBV/Anlage 1 bei juristischer Person)
- VO sendet Änderungsmitteilung an RP

### Sonderfall: Kündigung durch Lotto veranlassen

- RD erstellt den Vorgang mit Anliegen-Typ `Kündigung durch Lotto veranlassen`
- VO nimmt dies als Anlass, einen eigenständigen Kündigungsvorgang (STLG-initiiert) zu erstellen
- → Details siehe [docs/kuendigung.md](kuendigung.md)

### Scheduled Path: Antrag-Update bei Gültig-ab-Datum

Der Flow `STLGS_UpdateRequestOnStatusChange` hat einen Scheduled Path, der bei Erreichen des `STLGS_ValidFrom__c`-Datums feuert und den Leading Request aktualisiert (prüft ob LeadingRequest vorhanden, dann BranchManager-Update). Dies betrifft primär den FV-Wechsel-Pfad, nicht den vertragsrelevante-Daten-Pfad.

## Business Rules

- **Anliegen-Typ Pflicht bei VO-Übergabe**: VR `STLGS_CheckMasterDataChangeType` — `STLGS_MasterDataChangeType__c` darf nicht leer sein wenn Owner = Queue `STLGS_SalesOrganization` und Typ = `Änderung vertragsrelevanter Daten` (CRM-2349)
- **Gültig-ab nicht in der Vergangenheit**: VR `STLGS_CheckValidFromDate` — `STLGS_ValidFrom__c` muss >= `TODAY()` sein. **Ausnahme:** User mit Department "Vertriebsorganisation" sind von dieser Regel befreit (CRM-2460)
- **Subject-Konvention**: Automatisch generiert als `Neue vertragsrelevante Daten erfasst am - DD-MM-YYYY` (Quick Action Formel)
- **Keine Inbetriebnahme → Erlaubnis erloschen**: Nur wenn der verknüpfte Request im Status `Genehmigt durch RP` oder `Vertrag abgeschlossen` ist (Flow-Filter)
- **Chatter-Feed-Item**: Bei Erstellung über Quick Action wird automatisch ein Chatter-Post am Account erzeugt (`optionsCreateFeedItem = true`)
- **Nur zukünftige Daten**: Änderungen gelten nur für zukünftige oder heutige Stichtage (CRM-425)

## Technische Umsetzung

### Datenmodell

**Objekt:** Case (RecordType `STLGS_EditCase`, `STLGS_Type__c = Änderung vertragsrelevanter Daten`)

| Feld (API-Name) | Typ | Beschreibung |
|---|---|---|
| `STLGS_Type__c` | Picklist | Case-Typ — Wert: `Änderung vertragsrelevanter Daten` |
| `STLGS_MasterDataChangeType__c` | Picklist (restricted) | Anliegen-Typ — klassifiziert die Art der Datenänderung (11 Werte, siehe unten) |
| `STLGS_ValidFrom__c` | Date | Gültig ab — Stichtag der Änderung |
| `STLGS_GeneralDescription__c` | Html (131072) | Allgemeine Beschreibung (Rich-Text, History Tracking aktiv) |
| `STLGS_LeadingRequest__c` | Lookup(STLGS_Request__c) | Verknüpfter Antrag — wird bei "Keine Inbetriebnahme" automatisch aktualisiert |

**Picklist `STLGS_MasterDataChangeType__c` (vollständig, restricted, unsorted):**

| API-Wert | Label | Beschreibung |
|---|---|---|
| `Kontaktdaten_ändern` | Kontaktdaten ändern | Name, Staatsangehörigkeit, Geburtsdatum von FV/Lizenzinhaber (→ Aegis) |
| `TelefonnummerASt_ändern` | Telefonnummer ASt ändern | Telefonnummer der Annahmestelle |
| `Steuernummer_ändern` | Steuernummer ändern | Steuernummer der Annahmestelle (→ Aegis) |
| `Abrechnungsemail_ändern` | Abrechnungsemail ändern | Abrechnungs-E-Mail-Adresse |
| `Änderung_jur_Person` | Änderung jur. Person | Firmenname, Adresse bei juristischer Person (→ Aegis) |
| `Upgrade auf Vollannahmestelle` | Upgrade auf Vollannahmestelle | Wechsel Kompakt → Vollannahmestelle (neue Verträge, RP-Meldung) |
| `Downgrade auf Kompakt` | Downgrade auf Kompakt | Wechsel Vollannahmestelle → Kompakt (neue Verträge, RP-Meldung) |
| `Verspätete Inbetriebnahme` | Verspätete Inbetriebnahme | Geplantes Betriebsdatum verschoben |
| `Keine Inbetriebnahme` | Keine Inbetriebnahme | Antrag zurückgezogen → löst Außerbetriebnahme-Flow aus |
| `Wechsel zu Agenturstandort` | Wechsel zu Agenturstandort | ASt wechselt in Agenturbetrieb (CRM-2507) |
| `Kündigung durch Lotto veranlassen` | Kündigung durch Lotto veranlassen | RD beantragt STLG-initiierte Kündigung |

### Automation

| Flow / Komponente | Typ | Zweck |
|---|---|---|
| `Account.STLGS_ChangeContractRelevantData` | Quick Action (Create Case) | Erstellt Case vom Account mit vorbelegt Typ, Subject, Status. Layout: Subject (Pflicht), ValidFrom (Pflicht), MasterDataChangeType (Edit), GeneralDescription (Edit). |
| `STLGS_UpdateRequestOnStatusChange` | Record-Triggered Flow (AfterSave, Case) | Bei Schließung: wenn Typ = "Änderung vertragsrelevanter Daten" + "Keine Inbetriebnahme" → Request auf "Erlaubnis erloschen" setzen. Enthält auch FV-Wechsel-Pfad (Chatter-Post + BranchManager-Update). |
| `STLGS_SetSalesCaseOwner` | Record-Triggered Flow (BeforeSave, Case) | Owner-Assignment bei Case-Erstellung. Erkennt "Änderung vertragsrelevanter Daten" für Duplikat-Check (Status = Obsolete). |
| `STLGS_CheckMasterDataChangeType` | Validation Rule (Case) | Erzwingt `MasterDataChangeType` bei Owner = Queue `STLGS_SalesOrganization` und Typ = "Änderung vertragsrelevanter Daten" (CRM-2349) |
| `STLGS_CheckValidFromDate` | Validation Rule (Case) | Verhindert `ValidFrom < TODAY()` für Nicht-VO-User bei Typ = "Änderung vertragsrelevanter Daten" (CRM-2460) |

### Integrationen

- **Aegis**: Manuelle Pflege durch VO — Steuernummer, Kontaktdaten, Firmendaten werden im externen Aegis-System aktualisiert. Kein automatischer Sync.
- **RP (Regierungspräsidium)**: Bei Upgrade/Downgrade erstellt VO eine Änderungsmitteilung an RP. Manueller Prozess.
- **Antrag (Request)**: Automatische Integration bei "Keine Inbetriebnahme" — Flow setzt Request-Status auf "Erlaubnis erloschen" und triggert damit den Außerbetriebnahme-Prozess.

## Konfiguration

- **RecordType**: `STLGS_EditCase` (gemeinsam mit anderen B2B-Vorgangstypen wie Rücklastschrift, Bankdaten etc.)
- **Type-Wert**: `Änderung vertragsrelevanter Daten` (steuert VR-Auswertung, Flow-Logik und Quick Action)
- **Quick Action**: `Account.STLGS_ChangeContractRelevantData` — sichtbar auf Account-Record-Page, erstellt Chatter-Feed-Item
- **Bypass Switch**: `STLG_BypassSwitch__c.STLG_ValidationRuleSwitch__c` — deaktiviert beide VRs
- **VO-Ausnahme**: VR `STLGS_CheckValidFromDate` prüft `$User.Department = "Vertriebsorganisation"` — VO darf Vergangenheitsdaten setzen
- **Scheduled Path**: Flow `STLGS_UpdateRequestOnStatusChange` hat einen Scheduled Path auf `STLGS_ValidFrom__c` — feuert am Gültig-ab-Datum

## Bekannte Probleme & Workarounds

- **CRM-2882 (Spezifizieren)**: "Gewerbeanmeldung nachreichen" als neuer Anliegen-Typ geplant — noch nicht implementiert
- **CRM-2624 (Backlog)**: "Standort im Agenturbetrieb" — Folgethema zu CRM-2507 (Wechsel zu Agenturstandort), noch nicht spezifiziert
- **Aegis-Sync manuell**: Alle Stammdatenänderungen müssen manuell in Aegis nachgepflegt werden. Kein automatischer bidirektionaler Sync für diese Daten — erhöht Fehlerrisiko bei vergessenen Updates.
- **Keine automatische Benachrichtigung an RD**: Bei Abschluss durch VO erfolgt die Rückmeldung an RD nur per @mention im Activity Stream. Es gibt keinen automatischen Email-Alert oder Case-Status-Notification.
- **Subject-Datumsformat inkonsistent**: Quick Action nutzt `DD-MM-YYYY` (ohne führende Nullen bei Tag/Monat), andere Vorgangstypen nutzen teils `DD.MM.YYYY` mit führenden Nullen.
- **Flow teilt sich mit FV-Wechsel**: `STLGS_UpdateRequestOnStatusChange` handhabt sowohl "Änderung vertragsrelevanter Daten" als auch "Filialverantwortung ändern" — Änderungen am Flow haben potenziell Seiteneffekte auf den anderen Prozess.

## Referenzen

### Jira

**Epic CRM-105 — Antragsprozess 1.0:**

| Key | Summary | Status |
|---|---|---|
| CRM-196 | Vertragsrelevante Datenänderungen | Abgebrochen |
| CRM-210 | Vertragsart als Lookup an ASt anzeigen | Fertig |
| CRM-218 | Aktive ASt - führender Antrag nur unter Vertragsrelevant | Fertig |
| CRM-243 | Antrag Verlegung - Account bleibt read-only | Fertig |
| CRM-325 | Antrag Verlegung - Bankdaten read-only für RD | Fertig |

**Epic CRM-88 — Antragsprozess 1.5:**

| Key | Summary | Status |
|---|---|---|
| CRM-336 | Wechsel Filialverantwortliche | Fertig |
| CRM-2882 | Gewerbeanmeldung nachreichen als Typ VRD | Spezifizieren |

**Epic CRM-101 — Bankdaten:**

| Key | Summary | Status |
|---|---|---|
| CRM-844 | Bankdaten aus Case "Vertragsrelevante Daten ändern" raus | Fertig |

**Epic CRM-2403 — Operativ Q3/25:**

| Key | Summary | Status |
|---|---|---|
| CRM-2349 | VRD: Anliegen-Typ Pflicht bei Übergabe an VO | Fertig |

**Epic CRM-2414 — Außerbetriebnahme:**

| Key | Summary | Status |
|---|---|---|
| CRM-2483 | Keine Inbetriebnahme → Meldung Außerbetriebnahme | Fertig |

**Standalone Stories:**

| Key | Summary | Status |
|---|---|---|
| CRM-446 | Vorgang "Vertragsrelevante Daten ändern" | Fertig |
| CRM-425 | Nur zukünftige Daten möglich (auch: heute) | Fertig |
| CRM-1083 | Quick Action Annahmestelle read-only für RD | Fertig |
| CRM-2460 | Validierung (Gültig ab) verhindert Schließen | Fertig |
| CRM-2462 | Zwei weitere Typen bei VRD | Fertig |
| CRM-2507 | Neuer Anliegen-Typ "Wechsel zu Agenturstandort" | Fertig |
| CRM-2797 | Neuer Anliegen-Typ (VRD) | Fertig |
| CRM-2821 | Quickaction Antrag und Annahmestelle — Anpassungen | Fertig |
| CRM-2956 | Neuer Vertriebscase: Neue Beschwerde | Fertig |

**Offene Issues:**

| Key | Summary | Status |
|---|---|---|
| CRM-2882 | Gewerbeanmeldung nachreichen als Typ VRD | Spezifizieren |
| CRM-2624 | Standort im Agenturbetrieb | Backlog |
| CRM-1200 | List View für Personas einschränken | Next |

### Confluence

Keine relevanten Confluence-Seiten gefunden.

### Codebase

- Quick Action: `force-app/main/default/quickActions/Account.STLGS_ChangeContractRelevantData.quickAction-meta.xml`
- Flow: `force-app/main/default/flows/STLGS_UpdateRequestOnStatusChange.flow-meta.xml`
- Flow: `force-app/main/default/flows/STLGS_SetSalesCaseOwner.flow-meta.xml`
- VR: `force-app/main/default/objects/Case/validationRules/STLGS_CheckMasterDataChangeType.validationRule-meta.xml`
- VR: `force-app/main/default/objects/Case/validationRules/STLGS_CheckValidFromDate.validationRule-meta.xml`
- Felder: `force-app/main/default/objects/Case/fields/STLGS_MasterDataChangeType__c.field-meta.xml`, `STLGS_ValidFrom__c`, `STLGS_GeneralDescription__c`

## Änderungshistorie

| Datum | Änderung | Quelle |
|-------|----------|--------|
| 2026-02-20 | Initiale Erstellung | 29 Jira-Stories, Codebase-Analyse (1 QA, 3 Flows, 2 VR, 5 Felder) |
