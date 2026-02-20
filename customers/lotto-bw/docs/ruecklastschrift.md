# Rücklastschrift — Domain Knowledge

> Letzte Aktualisierung: 2026-02-20 | Quellen: 21 Jira-Stories, 1 Flow, 1 Validation Rule, 0 Confluence-Seiten

## Überblick

Rücklastschriften (RüLa) entstehen, wenn SEPA-Lastschriften von Annahmestellen zurückgegeben werden (z.B. mangelnde Deckung, falsches Konto, Widerspruch). Der Prozess wird über einen Case vom Typ `Rücklastschrift` im RecordType `STLGS_EditCase` abgebildet und umfasst die Erfassung des Betrags, die Klärung mit der Regionaldirektion (RD), die Zahlungsabwicklung und die Meldung an die Buchhaltung. Die VO (Vertriebsorganisation) steuert den Prozess zentral, die RD liefert Rückmeldung zur Annahmestelle.

Siehe auch: [docs/kuendigung.md](kuendigung.md) — Zahlungsschwierigkeiten als Kündigungsgrund, [docs/service-desk.md](service-desk.md) — Allgemeines Case-Handling (anderer RecordType), [docs/vertragsrelevante-datenaenderung.md](vertragsrelevante-datenaenderung.md) — Anderer B2B-Vorgangstyp (gleicher RecordType `STLGS_EditCase`).

## Geschäftsprozess

### Rücklastschrift-Erfassung (Screen Flow)

1. **VO** öffnet den Screen Flow `STLGS_CreateReturnDebit` auf dem Account der Annahmestelle
2. Flow-Screen erfasst:
   - **Queue** (Zuständige Warteschlange, gefiltert auf STLGS_-Queues ohne System-Queues)
   - **Betrag** (`STLGS_Amount__c`) — Nettobetrag der Rücklastschrift
   - **Bankgebühren** (`STLGS_BankCharges__c`) — Default: 0,00 €
   - **Verwaltungskosten** (`STLGS_AdministrativeExpenses__c`) — Default: 6,00 €
   - **Gesamtbetrag** (`STLGS_AmountInclFee__c`) — automatisch berechnet
   - **Kalenderwoche** (`STLGS_CWReturnDebit__c`) — Freitext
   - **Grund** (`STLGS_ReasonReturnDebit__c`) — Rich-Text, Pflichtfeld, Default "Sonstiges"
   - **Fälligkeitsdatum** (`STLG_FollowupDate__c`)
   - **Beschreibung** (`Description`) — allgemeine Fallbeschreibung
3. Flow erstellt Case mit:
   - RecordType: `STLGS_EditCase`
   - `STLGS_Type__c`: `Rücklastschrift`
   - Subject: `Rücklastschrift - DD-MM-YYYY` (Tagesdatum)
   - Origin: `Email`
   - Status: Default (Neu)

### Bearbeitung und Klärung

4. Case landet in der gewählten Queue (i.d.R. RD-Queue)
5. **RD** prüft die Rücklastschrift mit der Annahmestelle und gibt Rückmeldung:
   - `STLGS_FeedbackRegionalDirectorate__c` — Rich-Text-Feld für die Stellungnahme der RD
   - `STLGS_Payment__c` — Zahlungsart (wie wird der Betrag beglichen)
6. RD übergibt an VO (Owner-Wechsel zur Queue `STLGS_SalesOrganization`)

### VO-Abschluss

7. **Validation Rule** `STLGS_ReturnDebitMandatoryFields` greift bei Owner = Queue `STLGS_SalesOrganization`:
   - `STLGS_Payment__c` muss gefüllt sein
   - `STLGS_FeedbackRegionalDirectorate__c` muss gefüllt sein
   - Fehlermeldung: "Bitte Rückmeldung Regionaldirektion und Zahlung prüfen!"
8. VO prüft die Zahlungsart und veranlasst ggf. den Einzug / die Verrechnung
9. VO setzt `STLGS_IsReportedAccounting__c = true` wenn der Vorgang an die Buchhaltung übergeben wird
10. VO schließt den Case

### Referenzwert: Durchschnittsprovision

Das Formelfeld `STLGS_AverageCommissionLast10Weeks__c` zeigt die durchschnittliche Provision der Annahmestelle (letzte 10 Wochen, vom Account übernommen). Dient als Referenz zur Einordnung der Rücklastschrifthöhe.

## Business Rules

