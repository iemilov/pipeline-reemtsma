# Testkauf (TK) — Domain Knowledge

> Letzte Aktualisierung: 2026-02-20 | Quellen: ~100 Jira-Stories, 4 Confluence-Seiten, 10 Flows, 11 Apex-Klassen, 45 CMT-Records, 7 Validation Rules, 4 VF Pages, 3 lokale Docs

## Überblick

Der Testkauf (TK) ist das zentrale Instrument zur Überprüfung der Einhaltung von Jugendschutz- und Spielerschutzauflagen in den Lotto-Annahmestellen. Externe Testkauf-Agenturen (Skopos für Ersttests, Auroma für Nachtests) führen Mystery-Shopping-Tests durch. Das Ergebnis wird über einen automatisierten Ampelstatus-Mechanismus bewertet, der Abmahnungen, Vertragsstrafen, Sperrungen und Kündigungen auslösen kann. Akteure sind die Testkauf-Agenturen, die Vertriebsorganisation (VO) als Prüfer, und die Regionaldirektionen (RD) als Eskalationsinstanz.

Siehe auch: [docs/kuendigung.md](kuendigung.md) — TK-initiierte Kündigung und Sperrung, [docs/filialverantwortung-wechseln.md](filialverantwortung-wechseln.md) — FV-Wechsel bei Sperrung (jur. Person), [docs/service-desk.md](service-desk.md) — Technischer 1st/2nd Level Support (anderer RecordType, gleiche Accounts), [docs/besuche.md](besuche.md) — TK-Auffälligkeiten als Besuchsanlass, [docs/pflichtschulung.md](pflichtschulung.md) — Nachschulung (TK) vs. Pflichtschulung (eigene Prozesse).

## Geschäftsprozess

### Jährliche TK-Erstellung

Zu Jahresbeginn werden für alle relevanten Annahmestellen automatisch TK-Cases erstellt:
- **Batch:** `STLGS_CreateTestPurchaseBatch` (Scheduled via `STLGS_CreateTestPurchaseScheduled`)
- **Relevante Stores:** Definiert über CMT `STLGS_TestPurchaseRelevantStore__mdt` — 7 Regionaldirektionen mit `STLGS_StoreId__c` als Range-Anfang
- **Flow:** `STLGS_CreateTestPurchase` erstellt die Cases mit korrektem Typ und Queue

### Testtypen nach Quartal

| Quartal | Vollannahmestelle | Kompakt |
|---------|-------------------|---------|
| Q1 | Jugendschutz + Spielerschutz | Jugendschutz |
| Q2/Q3 | Jugendschutz | Jugendschutz |
| Q4 | keine Testkäufe | keine Testkäufe |

### Testkauf-Arten (`STLGS_KindTestPurchase__c`)

- **Ersttest** — regulärer jährlicher Testkauf
- **Nachtest** — automatisch 28 Tage nach "Abrechnung" eines nicht-bestandenen TK
- **Nachschulung** — freiwillig (Gelb→Grün) oder Pflicht (Rot→Gelb)

### Betreff-Logik (Subject)

Der Betreff wird automatisch gesetzt (Flow `STLGS_PresetTestPurchases`):
- Format: `<Jahr> - <KindTestPurchase> - <TypeTestPurchase>`
- Beispiele: `2026 - Ersttest - Jugendschutz`, `2026 - Nachtest - Spielerschutz`
- Quelle: CRM-1950

### Status-Flow

```text
TK beauftragt
  → TK durchgeführt                    [Agentur führt Test durch]
    → TK-Ergebnis nicht geprüft        [Batch: wöchentlich Mo-So]
      → TK-Ergebnis geprüft            [Batch automatisch ODER VO manuell]
        → Testkauf Abmahnung            [bei "nicht bestanden" — Dokument wird generiert]
          → Abrechnung                   [Vertragsstrafe wird berechnet]
            → Geschlossen                [Vorgang abgeschlossen]

Sonderstatus:
  → In Klärung / Beschwerde             [TK-Beschwerde — für Annullierung]
```

**Status Label → API-Name Mapping:**

| UI-Label | API-Name (`fullName` im Case Status) |
|----------|--------------------------------------|
| TK-Abmahnung | `Testkauf Abmahnung` |
| TK-Abrechnung | `Abrechnung` |
| TK-Beschwerde | `In Klärung / Beschwerde` |
| TK-Ergebnis nicht geprüft | `Testkaufergebnis nicht geprüft` |
| TK-Ergebnis geprüft | `Testkaufergebnis geprüft` |

### Ampelstatus-System

Der Ampelstatus (`STLGS_TestPurchaseStatus__c` am Account) wird über **Custom Metadata** (`STLGS_TestPurchaseStatusChanges__mdt`, 38 Records) konfiguriert und chronologisch über alle TKs berechnet.

**CMT-Struktur:**

| Feld | Beschreibung |
|------|-------------|
| `STLGS_InputStatus__c` | Aktueller Ampelstatus (26 Werte, siehe vollständige Übergangsmatrix unten) |
| `STLGS_OutputStatusPositive__c` | Neuer Status bei bestanden |
| `STLGS_OutputStatusNegative__c` | Neuer Status bei nicht bestanden |
| `STLGS_StoreType__c` | `all`, `legal person`, `natural person` |
| `STLGS_Warning__c` | Mahnstufe: `1. Abmahnung`, `2. Abmahnung`, `ern. 2 Abmahnung` oder leer |

**Betrachtungsweise (vertikale Ampel):**

```text
    ┌─────────┐
    │   rot    │  ← oben (_o = von oben kommend)
    ├─────────┤
    │  gelb   │
    ├─────────┤
    │  grün   │  ← unten (_u = von unten kommend)
    └─────────┘
```

**Suffixe in Status-Naming:**

- `_u` = **von unten** (von Grün kommend — Verschlechterung). Z.B. `gelb_u` = Gelb, kam von Grün nach erstem Verstoß
- `_o` = **von oben** (von Rot kommend, nach Nachschulung — Verbesserung). Z.B. `gelb_ox` = Gelb, kam von Rot nach Nachschulung
- `_x` = **Rot-Vorgeschichte** — Store war schon mal auf Rot. Z.B. `gelb_ox` = kam von Rot zurück, `gelb_ux` = war schon mal auf Rot und ist erneut von Grün gefallen
- `_y` = **Sperr-Vorgeschichte** — juristische Person war schon mal gesperrt. Z.B. `rot_y` = Rot nach Sperrung, `gelb_oy` = kam von Sperrung zurück
- `_1`, `_2` = Zähler bestandener Tests innerhalb einer Stufe (z.B. `gelb_u_1` = 1× bestanden auf Gelb von unten)

