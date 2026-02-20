# Besuche & Besuchsberichte — Domain Knowledge

> Letzte Aktualisierung: 2026-02-20 | Quellen: 17 Jira-Stories, 10 Flows, 5 Confluence-Seiten, 1 Knowledge Article

## Überblick

Der Außendienst (Regionaldirektion) besucht Annahmestellen regelmäßig vor Ort. Besuche werden als **Events** im Salesforce-Kalender geplant und durchgeführt. Aus einem Event kann ein **Besuchsbericht** (`STLGS_VisitReport__c`) generiert werden, der die Ergebnisse des Besuchs dokumentiert — von Umsatzdaten über Erscheinungsbild bis hin zu Spielerschutz-Compliance. Jede Annahmestelle hat ein **Zielbesuche-Kontingent** pro Jahr, das segmentabhängig ist. Ein visueller Indikator am Account zeigt, ob die ASt auf Kurs liegt oder hinterherhinkt.

Siehe auch: [docs/testkauf.md](testkauf.md) — TK-Ergebnisse als Besuchsanlass, [docs/antrag.md](antrag.md) — Antragsbesuch als Besuchstyp

## Geschäftsprozess

### Besuchsplanung

- Jede ASt hat ein Zielbesuche-Kontingent pro Jahr, gesteuert durch das Segment:

| Segment | Zielbesuche/Jahr |
|---------|-----------------|
| N (Neu) | 8 |
| A | 8 |
| B | 6 |
| C | 4 |
| D | 4 |
| E | 4 |

- **Neue ASten** erhalten zusätzlich quartalsweise Pflichtbesuche (Flow `STLGS_SetStoreVisits`)
- Priorisierung: Onboarding-ASten, TK-Auffälligkeiten (Ampelstatus), Umsatzentwicklung, reguläre Besuchsintervalle
- **Salesforce Maps** zeigt nahegelegene ASten, die ebenfalls Besuche brauchen (Routenoptimierung)

### Besuchsdurchführung

1. Außendienstmitarbeiter erstellt einen **Event** (Termin) an der Annahmestelle
2. Event-Typ wird gewählt (Regelbesuch, Umsatzgespräch, Prüfbesuch etc.)
3. Event wird einem **Kontakt** (Ansprechpartner) an der ASt zugeordnet
4. Besuch wird durchgeführt — Daten werden vor Ort oder im Nachgang erfasst
5. Aus dem Event wird über die LWC-Komponente `stlgs_createVisit` ein **Besuchsbericht** erstellt
6. Bei **Prüfbesuchen** wird der Besuchsbericht automatisch per Flow erstellt (ohne LWC-Klick)

### Besuchstypen

| Typ (API-Wert) | Beschreibung |
|-----------------|-------------|
| `Regelbesuch` | Standardmäßiger, geplanter Besuch |
| `Prüfbesuch` | Formeller Inspektionsbesuch — Pflichtfelder, Ergebnis-Dokumentation, PDF-Generierung |
| `Antragsbesuch` | Besuch im Rahmen eines Antragsverfahrens — löst Antragsprozess aus, kein Besuchsbericht |
| `Umsatzgespräch` | Umsatzbezogener Besuch — Umsatzdaten, Potentialerreichung, Maßnahmen; generiert PDF für ASt-Leiter |
| `Spontanbesuch` | Ungeplanter Besuch |
| `Expansion` | Besuch bei potentiellen neuen Standorten |
| `Schwerpunktbesuch` | Priorisierter Besuch zu einem bestimmten Thema — einfaches Freitextfeld |
| `Erstbesuch AD Zentrale` | Erstbesuch durch die Zentrale (Müllner/Schoor) — Read-Only für RD |

### Besuchsbericht Status-Flow

```text
Neu → Prüfbesuch vorbereiten → Freigabe Regionaldirektor → An Zentrale übergeben → Abgeschlossen
                                                                                  → Abgebrochen
```