- **Verwaltungskosten-Default**: 6,00 € pro Rücklastschrift (im Flow vorbelegt, editierbar)
- **Gesamtbetrag-Formel**: `STLGS_AmountInclFee__c = STLGS_Amount__c + STLGS_BankCharges__c + STLGS_AdministrativeExpenses__c` (BlankAsZero)
- **Pflichtfelder bei VO-Übergabe**: Validation Rule `STLGS_ReturnDebitMandatoryFields` erzwingt `STLGS_Payment__c` und `STLGS_FeedbackRegionalDirectorate__c` wenn Owner = Queue `STLGS_SalesOrganization` UND Typ = `Rücklastschrift`
- **Subject-Konvention**: Automatisch generiert als `Rücklastschrift - DD-MM-YYYY` (Datumsformat deutsch, CRM-2576)
- **Queue-Filter im Flow**: Nur Queues mit Prefix `STLGS_` werden angezeigt, minus: `STLGS_SalesOrganization`, `STLGS_Sales`, `STLGS_Poststelle`, `STLGS_ServiceDesk` (Systemqueues)
- **Origin**: Wird automatisch auf `Email` gesetzt (nicht editierbar im Flow)

## Technische Umsetzung

### Datenmodell

**Objekt:** Case (RecordType `STLGS_EditCase`, `STLGS_Type__c = Rücklastschrift`)

| Feld (API-Name) | Typ | Beschreibung |
|---|---|---|
| `STLGS_Amount__c` | Currency(8,2) | Nettobetrag der Rücklastschrift |
| `STLGS_BankCharges__c` | Currency(12,2) | Bankgebühren (Rücklastschrift-Kosten der Bank) |
| `STLGS_AdministrativeExpenses__c` | Currency(12,2) | Verwaltungskosten (Default 6,00 €) |
| `STLGS_AmountInclFee__c` | Formula Currency | `Amount + BankCharges + AdministrativeExpenses` (BlankAsZero) |
| `STLGS_ReasonReturnDebit__c` | Html (32768) | Begründung der Rücklastschrift (Rich-Text) |
| `STLGS_Payment__c` | Picklist (restricted) | Zahlungsart — siehe vollständige Liste unten |
| `STLGS_CWReturnDebit__c` | Text(50) | Kalenderwoche der Rücklastschrift |
| `STLGS_IsReportedAccounting__c` | Checkbox | An Buchhaltung gemeldet (Default: false) |
| `STLGS_FeedbackRegionalDirectorate__c` | Html (32768) | Rückmeldung der Regionaldirektion (Rich-Text) |
| `STLGS_AverageCommissionLast10Weeks__c` | Formula Currency | Durchschnittsprovision letzte 10 Wochen (von `Account.STLGS_AverageCommissionLast10Weeks__c`) |

**Picklist `STLGS_Payment__c` (vollständig, restricted, sorted):**

| API-Wert | Label | Beschreibung |
|---|---|---|
| `Betrag kann eingezogen werden` | Betrag kann eingezogen werden | Regulärer Einzug per Lastschrift möglich |
| `Betrag wird bar bei RD abgeliefert` | Betrag wird bar bei RD abgeliefert | Barzahlung an der Regionaldirektion |
| `Betrag wird überwiesen` | Betrag wird überwiesen | ASt hat Überweisung zugesagt |
| `Betrag wurde überwiesen` | Betrag wurde überwiesen | Überweisung ist erfolgt |
| `Einzug vom neuen Konto` | Einzug vom neuen Konto | Lastschrift von geänderter Bankverbindung |
| `Forderungsaufstellung` | Forderungsaufstellung | Betrag wird in Gesamtforderung aufgenommen |
| `Gebühren einziehen` | Gebühren einziehen | Nur Gebühren (nicht Nettobetrag) einziehen |
| `keine Zahlung` | keine Zahlung | Kein Zahlungseingang erwartet/möglich |
| `Rest einziehen` | Rest einziehen | Differenzbetrag (Teilzahlung erfolgt) einziehen |

### Automation

| Flow / Komponente | Typ | Zweck |
|---|---|---|
| `STLGS_CreateReturnDebit` | Screen Flow | Erstellt RüLa-Case vom Account aus. Erfasst Beträge, KW, Grund, Queue. Startet auf Account-Record-Page. |
| `STLGS_ReturnDebitMandatoryFields` | Validation Rule (Case) | Erzwingt `Payment` und `FeedbackRegionalDirectorate` wenn Case bei Queue `STLGS_SalesOrganization` und Typ = `Rücklastschrift` |

**B2C-Seitige Referenzen (nicht primär RüLa-Prozess):**

- `STLG_UpdateCaseEmail2Case` — Erwähnt "Rücklastschrift" im Kontext Email-to-Case (B2C)
- `STLG_New2ndLevelCase` — Referenziert "Rücklastschrift" als möglichen Case-Typ bei 2nd-Level-Eskalation

### Integrationen

- **Buchhaltung**: Manueller Übergabeprozess über Checkbox `STLGS_IsReportedAccounting__c`. Keine automatische Integration — die Meldung an die Buchhaltung erfolgt außerhalb von Salesforce (z.B. per E-Mail oder Berichtsexport).
- **Kontoauszug (Epic CRM-2268)**: Rücklastschriften werden im Kontoauszug der Annahmestelle abgebildet. Die Felder `Amount`, `BankCharges`, `AdministrativeExpenses` und `AmountInclFee` fließen in den Kontoauszug ein.