**Wichtig:** `_x` und `_y` haben **nichts mit dem Testkauf-Typ** (Jugendschutz/Spielerschutz) zu tun! Es macht keinen Unterschied ob Jugend- oder Spielerschutz nicht bestanden wird. Die Suffixe markieren die **Vorgeschichte** des Stores (war auf Rot vs. war gesperrt).

**Vollständige Ampelstatus-Übergangsmatrix (31 CMT-Records):**

#### Grün — Ausgangszustand

| Status | Bestanden → | Nicht bestanden → | StoreType | Mahnstufe |
|--------|-------------|-------------------|-----------|-----------|
| `gruen` | `gruen` | `gelb_u` | all | 1. Abmahnung |
| `gruen_x` | `gruen_x` | `gelb_ux` | all | 1. Abmahnung |
| `gruen_y` | `gruen_y` | `gelb_uy` | all | 1. Abmahnung |

> `gruen` = keine Vorgeschichte. `gruen_x` = Store war schon mal auf Rot und hat sich zurückgearbeitet. `gruen_y` = juristische Person war schon mal gesperrt und hat sich zurückgearbeitet. Bei erneutem Verstoß geht es in den jeweiligen Vorgeschichte-Pfad.

#### Gelb von unten (`gelb_u`) — erstmaliger Verstoß, von Grün kommend

| Status | Bestanden → | Nicht bestanden → | StoreType | Mahnstufe |
|--------|-------------|-------------------|-----------|-----------|
| `gelb_u` | `gelb_u_1` | `rot` | all | 2. Abmahnung |
| `gelb_u_1` | `gelb_u_2` | `rot` | all | 2. Abmahnung |
| `gelb_u_2` | `gruen` | `rot` | all | 2. Abmahnung |

> "Von unten" = Store kam von Grün nach Verstoß, keine Vorgeschichte. 3 bestandene Tests nötig um zurück auf `gruen` zu kommen: `gelb_u` → `gelb_u_1` → `gelb_u_2` → `gruen`. Bei jedem Nichtbestehen direkt auf `rot`.

#### Gelb von unten mit Rot-Vorgeschichte (`gelb_ux`) — erneuter Verstoß, Store war schon mal auf Rot

| Status | Bestanden → | Nicht bestanden → | StoreType | Mahnstufe |
|--------|-------------|-------------------|-----------|-----------|
| `gelb_ux` | `gelb_ux_1` | `rot_x` | all | 2. Abmahnung |
| `gelb_ux_1` | `gelb_ux_2` | `rot_x` | all | 2. Abmahnung |
| `gelb_ux_2` | `gruen_x` | `rot_x` | all | 2. Abmahnung |

> Gleiche Mechanik wie `gelb_u`, aber Vorgeschichte bleibt erhalten: Rückfall geht auf `rot_x`, Erholung auf `gruen_x`.

#### Gelb von unten mit Sperr-Vorgeschichte (`gelb_uy`) — erneuter Verstoß, jur. Person war schon mal gesperrt

| Status | Bestanden → | Nicht bestanden → | StoreType | Mahnstufe |
|--------|-------------|-------------------|-----------|-----------|
| `gelb_uy` | `gelb_uy_1` | `rot_y` | all | 2. Abmahnung |
| `gelb_uy_1` | `gelb_uy_2` | `rot_y` | all | 2. Abmahnung |
| `gelb_uy_2` | `gruen_y` | `rot_y` | all | 2. Abmahnung |

> Gleiche Mechanik, aber Rückfall geht auf `rot_y` (strenger — Nichtbestehen = immer Schließung).

#### Gelb von oben mit Rot-Vorgeschichte (`gelb_ox`) — von Rot kommend nach Nachschulung

| Status | Bestanden → | Nicht bestanden → | StoreType | Mahnstufe |
|--------|-------------|-------------------|-----------|-----------|
| `gelb_ox` | `gelb_ox_1` | `rot_x` | all | ern. 2 Abmahnung |
| `gelb_ox_1` | `gruen_x` | `rot_x` | all | ern. 2 Abmahnung |

> "Von oben" = Store kommt von Rot zurück nach Nachschulung. Nur 2 bestandene Tests nötig (statt 3), da bereits Nachschulung absolviert. Erholung führt auf `gruen_x` (Rot-Vorgeschichte bleibt).

#### Gelb von oben mit Sperr-Vorgeschichte (`gelb_oy`) — jur. Person kommt von Sperrung zurück

| Status | Bestanden → | Nicht bestanden → | StoreType | Mahnstufe |
|--------|-------------|-------------------|-----------|-----------|
| `gelb_oy` | `gelb_oy_1` | `rot_y` | all | ern. 2 Abmahnung |
| `gelb_oy_1` | `gruen_y` | `rot_y` | all | ern. 2 Abmahnung |

> Erholung führt auf `gruen_y` (Sperr-Vorgeschichte bleibt). Rückfall auf `rot_y` (strenger Pfad).

#### Rot — erstmalig, ab hier Unterscheidung juristisch/natürlich

| Status | Bestanden → | Nicht bestanden → | StoreType | Mahnstufe |
|--------|-------------|-------------------|-----------|-----------|
| `rot` | `rot_1` | `gesperrt` | legal person | — |
| `rot` | `rot_1` | `geschlossen` | natural person | — |
| `rot_1` | `gelb_ox` | `gesperrt` | legal person | — |
| `rot_1` | `gelb_ox` | `geschlossen` | natural person | — |

> **Juristische Personen:** Nicht bestanden → Sperrung (noch eine Chance). **Natürliche Personen:** Nicht bestanden → direkte Kündigung (geschlossen). Bei Bestehen → `gelb_ox` (Gelb von oben, mit Rot-Vorgeschichte).

#### Rot mit Rot-Vorgeschichte (`rot_x`) — Store war schon mal auf Rot