- **Neu**: Besuchsbericht erstellt, noch nicht bearbeitet
- **Prüfbesuch vorbereiten**: RD füllt Prüffelder aus
- **Freigabe Regionaldirektor**: Regionaldirektor gibt Bericht frei
- **An Zentrale übergeben**: Bericht bei VO zur Prüfung (Pflichtfelder-Validierung greift)
- **Abgeschlossen**: Bericht finalisiert
- **Abgebrochen**: Bericht verworfen

### Besuchsprotokoll (Visit Protocol)

Bei jedem Besuch (Event oder Task) können 6 Prüfpunkte bestätigt werden. Für jeden bestätigten Punkt wird ein Timestamp am Account gesetzt:

- Vertragsrelevante Daten geprüft
- Vertriebsrelevante Daten geprüft
- Kontaktperson geprüft
- Öffnungszeiten geprüft
- Öffentliche Daten geprüft
- Terminallaufzeiten geprüft

Die Flows `STLGS_UpdateVisitProtocolOnAccountFromEvent` und `STLGS_UpdateVisitProtocolOnAccountFromTask` aktualisieren die Timestamps wenn alle 6 Checkboxen `true` sind.

### PDF-Generierung

| PDF-Typ | Controller | Auslöser |
|---------|-----------|----------|
| Standard-Besuchsbericht | `STLGS_PDFVisitController` | Manuell (Visualforce Page) |
| Umsatzbesuch-Protokoll | `STLGS_RevenueVisitPDFController` | Generiert und hängt PDF an Event an |
| Probezeit-End-Besuch-Protokoll | `STLGS_TrialEndVisitPDFController` | Generiert und hängt PDF an Event an |

## Business Rules

- **Zielbesuche pro Segment**: N=8, A=8, B=6, C=4, D=4, E=4 (Flow `STLGS_SetStoreVisits` setzt `STLGS_MinimumVisits__c`)
- **Pflichtfelder bei Prüfbesuch**: Wenn Type = "Prüfbesuch" UND Status = "An Zentrale übergeben" → 15 Felder müssen ausgefüllt sein (Validation Rule `STLGS_MandatoryReportFields`): Bewertung Werbung, Kundenfreundlichkeit, Technische Abwicklung, ASt-Leiter arbeitet, Prüfergebnis, Durchschnittsumsatz 10 Wochen, Umsatzprognose, Losumsatz, Bemerkungen Umsatz, Spielerschutz-Eigenschaften, Erscheinungsbild außen/innen, Bemerkungen außen/innen, Schulungsbedarf
- **Besuchsbericht nur aus Event**: Ein Besuchsbericht kann nur aus einem bestehenden Event erstellt werden (LWC `stlgs_createVisit` ruft Event-Daten ab)
- **Besuchszähler-Reset**: Zum Jahresbeginn werden `STLGS_ActualNumberVisits__c` per Batch zurückgesetzt (`STLGS_ResetActualVisitsOfYearBatch`), Segment-N-Stores erhalten `STLGS_MinimumVisits__c = 8` (`STLGS_ResetStoreVisitsStartOfYear`)
- **Besuche zählen nur bei betriebsbereiten ASten**: Count-Flows filtern auf `STLGS_StoreStatus__c = 'Betriebsbereit'`
- **Prüfbesuch auto-erstellt**: Flow `STLGS_CreateVisitReportEvent` erstellt automatisch einen VisitReport wenn Event-Typ = "Prüfbesuch"
- **Zentrale-Besuche read-only**: Besuchsberichte vom Typ "Erstbesuch AD Zentrale" (Record Type `STLGS_ReadOnlyReport`) sind für RD-Mitarbeiter nicht editierbar

## Technische Umsetzung

### Datenmodell

**Objekt:** `STLGS_VisitReport__c` (Master-Detail zu Account)