## Konfiguration

- **RecordType**: `STLGS_EditCase` (gemeinsam mit anderen B2B-Vorgangstypen)
- **Type-Wert**: `Rücklastschrift` (steuert VR-Auswertung und Layout-Sichtbarkeit)
- **Default Verwaltungskosten**: 6,00 € (hardcoded im Flow `STLGS_CreateReturnDebit`)
- **Default Grund**: "Sonstiges" (hardcoded im Flow)
- **Default Origin**: "Email" (hardcoded im Flow)
- **Queue-Filter**: Prefix `STLGS_`, exklusive: `STLGS_SalesOrganization`, `STLGS_Sales`, `STLGS_Poststelle`, `STLGS_ServiceDesk`
- **Validation Rule**: `STLGS_ReturnDebitMandatoryFields` — aktiv, feuert nur bei Owner = Queue + OwnerName = `STLGS_SalesOrganization`

## Bekannte Probleme & Workarounds

- **CRM-3033 (Status: Next)**: Lookup-Filter auf einem Accountfeld im RüLa-Kontext funktioniert nicht korrekt. Noch nicht behoben.
- **Keine automatische Buchhaltungs-Integration**: `STLGS_IsReportedAccounting__c` ist nur ein manuelles Flag — es gibt keinen Flow oder Report, der bei Aktivierung automatisch etwas auslöst. Potenzielle technische Schuld.
- **Hardcoded Defaults im Flow**: Verwaltungskosten (6,00 €), Grund ("Sonstiges") und Origin ("Email") sind direkt im Flow hinterlegt statt in Custom Metadata. Bei Änderungsbedarf muss der Flow editiert werden.
- **Queue-Filter Wartbarkeit**: Die Liste der exkludierten Queues ist hardcoded im Flow. Neue System-Queues müssen manuell ergänzt werden.
- **Kein Status-Flow dokumentiert**: Anders als bei Testkauf oder Kündigung gibt es keinen definierten Status-Flow für RüLa-Cases. Der generische B2B-Status-Flow (Neu → In Bearbeitung RD → Übergeben an VO → In Bearbeitung VO → Geschlossen) wird implizit verwendet.

## Referenzen

### Jira

**Epic CRM-2268 — Kontoauszug (enthält RüLa-Stories):**

| Key | Summary | Status |
|---|---|---|
| CRM-2524 | Neue Felder für Rücklastschrift | Done |
| CRM-2570 | Default Status für Rücklastschrift-Cases | Done |
| CRM-2571 | Neue Gründe für Rücklastschrift | Done |
| CRM-2576 | Datumsformat im Subject (DD-MM-YYYY) | Done |
| CRM-2584 | Screen Flow erweitern (Beträge, KW, Grund) | Done |
| CRM-3030 | Filter auf Accountfeld im RüLa-Kontext | Done |
| CRM-3033 | Lookup Filter Bug | Next |

**Epic CRM-105 — B2B Case-Prozesse (Überlappung):**

| Key | Summary | Status |
|---|---|---|
| CRM-2267 | Screen Flow: Rücklastschrift erstellen | Done |
| CRM-2222 | Durchschnittliche Provision anzeigen | Done |
| CRM-109 | Rücklastschrift Case-Typ implementieren | Done |

**Weitere relevante Stories:**

| Key | Summary | Status |
|---|---|---|
| CRM-2725 | Fehlende Felder auf Case-Layout ergänzen | Done |
| CRM-3032 | Neue Themenbereiche/Lösungspunkte (RüLa + weitere) | Done |
| CRM-2959 | Rücklastschrift-Prozessoptimierung | Open |

### Confluence

Keine relevanten Confluence-Seiten gefunden.

### Codebase

- Screen Flow: `force-app/main/default/flows/STLGS_CreateReturnDebit.flow-meta.xml`
- Validation Rule: `force-app/main/default/objects/Case/validationRules/STLGS_ReturnDebitMandatoryFields.validationRule-meta.xml`
- Felder: `force-app/main/default/objects/Case/fields/STLGS_Amount__c.field-meta.xml` (+ BankCharges, AdministrativeExpenses, AmountInclFee, ReasonReturnDebit, Payment, CWReturnDebit, IsReportedAccounting, FeedbackRegionalDirectorate, AverageCommissionLast10Weeks)

## Änderungshistorie

| Datum | Änderung | Quelle |
|-------|----------|--------|
| 2026-02-20 | Initiale Erstellung | CRM-2268, CRM-105, Codebase-Analyse (Flow, VR, 10 Felder) |
| 2026-02-20 | Cross-Reference ergänzt | Verweis auf vertragsrelevante-datenaenderung.md |