| Status | Bestanden → | Nicht bestanden → | StoreType | Mahnstufe |
|--------|-------------|-------------------|-----------|-----------|
| `rot_x` | `rot_x_1` | `gesperrt` | legal person | — |
| `rot_x` | `rot_x_1` | `geschlossen` | natural person | — |
| `rot_x_1` | `rot_x_2` | `gesperrt` | legal person | — |
| `rot_x_1` | `rot_x_2` | `geschlossen` | natural person | — |
| `rot_x_2` | `gelb_ox` | `gesperrt` | legal person | — |
| `rot_x_2` | `gelb_ox` | `geschlossen` | natural person | — |

> 3 bestandene Tests nötig um von `rot_x` zurück auf `gelb_ox` zu kommen (statt 2 bei erstmaligem `rot`). Wiederholungstäter brauchen länger.

#### Rot mit Sperr-Vorgeschichte (`rot_y`) — jur. Person war gesperrt, strengster Pfad

| Status | Bestanden → | Nicht bestanden → | StoreType | Mahnstufe |
|--------|-------------|-------------------|-----------|-----------|
| `rot_y` | `rot_y_1` | `geschlossen` | all | — |
| `rot_y_1` | `rot_y_2` | `geschlossen` | all | — |
| `rot_y_2` | `gelb_oy` | `geschlossen` | all | — |

> **Strengster Pfad:** Nicht bestanden → immer Schließung, unabhängig von der Rechtsform. Kein Umweg über Sperrung mehr. Store war bereits gesperrt und hat eine letzte Chance bekommen.

#### Gesperrt und Geschlossen — Endzustände

| Status | Bestanden → | Nicht bestanden → | StoreType | Mahnstufe |
|--------|-------------|-------------------|-----------|-----------|
| `gesperrt` | `rot_y` | `geschlossen` | all | — |
| `geschlossen` | `geschlossen` | `geschlossen` | all | — |

> `gesperrt` gibt es nur für juristische Personen. Bestanden führt auf `rot_y` (Sperr-Vorgeschichte) — der strengste Rot-Pfad. `geschlossen` ist ein Endzustand ohne Rückkehr.

**Zusammenfassung der Kernregeln:**
1. **Gelb von unten → Grün:** 3 bestandene Tests nötig (`_1`, `_2`, dann Grün)
2. **Gelb von oben → Grün:** Nur 2 bestandene Tests nötig (Nachschulung zählt als Bonus)
3. **Rot erstmalig → Gelb:** 2 bestandene Tests (→ `gelb_ox`)
4. **Rot mit Vorgeschichte (`rot_x`) → Gelb:** 3 bestandene Tests (Wiederholungstäter)
5. **Ab Rot: Rechtsform entscheidend** — juristische Personen → Sperrung, natürliche Personen → direkte Kündigung
6. **Sperr-Vorgeschichte (`_y`) ist der strengste Pfad:** Nichtbestehen = immer Schließung, egal welche Rechtsform
7. **Gesperrt → bestanden:** Führt auf `rot_y` (nicht Gelb!) — strengster Wiedereinstieg
8. **Vorgeschichte bleibt:** `_x` und `_y` werden nie zurückgesetzt. Ein Store der einmal auf Rot war bleibt auf dem `_x`-Pfad

### Wöchentliche Batch-Verarbeitung

**Klasse:** `STLGS_UpdateTestPurchaseBatch` (Scheduled via `STLGS_UpdateTestPurchaseScheduled`)

Verarbeitet wöchentlich alle TK-Cases mit Status "TK durchgeführt" aus der Vorwoche (Montag–Sonntag, `LAST_WEEK` in deutscher Locale).

**Filterlogik pro Account:**

| Cases/Account | Szenario | Bedingung | Modus |
|---------------|----------|-----------|-------|
| 1 | bestanden | in LAST_WEEK | Automatisch |
| 1 | nicht bestanden | — | Manuell |
| 1 | Nachschulung | — | Manuell (CRM-2497) |
| 2 | beide bestanden | beide in LAST_WEEK | Automatisch (beide) |
| 2 | Pos 0 bestanden, Pos 1 nicht | Pos 0 in LAST_WEEK | Pos 0 Automatisch, Pos 1 Manuell |
| 2 | Pos 1 bestanden, Pos 0 nicht/Fehlanf. | Pos 1 in LAST_WEEK | Manuell |
| 2 | Pos 1 bestanden, Pos 0 nicht in LAST_WEEK | — | Manuell |
| >2 | beliebig | — | Manuell (alle) |

- **Automatisch** = `nicht geprüft` → `geprüft` → `Abrechnung` (3 DML-Updates, triggert Ampelstatus-Neuberechnung)
- **Manuell** = `nicht geprüft` (1 DML-Update, dann manuelle Prüfung durch VO)

Cases werden pro Account nach `STLGS_TestPurchaseExecutionDate__c ASC` sortiert (Pos 0 = älter, Pos 1 = neuer).

### Nachtest-Erstellung (automatisch)

**Trigger:** Skyvva Outbound Job (täglich)

```sql
SELECT Id, Status, AccountId, STLGS_TypeTestPurchase__c, STLG_CaseStatusChangedAt__c
FROM Case
WHERE STLGS_ResultTestPurchase__c = 'nicht bestanden'
  AND Status = 'Abrechnung'
  AND STLG_CaseStatusChangedAt__c = N_DAYS_AGO:28
  AND Account.STLGS_StoreStatus__c != 'Löschbereit'
  AND Account.STLGS_StoreStatus__c != 'Geschlossen'
```

**Apex-Klasse:** `STLGS_SkyvvaCreateTestPurchaseReTests` (`beforeMapping()` Hook)
- Erstellt neuen Case mit `STLGS_KindTestPurchase__c = 'Nachtest'`, gleicher Account + gleicher Testkauftyp
- **Nachtest nach Nachtest:** Ja, Query filtert NICHT auf `KindTestPurchase`

**Downstream:** `STLGS_PresetTestPurchases` (Before Save Flow) weist Owner zu:
- Ersttest → Queue `STLGS_StandardTests` (Skopos)
- Nachtest → Queue `STLGS_Retests` (Auroma)

### Sonderfälle