| Feld (API-Name) | Typ | Beschreibung |
|------------------|-----|-------------|
| `STLGS_Account__c` | Master-Detail(Account) | Zugehörige Annahmestelle |
| `STLGS_Type__c` | Picklist (Global: STLGS_EventType) | Besuchstyp (8 Werte, siehe Geschäftsprozess) |
| `STLGS_Status__c` | Picklist | Besuchsbericht-Status (6 Werte, siehe Status-Flow) |
| `STLGS_EventId__c` | Lookup(Event) | Verknüpftes Kalender-Event |
| `STLGS_DueDate__c` | Date | Fälligkeitsdatum |
| `STLGS_Description__c` | Text | Beschreibung/Notizen |
| `STLGS_RegionalDirectorate__c` | Lookup/Text | Regionaldirektion |
| `STLGS_ResultAuditReport__c` | Picklist | Prüfergebnis (4 Werte) |
| `STLGS_WeeklyTurnover__c` | Currency | Wochenumsatz |
| `STLGS_LotTurnover__c` | Currency | Losumsatz |
| `STLGS_AverageWeeklyTurnover10Weeks__c` | Currency | Durchschnitt Wochenumsatz (10 Wochen) |
| `STLGS_TurnoverForecastNext6__c` | Picklist | Umsatzprognose nächste 6 Monate (5 Werte) |
| `STLGS_PropertiesAppearanceInside__c` | Multi-Select Picklist | Erscheinungsbild innen (5 Checkpunkte) |
| `STLGS_PropertiesAppearanceOutside__c` | Multi-Select Picklist | Erscheinungsbild außen (4 Checkpunkte) |
| `STLGS_RatingAppearanceInside__c` | Picklist | Bewertung innen (Schulnoten-Skala) |
| `STLGS_RatingAppearanceOutside__c` | Picklist | Bewertung außen (Schulnoten-Skala) |
| `STLGS_RemarksAppearanceInside__c` | Long Text | Bemerkungen innen |
| `STLGS_RemarksAppearanceOutside__c` | Long Text | Bemerkungen außen |
| `STLGS_RatingPositioningAdvertisment__c` | Picklist | Bewertung Werbemittel-Platzierung (Schulnoten-Skala) |
| `STLGS_PropertiesPlayerProtection__c` | Multi-Select Picklist | Spielerschutz-Checkpunkte (5 Checkpunkte) |
| `Customer_Friendlieness__c` | Picklist | Kundenfreundlichkeit (Schulnoten-Skala) |
| `STLGS_TechnicalProcessing__c` | Picklist | Technische Abwicklung (Schulnoten-Skala) |
| `STLGS_AccountLeadWorking__c` | Picklist | ASt-Leiter arbeitet selbst? (Ja/Nein) |
| `STLGS_IsAccountLeadWorking__c` | Checkbox | ASt-Leiter anwesend |
| `STLGS_EconomicSituation__c` | Text | Wirtschaftliche Situation |
| `STLGS_StorePotential__c` | Text | Standort-Potential |
| `STLGS_IsTrainingNeeded__c` | Picklist | Schulungsbedarf (Ja/Nein) |
| `STLGS_IsConfirmedByRD__c` | Checkbox | Vom RD bestätigt |
| `STLGS_IsELearningCompleted__c` | Checkbox | E-Learning abgeschlossen |
| `STLGS_ReveneMeasures__c` | Text | Umsatzmaßnahmen |
| `STLGS_StoreTaxNumber__c` | Text | Steuernummer der ASt |

**Picklist-Werte (Bewertungs-Skala, verwendet bei 5 Feldern):** Sehr gut, Gut, Befriedigend, Ausreichend, Mangelhaft, Ungenügend

**Picklist-Werte `STLGS_ResultAuditReport__c`:** Standort behalten, entspricht Anforderungen, Probezeit soll verlängert werden, Bedenken gg. Weiterführung

**Picklist-Werte `STLGS_TurnoverForecastNext6__c`:** steigend, leicht steigend, gleichbleibend, leicht sinkend, sinkend