- **Fehlanfahrt**: Agentur konnte nicht testen (geschlossen, Urlaub etc.) — VO entscheidet ob berechtigt
- **Nachschulung**: Freiwillig (bei Gelb → zurück auf Grün), Pflicht (bei Rot → zurück auf Gelb). Batch setzt diese immer auf "Manuell".
- **Annullieren**: Status → TK-Beschwerde → Ergebnis auf "annulliert" → TK-Ergebnis geprüft. **Wichtig**: Alle nachfolgenden TKs müssen chronologisch neu bewertet werden (Ampelstatus-Neuberechnung).
- **Untergeordnete Vorgänge (auto-generiert):**
  - **TK Schließung**: Auto-Kündigung bei Ampel = Geschlossen → Details siehe [kuendigung.md](kuendigung.md)
  - **TK Sperrung** (nur juristische Person): Auto-Sperrvorgang bei Ampel = Gesperrt, inkl. Sub-Case für "Filialverantwortung ändern" → Details siehe [filialverantwortung-wechseln.md](filialverantwortung-wechseln.md)

### Vertragsstrafe (VT-Strafe)

Die Vertragsstrafe wird bei nicht-bestandenen Testkäufen auf Basis der durchschnittlichen Wochenprovision der letzten 10 Wochen berechnet (Provisionsdaten stammen aus LIBS).

| Mahnstufe | Berechnung | Quelle |
|-----------|-----------|--------|
| 1. Abmahnung | 50% der durchschnittlichen Wochenprovision (letzte 10 Wochen) | CRM-1856 |
| 2. Abmahnung | 100% der durchschnittlichen Wochenprovision (letzte 10 Wochen) | CRM-1856 |
| Erneute 2. Abmahnung | 100% der durchschnittlichen Wochenprovision (letzte 10 Wochen) | CRM-1856 |

**Regeln:**
- **Obergrenze:** Max. 1.000€ pro Strafe (konfigurierbar als Feld `$Setup`-Parameter)
- **Kumulierung:** `STLGS_CurrentPenaltyCYTestPurchase__c` = kumulierte VT-Strafen des aktuellen Kalenderjahres
- **Einzugsdatum:** `STLGS_TestPurchasePenaltyDebitedOn__c` — darf beim Wechsel auf "TK Abmahnung" nicht in der Vergangenheit liegen (CRM-1918)
- **Annullierung:** Bei Annullierung eines TKs wird die zugehörige Strafe zurückgesetzt (CRM-1903)
- **Bestandener TK:** Felder "Einzug VT-Strafe" und "VT-Strafe" werden ausgeblendet; Statuswechsel auf "TK-Abmahnung" ist nicht erlaubt (CRM-2074)

### Sperr- und Kündigungsprozess (Kurzfassung)

Bei Ampelstatus-Wechsel auf Rot werden automatisch untergeordnete Vorgänge erstellt:

- **Natürliche Person → Schließung:** Ampel "geschlossen" → Auto-Kündigungsvorgang (Kündigungsdatum = nächster Samstag, Kündigung durch Lotto, Kündigungsgrund je nach TK-Typ JS/SP)
- **Juristische Person → 4-Wochen-Sperre:** Ampel "gesperrt" → Auto-Sperrvorgang mit `STLGS_StartLockOut__c` / `STLGS_EndLockOut__c`. Aufhebung durch bestandenen Sperr-TK → Ampelstatus wird auf `rot_y` gesetzt. Bei erneutem Nichtbestehen nach Sperre → Kündigung.
- **Kündigungsdokumente:** Erstellung über Vertragsabschluss-Tab am Antrag (nicht mehr am TK-Vorgang). 4 Quicktext-Varianten: nat./jur. × JS/SP.

Quellen: CRM-1985, CRM-1986, CRM-1988, CRM-1998, CRM-1999, CRM-2000, CRM-2001, CRM-2744, CRM-2750. Vollständige Prozessbeschreibung siehe [kuendigung.md](kuendigung.md), Abschnitt "TK-initiierte Kündigung".

## Business Rules

- **Quartalszuordnung:** Q1 = Jugendschutz + Spielerschutz (nur VAS), Q2/Q3 = nur Jugendschutz, Q4 = keine Tests
- **28-Tage-Frist Nachtest:** Exakt 28 Tage nach Wechsel auf Status "Abrechnung" wird automatisch ein Nachtest erstellt
- **Ampelstatus-Differenzierung juristische/natürliche Person:** Ab Stufe Rot unterschiedliche Konsequenzen (Sperrung vs. direkte Kündigung)
- **VT-Strafe aktuelles Jahr** = kumulierte Vertragsstrafen aus nicht bestandenen TKs
- **Chronologische Berechnung:** Ampelstatus wird immer über ALLE TKs chronologisch berechnet — bei Annullierung müssen nachfolgende TKs neu bewertet werden
- **Store-Filter:** Löschbereite und geschlossene Stores erhalten keine neuen Nachtests
- **Batch-Woche:** Montag bis Sonntag (deutsche Locale). Tests am Wochenende (Sa/So) werden erst in der Folgewoche verarbeitet.
- **Validierung Pflichtfelder:** Testkaufergebnis (`STLGS_ResultTestPurchase__c`) muss gesetzt sein vor Status "geprüft"
- **Ampel geschlossen → keine Abmahnung:** Ein TK mit Ampelstatus "geschlossen" kann nicht in den Status "TK-Abmahnung" gesetzt werden

## Technische Umsetzung

### Datenmodell

**Hauptobjekt:** Case (RecordType: `STLGS_TestPurchase`)

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_TypeTestPurchase__c` | Picklist | Testtyp: Jugendschutz, Spielerschutz |
| `STLGS_KindTestPurchase__c` | Picklist | Art: Ersttest, Nachtest, Nachschulung |
| `STLGS_ResultTestPurchase__c` | Picklist | Ergebnis: bestanden, nicht bestanden, annulliert, Fehlanfahrt |
| `STLGS_TestPurchaseExecutionDate__c` | Date | Durchführungsdatum |
| `STLGS_TestPurchaseExecutedAt__c` | Time | Uhrzeit der Durchführung (CRM-1773) |
| `STLGS_TestPurchaseStatus__c` | Text | Ampelstatus nach Berechnung |
| `STLGS_GameType__c` | Picklist | Spielart: Lotto, Keno, GlücksSpirale, EUROJACKPOT (aktiv); 20+ inaktive Werte (B-SAL, Bingo, ODDSET etc.) |
| `STLGS_PenaltyTestPurchase__c` | Currency | Vertragsstrafe dieses TK |
| `STLGS_CurrentPenaltyCYTestPurchase__c` | Currency | Kumulierte VT-Strafen aktuelles Kalenderjahr |
| `STLGS_TestPurchasePenaltyDebitedOn__c` | Date | Einzugsdatum VT-Strafe (History Tracking) |
| `STLGS_Warning__c` | Text | Mahnstufe (aus CMT) |
| `STLGS_TestPurchaseIsInELO__c` | Checkbox | TK-Abmahnung in ELO archiviert (CRM-2768) |
| `STLGS_BillingStatusDate__c` | DateTime | Datum Wechsel auf "Abrechnung" (für 28-Tage-Nachtest-Frist) |
| `STLG_CaseStatusChangedAt__c` | DateTime | Letzter Statuswechsel (wird bei JEDEM Wechsel überschrieben!) |
| `STLGS_StartLockOut__c` | Date | Beginn Sperre (am Sperr-Case, nur jur. Person) |
| `STLGS_EndLockOut__c` | Date | Ende Sperre (am Sperr-Case) |
| `STLGS_TestPurchaseStartLockout__c` | Formula (Date) | = `Parent.STLGS_StartLockOut__c` (am TK-Case, liest vom Sperr-Case) |
| `STLGS_TestPurchaseEndLockout__c` | Formula (Date) | = `Parent.STLGS_EndLockOut__c` (am TK-Case) |
| `STLGS_Type__c` | Picklist | = "Testkauf" |

**Account-Felder:**

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_TestPurchaseStatus__c` | Text | Aktueller Ampelstatus des Stores |
| `STLGS_StoreStatus__c` | Picklist | Store-Status (Betriebsbereit, Gesperrt, Löschbereit, Geschlossen) |
| `STLGS_SalesType__c` | Picklist | Vollannahmestelle / Lotto Kompakt |

### Automation

**Flows (10):**

| Flow | Typ | Zweck |
|------|-----|-------|
| `STLGS_CreateTestPurchase` | Autolaunched | TK-Cases erstellen (aus Batch) |
| `STLGS_CreateTestPurchaseScheduled` | Scheduled | Trigger für jährliche TK-Erstellung |
| `STLGS_PresetTestPurchases` | Before Save (Case) | Owner/Subject/Status automatisch setzen |
| `STLGS_CalculateTestPurchaseStatus` | Autolaunched | Ampelstatus berechnen (Hauptflow) |
| `STLGS_CalculateTestPurchaseStatusSub` | Subflow | Ampelstatus-Berechnung (Unterflow) |
| `STLGS_CancelTestPurchases` | Autolaunched | Testkäufe stornieren |
| `STLGS_ForwardTestPurchaseProtocol` | Autolaunched | TK-Protokoll an RD weiterleiten |
| `STLGS_TriggerTestPurchasePDFGeneration` | Autolaunched | PDF-Generierung auslösen |
| `STLGS_SetEndLockoutTestPurchase` | Autolaunched | Sperrung beenden |
| `STLGS_TestPurchaseDeleteFilesScheduled` | Scheduled | Alte Dateien aufräumen |

**Apex-Klassen (11, ohne Test-Klassen):**

| Klasse | Typ | Zweck |
|--------|-----|-------|
| `STLGS_CalculateTestPurchaseStatus` | Invocable | Ampelstatus berechnen (aufgerufen aus Flow) |
| `STLGS_CreateTestPurchaseBatch` | Batch | Jährliche TK-Cases für alle relevanten Stores erstellen |
| `STLGS_CreateTestPurchaseScheduled` | Schedulable | Wrapper für `CreateTestPurchaseBatch` |
| `STLGS_UpdateTestPurchaseBatch` | Batch | Wöchentliche Verarbeitung (Mo-So Vorwoche) |
| `STLGS_UpdateTestPurchaseScheduled` | Schedulable | Wrapper für `UpdateTestPurchaseBatch` |
| `STLGS_SkyvvaCreateTestPurchaseReTests` | Skyvva Hook | Nachtest-Erstellung (28 Tage nach Abrechnung) |
| `STLGS_TestPurchaseComparator` | Comparator | Sortierung nach `TestPurchaseExecutionDate` |
| `STLGS_TestPurchaseDocumentPDFController` | VF Controller | Abmahnungsdokument-PDF |
| `STLGS_TestPurchaseLockoutPDFController` | VF Controller | Sperrungs-PDF |
| `STLGS_TestPurchasePenaltyPDFController` | VF Controller | Vertragsstrafen-PDF |

**Manuelle Ausführung Batch:**
```apex
Database.executeBatch(new STLGS_UpdateTestPurchaseBatch(), 200);
Database.executeBatch(new STLGS_CreateTestPurchaseBatch(), 200);
```

**Validation Rules (7):**

| Rule | Zweck |
|------|-------|
| `STLGS_TestPurchaseMandatoryFields` | Testkaufergebnis muss gesetzt sein vor Status "geprüft" (CRM-1571) |
| `STLGS_TestPurchaseAmpelStatusGeschlossen` | Kein Wechsel auf TK-Abmahnung bei Ampel = geschlossen |
| `STLGS_TestPurchaseKindSperre` | Sperrung nur bei bestimmten TK-Arten |
| `STLGS_TestPurchasePassedWarning` | Warnung bei bestandenen TKs |
| `STLGS_TestPurchasePenaltyDebitedOn` | Abrechnungsdatum-Validierung |
| `STLGS_TestPurchaseStartLockout` | Sperrungsbeginn-Validierung |
| `STLGS_TestPurchaseWarning` | Abmahnungs-Validierung |

**VF Pages (PDF-Generierung):**

| Page | Zweck |
|------|-------|
| `STLGS_PDFGenerateTestPurchase` | Abmahnungsdokument |
| `STLGS_PDFGeneratePenaltyTestPurchase` | Vertragsstrafen-Dokument |
| `STLGS_TestPurchaseProtocolPDF` | TK-Protokoll (Desktop) |
| `STLGS_TestPurchaseProtocolPDFMobile` | TK-Protokoll (Mobil) |