**Picklist-Werte `STLGS_PropertiesAppearanceInside__c`:** Kundendisplay gut sichtbar platziert, Spielscheine liegen aus, Teilnahmebedingungen liegen aus, Terminal gut sichtbar platziert, glüXmagazin liegt aus

**Picklist-Werte `STLGS_PropertiesAppearanceOutside__c`:** Annahmestelle erkennbar, Ausreichend Werbefläche vorhanden, Fernwirkung vorhanden, Plakatwerbung aktuell

**Picklist-Werte `STLGS_PropertiesPlayerProtection__c`:** Flyer Spielsucht liegt aus, Jugendschutz Vorgaben bekannt, Lizenzschild nach Vorgabe, Spielerschutz Vorgaben bekannt, Zweitplatzierung vorhanden und aktuell

**Record Types:**

| Record Type (API-Name) | Beschreibung |
|------------------------|-------------|
| `STLGS_StandardVisitReport` | Standard-Besuchsbericht — alle Felder editierbar, alle Besuchstypen verfügbar |
| `STLGS_Report` | Bericht (eingeschränkt) |
| `STLGS_ReadOnlyReport` | Read-Only — für Zentrale-Besuche, RD kann nicht editieren |

**Account-Felder (Besuchszählung):**

| Feld (API-Name) | Typ | Beschreibung |
|------------------|-----|-------------|
| `STLGS_ActualNumberVisits__c` | Number(3,0) | Tatsächliche Anzahl Besuche im laufenden Jahr |
| `STLGS_MinimumVisits__c` | Number(3,0) | Zielbesuche pro Jahr (segmentabhängig) |
| `STLGS_DifferenceNoVisits__c` | Formula(Text) | Differenz Ist/Soll mit visuellem Indikator (grün ✓ / rot ✗) |

**Activity-Feld:**

| Feld (API-Name) | Typ | Beschreibung |
|------------------|-----|-------------|
| `STLGS_IsWhatIdAVisitReport__c` | Formula(Checkbox) | Prüft ob WhatId auf einen VisitReport zeigt (Prefix `a29`) |

**Case-Feld:**

| Feld (API-Name) | Typ | Beschreibung |
|------------------|-----|-------------|
| `STLGS_Visit__c` | Lookup(STLGS_Visit__c) | Verknüpft Bestellungs-Cases mit Besuchen (Lookup-Filter: Type = "Bestellungen") |

### Automation

| Flow / Komponente | Typ | Zweck |
|-------------------|-----|-------|
| `STLGS_SetStoreVisits` | Before Save (Account) | Setzt Zielbesuche (`STLGS_MinimumVisits__c`) basierend auf Segment + Quartalsziele für neue ASten |
| `STLGS_CountStoreVisits` | Autolaunched (Subflow) | Zählt Events im laufenden Jahr, aktualisiert `STLGS_ActualNumberVisits__c` am Account |
| `STLGS_CountStoreVisitsOnCreate` | After Save (Event) | Ruft `STLGS_CountStoreVisits` bei Event-Erstellung/-Änderung auf |
| `STLGS_CountStoreVisitsOnDelete` | Before Delete (Event) | Ruft Count-Logik vor Event-Löschung mit Malus-Anpassung auf |
| `STLGS_CreateVisitReportEvent` | After Save (Event) | Erstellt automatisch VisitReport wenn Event-Typ = "Prüfbesuch" |
| `STLGS_LinkEventVisitReport` | After Save (VisitReport) | Setzt `WhatId` am verknüpften Event auf den VisitReport |
| `STLGS_UpdateVisitProtocol` | Autolaunched (Subflow) | Setzt Protokoll-Timestamps am Account (6 Checkpunkte) |
| `STLGS_UpdateVisitProtocolOnAccount` | After Save (Event) | Veraltet — aktualisiert Visit-Protokoll-Timestamps |
| `STLGS_UpdateVisitProtocolOnAccountFromEvent` | After Save (Event) | Aktualisiert Visit-Protokoll wenn alle 6 Checkboxen = true |
| `STLGS_UpdateVisitProtocolOnAccountFromTask` | After Save (Task) | Aktualisiert Visit-Protokoll von Tasks wenn alle 6 Checkboxen = true |
| `STLGS_ResetActualVisitsOfYearBatch` | Batch Apex | Setzt Besuchszähler zurück zum Jahresbeginn (ruft CountStoreVisits-Flow auf) |
| `STLGS_ResetStoreVisitsStartOfYear` | Batch Apex (Stateful) | Setzt `MinimumVisits = 8` für Segment-N-Stores zum Jahresbeginn |
| `STLGS_ResetActualVisitsSOYScheduled` | Scheduled Apex | Scheduler für ResetActualVisitsOfYearBatch |
| `STLGS_ResetStoreVisitsSOYScheduled` | Scheduled Apex | Scheduler für ResetStoreVisitsStartOfYear |
| `STLGS_CreateVisitController` | Apex Controller | `getEventRecord()` — liefert Event-Daten für LWC (mit `WITH SECURITY_ENFORCED`) |
| `STLGS_PDFVisitController` | VF Controller | Generiert Standard-Besuchsbericht-PDF mit Store-, Event- und Personaldaten |
| `STLGS_RevenueVisitPDFController` | Apex Controller | Generiert Umsatzbesuch-PDF und hängt es als Attachment an Event an |
| `STLGS_TrialEndVisitPDFController` | Apex Controller | Generiert Probezeit-End-PDF und hängt es als Attachment an Event an |
| `stlgs_createVisit` | LWC | Erstellt VisitReport aus Event — lädt Event-Daten, bestimmt Record Type, navigiert zum Create-Formular. Abonniert Platform Event `STLGS_EventUpdated__e` |

### Integrationen

- **Platform Event `STLGS_EventUpdated__e`**: LWC `stlgs_createVisit` abonniert Updates über EMP API für Echtzeit-Aktualisierung
- **Salesforce Maps**: Routenplanung und Priorisierung für Außendienst-Besuche (kein Custom Code, deklarative Konfiguration)
- **Salesforce Calendar**: Events werden im Standard-Kalender angezeigt; Outlook-Sync derzeit nicht aktiv

## Konfiguration

| Konfiguration | Details |
|---------------|---------|
| Scheduled Job | `STLGS_ResetActualVisitsSOYScheduled` — Jahresbeginn, setzt Besuchszähler zurück |
| Scheduled Job | `STLGS_ResetStoreVisitsSOYScheduled` — Jahresbeginn, setzt Zielbesuche für Segment N |
| Permission Set | `STLGS_Sales` — Apex-Zugriff auf `STLGS_CreateVisitController`, `STLGS_PDFVisitController` |
| Tab | `STLGS_Visit__c` — Custom Tab "Besuchsberichte" (Icon: Custom14 / Hands) |
| FlexiPage | `STLGS_VisitRecordPage` — Record Page für Besuchsberichte |
| Page Layout | `STLGS_VisitReport__c-Visit Layout` — Layout mit Highlights Panel, Edit/Delete/FeedItem Actions |
| Global Picklist | `STLGS_EventType` (restricted) — gemeinsame Picklist für Event-Typ und VisitReport-Typ |

## Bekannte Probleme & Workarounds

- **CRM-2890 (gefixt in v1.10.2):** `STLGS_ActualNumberVisits__c` wurde zum Jahreswechsel nicht zurückgesetzt. Root Cause: Batch-Job hat nicht gegriffen. Fix: Batch-Logik korrigiert.
- **CRM-905 (gefixt):** Falsche Checkboxen bei Besuchserfassung und Editieren.
- **CRM-2722 (gefixt):** Anzahl Zielbesuche war falsch berechnet.
- **CRM-99 (Backlog):** Epic "Besuche umbauen" — geplante Umstrukturierung: Besuchsberichte sollen entfernt und Prüfberichte als Cases abgebildet werden. Noch nicht umgesetzt.
- **CRM-445 (Backlog):** "Besuchsliste 2.0" — verbesserte Listenansicht geplant.
- **CRM-906 (Backlog):** Layout/Felder Besuche — Überarbeitung der Feldanordnung geplant.
- **Flow `STLGS_UpdateVisitProtocolOnAccount` ist veraltet** — ersetzt durch `STLGS_UpdateVisitProtocolOnAccountFromEvent` und `...FromTask`. Sollte deaktiviert oder entfernt werden.