**TK-Protokoll Details (CRM-2148):**

Das TK-Protokoll ist ein PDF-Dokument, das die RD auf Basis eines TK-Vorgangs erzeugen kann (Button am TK-Vorgang):
- **Inhalt:** TK-Vorgangsdaten (Daten aus dem Bereich Testkauf) + Accountname + Ampelstatus vor dem TK + allgemeine Beschreibung
- **TK-Historie:** Übersicht aller TK-Vorgänge der ASt (inkl. "TK durchgeführt" und "TK abgebrochen", nicht aber "TK beauftragt"), sortiert nach TK-Datum absteigend
- **Dateiname:** `<YYYY-MM-DD hh:mm>_<ASt-Nr>_<ASt-Name>_Testkauf-Protokoll_<TK-Typ>`
- **Layout:** Offizielles Erscheinungsbild mit Lotto-Logo und Fußleiste
- **Mobile:** Separate VF Page (`STLGS_TestPurchaseProtocolPDFMobile`) für mobile Nutzung

### Custom Metadata

**`STLGS_TestPurchaseRelevantStore__mdt` (7 Records):**

Definiert welche Regionaldirektionen TK-relevante Stores haben:

| Record | Label | StoreId |
|--------|-------|---------|
| `Toto_Lotto_RD_Mitte_GmbH` | Toto-Lotto RD Mitte GmbH | 200000 |
| `Toto_Lotto_RD_Nord_Ost_GmbH` | Toto-Lotto RD Nord-Ost GmbH | (300000+) |
| `Toto_Lotto_RD_Nord_West_GmbH` | Toto-Lotto RD Nord-West GmbH | (400000+) |
| `Toto_Lotto_RD_S_d_GmbH` | Toto-Lotto RD Süd GmbH | (500000+) |
| `Toto_Lotto_RD_S_d_Ost_GmbH` | Toto-Lotto RD Süd-Ost GmbH | (600000+) |
| `Toto_Lotto_RD_S_d_West_GmbH` | Toto-Lotto RD Süd-West GmbH | (700000+) |
| `Toto_Lotto_RD_Stuttgart_GmbH` | Toto-Lotto RD Stuttgart GmbH | (100000+) |

**`STLGS_TestPurchaseStatusChanges__mdt` (31 Records):**

Vollständige Ampelstatus-Übergangsmatrix — siehe Abschnitt "Ampelstatus-System" oben.

### Integrationen

**Skyvva (Middleware — Nachtest-Erstellung):**

- **Outbound Job:** Tägliche Query für Nachtest-Erstellung (28-Tage-Frist)
- **Apex Hook:** `STLGS_SkyvvaCreateTestPurchaseReTests.beforeMapping()`
- **Richtung:** Skyvva → Salesforce (Query + DML via Apex)

**Azure (TK-Agenturen — Beauftragung & Rückmeldung):**

- **SF → Azure** (2x täglich, z.B. 11:00 + 16:00):
  - TK-Vorgänge mit Status "TK beauftragt" oder "TK storniert"
  - Ersttest → Skopos-Tabelle (create/update)
  - Nachtest → Auroma-Tabelle (create/update)
  - Nachschulung / Sperre → aktuell **keine** Übertragung
  - Zusätzlich: ASt-Stammdaten, Öffnungszeiten, Urlaube/Schließzeiten
- **Azure → SF** (Rückmeldung nach Durchführung):
  - Setzt Status auf "TK durchgeführt"
  - Füllt: TK-Ergebnis (bestanden/nicht bestanden/Fehlanfahrt), TK-Datum, TK-Uhrzeit, ggf. Beleglink
  - Importstatus wird gesetzt
- **Quellen:** CRM-1508, CRM-1509, CRM-1768, CRM-1931, CRM-2357, CRM-2429

**ELO (Dokumentenarchivierung):**

- Checkbox `STLGS_TestPurchaseIsInELO__c` am TK-Vorgang
- Kennzeichnung: TK-Abmahnung wurde in ELO (DMS) abgelegt
- Editierbar durch VO in Listviews und Berichten
- Kein API-Sync — manueller Prozess
- Quelle: CRM-2768

## Konfiguration

- **Bypass:** `$Setup.STLG_BypassSwitch__c.STLG_ValidationRuleSwitch__c` — deaktiviert alle TK-Validation Rules
- **CMT `STLGS_TestPurchaseRelevantStore__mdt`:** Steuert welche RDs TK-relevante Stores haben (über StoreId-Ranges)
- **CMT `STLGS_TestPurchaseStatusChanges__mdt`:** Vollständige Ampelstatus-Übergangsmatrix — alle Regeln konfigurierbar ohne Code-Änderung
- **Queues:** `STLGS_StandardTests` (Skopos/Ersttest), `STLGS_Retests` (Auroma/Nachtest)
- **Scheduled Jobs:** `STLGS_CreateTestPurchaseScheduled` (jährlich), `STLGS_UpdateTestPurchaseScheduled` (wöchentlich), `STLGS_TestPurchaseDeleteFilesScheduled` (Dateibereinigung)

## Bekannte Probleme & Workarounds

### Bug: Fehlende Nachtests durch `STLG_CaseStatusChangedAt__c` (behoben)

**Problem:** Das Feld `STLG_CaseStatusChangedAt__c` wird bei **jedem** Statuswechsel überschrieben — nicht nur beim Wechsel auf "Abrechnung". Wenn ein Case nach "Abrechnung" auf "Geschlossen" wechselt, wird der Timestamp aktualisiert und die Skyvva-Query (`N_DAYS_AGO:28`) findet den Case nicht mehr.

**Fix:** Neues dediziertes Feld `STLGS_BillingStatusDate__c` (DateTime), das einmalig bei Wechsel auf "Abrechnung" gesetzt wird (Before Save Flow mit NULL-Prüfung). Skyvva-Query auf dieses Feld umgestellt.

**Status:** Fix deployed in Production. Für nicht-bestandene TKs ab 2026 wird `STLGS_BillingStatusDate__c` korrekt befüllt. **Offen:** 55 nicht-bestandene TKs aus 2025 haben noch keine nachträglich erstellten Nachtest-Vorgänge erhalten. Siehe `business/docs/TK/Fix-TK-Nachtest-Skyvva-Query.md`.