## Referenzen

### Jira

**Epic CRM-99 — Besuche umbauen (Backlog)**

| Key | Summary | Status |
|-----|---------|--------|
| CRM-99 | Besuche umbauen | Backlog |
| CRM-346 | Besuche - Checkbox: über Ilo-Profit gesprochen | Backlog |
| CRM-813 | Relation Besuche & Ast | Backlog |

**Epic CRM-89 — CRM Unterstützung für Annahmestellen Controlling (Fertig)**

| Key | Summary | Status |
|-----|---------|--------|
| CRM-353 | Besuchsberichte Zentrale | Abgebrochen |
| CRM-354 | Besuchsbericht Zentrale | Fertig |
| CRM-366 | eigener Typ - Erstbesuch | Fertig |

**Epic CRM-82 — KAM Basisprozesse & Auswertungen (Fertig)**

| Key | Summary | Status |
|-----|---------|--------|
| CRM-1047 | Aktivitäten an JP: Besuche und Anrufe | Fertig |

**Ohne Epic**

| Key | Summary | Status |
|-----|---------|--------|
| CRM-430 | Ziel AST-Besuche / Jahr mit Segment koppeln | Fertig |
| CRM-434 | Neue Checkbox für Letzte Prüfung Öffentliche Daten im Account | Fertig |
| CRM-445 | Besuchsliste 2.0 | Backlog |
| CRM-905 | Falsche Checkboxen bei Besuchserfassung & editieren | Fertig |
| CRM-906 | Layout/Felder Besuche | Backlog |
| CRM-2634 | Doppelt angelegter Besuch von Paveglio (RD2) | Fertig |
| CRM-2722 | Anzahl Zielbesuche aktuell falsch | Fertig |
| CRM-2879 | Besuch löschen RD2 Belis | Fertig |
| CRM-2890 | Tatsächliche Anzahl ASt Besuche/Jahr nicht zurück gesetzt | Fertig |

### Confluence

| Seite | Space | Page ID |
|-------|-------|---------|
| Use Cases Mobiles Arbeiten | Vertrieb | 865501185 |
| 2023-06-07 - Key User Treffen 3 | Vertrieb | 816513025 |
| Prozessmanagement & Steuerung | Vertrieb | 711852049 |
| Datenobjekt Annahmestelle | Vertrieb | 711720968 |
| Release Notes - Version 1.10.2 | Project: Salesforce@Lotto_BW | 1726644225 |

### Codebase

| Typ | Pfad |
|-----|------|
| Custom Object | `force-app/main/default/objects/STLGS_VisitReport__c/` |
| LWC | `force-app/main/default/lwc/stlgs_createVisit/` |
| FlexiPage | `force-app/main/default/flexipages/STLGS_VisitRecordPage.flexipage-meta.xml` |
| Page Layout | `force-app/main/default/layouts/STLGS_VisitReport__c-Visit Layout.layout-meta.xml` |
| Tab | `force-app/main/default/tabs/STLGS_Visit__c.tab-meta.xml` |
| Knowledge Article | `business/existing_Knowledge_Articles/000001570_Besuche und Besuchsberichte.md` |

## Änderungshistorie

| Datum | Änderung | Quelle |
|-------|----------|--------|
| 2026-02-20 | Initiale Erstellung | 17 Jira-Stories, 10 Flows, 13 Apex-Klassen, 5 Confluence-Seiten, Codebase-Analyse |