### Code-Qualität: Skyvva-Klasse

- `STLGS_SkyvvaCreateTestPurchaseReTests`: Variable `accMap` (Account OwnerId) wird abgefragt aber **nie verwendet** → toter Code
- Error-Logger referenziert fälschlicherweise "DeleteInactivecases" statt "CreateTestPurchaseReTests" → Copy-Paste-Fehler

### Bug: Bestandener TK triggert Kündigungsvorgang (behoben)

**Problem:** Wenn der Ampelstatus einer ASt bereits "geschlossen" war und ein weiterer TK **bestanden** wurde, erstellte der Flow `STLGS_CalculateTestPurchaseStatus` fälschlicherweise einen Kündigungsvorgang. Der Flow prüfte nur ob Ampelstatus = "geschlossen", nicht ob das TK-Ergebnis "nicht bestanden" war.

**Fallbeispiel:** Account 210460 — TK 04.02.2026 (Ersttest JS) nicht bestanden → korrekte Kündigung. TK 07.02.2026 (Nachtest SP) **bestanden** → fehlerhafte Kündigung.

**Fix:** Zusätzliche Prüfung auf TK-Ergebnis = "nicht bestanden" im Flow.

**Quelle:** CRM-3003 (Fertig)

### Bug: Keine TK-Nachtests angelegt (behoben)

**Problem:** Nach dem Fix für `STLGS_BillingStatusDate__c` wurden zeitweise keine Nachtests mehr angelegt.

**Quelle:** CRM-3016 (Fertig)

### Bug: TK angelegt bei Wechsel Gesperrt→Betriebsbereit (behoben)

**Problem:** Bei Statuswechsel einer ASt von "Gesperrt" auf "Betriebsbereit" wurde ein neuer TK-Vorgang angelegt, obwohl dies nicht gewünscht war.

**Quelle:** CRM-2537 (Fertig)

### Bug: Falscher Ampelstatus bei Annullierung (behoben)

**Problem:** Wenn der aktuellste TK annulliert wurde, wurde der Ampelstatus am Account nicht korrekt neu berechnet.

**Quelle:** CRM-1904 (Fertig)

### Offene / Geplante Tickets

| Ticket | Status | Beschreibung |
|--------|--------|-------------|
| CRM-2987 | Backlog | Abmahndokumente nachträglich erstellen |
| CRM-2976 | In Arbeit | Monitoring Sperrcases mit TK-Datum Ende Sperre |
| CRM-2888 | Next | Branche + Vertriebslinie in ASt-Stammdaten für TK-Agentur |
| CRM-2623 | Backlog | Scheduling Verarbeitung TK-Ergebnisse |
| CRM-2388 | Backlog | Stornierte TK in der DB löschen |
| CRM-1508 | In Arbeit | TK Integration Azure (Gesamtintegration) |

### Technische Schulden

- **Kein LWC für TK-Übersicht:** Gesamte TK-Verwaltung läuft über Standard-Case-Layout + VF-Pages für PDFs. Kein dediziertes UI-Komponent.
- **VF Pages für PDFs:** 4 separate Visualforce Pages mit Apex Controllern statt einer einheitlichen PDF-Engine. Mobile-Variante existiert separat.
- **Ampelstatus-Berechnung in zwei Flows:** `CalculateTestPurchaseStatus` + `CalculateTestPurchaseStatusSub` — Aufspaltung deutet auf Komplexität hin, die in einem einzelnen Flow nicht handhabbar war.

## Referenzen

### Jira (~100 Stories, gruppiert nach Themenbereich)

**Case Management & Grundlagen:**
CRM-1445 (Case Management), CRM-1446 (Vorgang Testkauf), CRM-1447 (Case Status), CRM-1448 (Case manuell anlegen), CRM-1449 (Case automatisch anlegen), CRM-1514 (Case creation trigger), CRM-1452 (Migration), CRM-1763 (Button fehlt), CRM-1924 (Status-Bezeichnungen), CRM-1950 (Betreff ohne Execution Date), CRM-1977 (Nachschulung Jahr im Betreff), CRM-1979 (Reihenfolge Status), CRM-1980 (Layout Felder), CRM-1981 (keine auto TK für RD), CRM-1982 (Create Screen), CRM-1983 (TK History), CRM-2297 (Ampel-Label "gesperrt/geschlossen"), CRM-2395 (TK Abgebrochen Groß/Klein), CRM-2413 (Ausweiskontrolle→Spielerschutz), CRM-2459 (Is TK Checked)

**Ampellogik:**
CRM-1451 (Testkaufstatus Ampellogik — Epic), CRM-1535 (Implementierung Ampellogik), CRM-1904 (falscher Ampelstatus bei Annullierung), CRM-1907 (TK-Status nicht korrekt berechnet)

**Ergebnisverarbeitung (Batch):**
CRM-1867 (TK Ergebnisse verarbeiten), CRM-2116 (zusammengeführt mit 1867), CRM-2497 (Nachschulung immer manuell), CRM-2715 (Nachschulung erst bei wöchentl. Verarbeitung), CRM-2241 (TK bleibt im Status "durchgeführt"), CRM-2623 (Scheduling — Backlog)

**Nachtests:**
CRM-1450 (Nachtests anlegen), CRM-2195 (Nachtest V2 — reverted), CRM-2298 (fehlende TK-Vorgänge), CRM-2537 (TK bei Gesperrt→Betriebsbereit), CRM-2619 (Zuweisung über Warteschlange statt Ersttest/Nachtest), CRM-3016 (keine Nachtests angelegt)

**Strafen & Abmahnung:**
CRM-1856 (Strafen & Abmahnung — Epic), CRM-1888 (Einzug VT-Strafe), CRM-1894 (Abmahndokument bei Status TK-Abmahnung), CRM-1903 (Strafe falsch bei Annullierung), CRM-1917 (Strafe anzeigen), CRM-1918 (Einzugsdatum nicht in Vergangenheit), CRM-1919 (Strafe falsch berechnet), CRM-1935 (Validierung Ergebnis), CRM-1945 (VT-Strafe aktuelles Jahr), CRM-2074 (bestanden → Felder ausblenden), CRM-2295 (doppelter Bindestrich 2. Abmahnung), CRM-2710 (Abmahn+Sperr-Schreiben via Quicktexte), CRM-2768 (ELO-Checkbox), CRM-2837 (Prozess Erstellung anpassen), CRM-2969 (3 Nachkommastellen VT-Strafe), CRM-2987 (nachträglich erstellen — Backlog)

**Kündigung & Sperre:**
CRM-1862 (nat. Person Kündigung), CRM-1985 (nat. Person → Schließung), CRM-1986 (jur. Person → 4-Wochen-Sperre + Kündigung), CRM-1988 (Sperrlogik), CRM-1998 (Sperr-TK Typ), CRM-1999 (Rückwärtslogik Sperre), CRM-2000 (Kündigungsvorgang erstellen), CRM-2001 (Kündigungsfelder), CRM-2051 (Validierungen Ampelstatus gesperrt/geschlossen), CRM-2206 (Beginn/Ende Sperre für RD), CRM-2307 (Kündigungsgrund Spielerschutz), CRM-2610 (Kündigung über Events), CRM-2737 (Kündigungsgrund VO/RD unterschiedlich), CRM-2744 (Kündigungsgrund Picklist), CRM-2750 (Umstellung Kündigungsdokumente via Quicktexte), CRM-2754 (Quicktext nat.P. JS), CRM-2755 (Quicktext nat.P. SP), CRM-2756 (Quicktext jur.P. JS), CRM-2757 (Quicktext jur.P. SP), CRM-2765 (Unterschrift), CRM-2820 (Anpassung Trigger Kündigung), CRM-2838 (Quicktexte Anpassungen), CRM-2898 (TK-Datum Sperre anpassen), CRM-2976 (Monitoring Sperrcases — In Arbeit), CRM-3003 (bestandener TK triggert Kündigung)

**Schnittstelle (Azure / Skyvva):**
CRM-1325 (Azure Tabellen), CRM-1508 (TK Integration Azure — In Arbeit), CRM-1509 (Rückmeldung), CRM-1768 (Schnittstelle), CRM-1931 (Sync), CRM-2357 (Anpassung neues Feld), CRM-2429 (falscher game_type), CRM-2465 (Sync Schedule — abgebrochen), CRM-2861 (SPQ Auroma), CRM-2888 (Branche + Vertriebslinie — Next)

**Dokumente & Protokoll:**
CRM-1571 (Validation Rule Pflichtfelder), CRM-1799 (Spiele-Felder), CRM-1816 (GameType Werte), CRM-1920 (Spielarten einschränken), CRM-1927 (Abmahndokument Kontaktdaten), CRM-2148 (TK Protokoll), CRM-2327 (Mobile Button blau), CRM-2328 (Belege anzeigen), CRM-2352 (Löschen TK-Dokumente nach 2 Monaten), CRM-2437 (Löschvorgang prüfen), CRM-2549 (erneute Prüfung Löschlogik)

**Nachschulung:**
CRM-1521 (Schulung als TK-Art), CRM-2469 (Nachschulung durch RD anlegen), CRM-2615 (Nachschulung TK-Uhrzeit), CRM-2622 (Clone Nachschulung)

**Berichte & Quoten:**
CRM-2829 (SPQ), CRM-2872 (TK-Quoten separat), CRM-3031 (Spielerschutz Darstellung prüfen)

### Confluence

- [Testkauf](https://kommit.atlassian.net/wiki/spaces/SLI/pages/1133215745) — Hauptseite TK-Prozess (Case Management, Ampellogik, Nachtests, Schnittstelle)
- [Entwurf: Testkauf im CRM und Ampellogik](https://kommit.atlassian.net/wiki/spaces/SLI/pages/1710653442) — Umfassender Entwurf mit allen Jira-Quellen
- [Abmahnung und Strafe](https://kommit.atlassian.net/wiki/spaces/SLI/pages/1362493441) — Testszenarien für Abmahnung, Annullierung, Schließung
- [Testkaufstatus](https://kommit.atlassian.net/wiki/spaces/SLI/pages/1258061833) — Ampellogik Visualisierung

### Codebase

**Flows:** `force-app/main/default/flows/STLGS_*TestPurchase*` (10 Flows)
**Apex:** `force-app/main/default/classes/STLGS_*TestPurchase*` (11 Klassen + 6 Test-Klassen)
**CMT:** `force-app/main/default/customMetadata/STLGS_TestPurchase*` (45 Records)
**VF Pages:** `force-app/main/default/pages/STLGS_*TestPurchase*` (4 Pages)
**Validation Rules:** `force-app/main/default/objects/Case/validationRules/STLGS_TestPurchase*` (7 Rules)

### Lokale Dokumentation

- `business/docs/TK/Notiz-TK-Nachtest-Klaerung.md` — Nachtest-Architektur (Skyvva + Apex + Flow)
- `business/docs/TK/Fix-TK-Nachtest-Skyvva-Query.md` — Bug-Analyse fehlende Nachtests + Fix-Vorschlag
- `business/docs/TK/TK-Batch-Simulation-2026-02-18.md` — Batch-Simulation mit 157 Cases

## Änderungshistorie

| Datum | Änderung | Quelle |
|-------|----------|--------|
| 2026-02-20 | Initiale Erstellung | Codebase-Analyse (10 Flows, 11 Apex, 45 CMT, 7 VR), domain-knowledge.md, 3 lokale TK-Docs |
| 2026-02-20 | Jira/Confluence-Ergänzung | ~100 Jira-Stories + 4 Confluence-Seiten: Vertragsstrafe-Logik, Sperr-/Kündigungsprozess, Datenmodell (10 neue Felder, 1 Korrektur), Betreff-Logik, TK-Protokoll-Details, Azure-Schnittstelle, ELO-Integration, 4 zusätzliche Bugs, offene Tickets, vollständige Jira-Referenzliste |
| 2026-02-20 | Cross-Reference ergänzt | Verweis auf besuche.md (TK-Auffälligkeiten als Besuchsanlass) |
| 2026-02-20 | Cross-Reference ergänzt | Verweis auf pflichtschulung.md (Nachschulung TK vs. Pflichtschulung) |
