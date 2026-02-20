# Filialverantwortung wechseln — Domain Knowledge

> Letzte Aktualisierung: 2026-02-20 | Quellen: 1 Jira-Story, 2 Flows, 0 Confluence-Seiten

## Überblick

Der Prozess "Filialverantwortung wechseln" ermöglicht es, die verantwortliche Person (Filialverantwortliche/r) an einem Store zu ändern. Dies betrifft **ausschließlich juristische Personen** (Business Accounts), da bei natürlichen Personen der Lizenzinhaber selbst die ASt leitet. Der Wechsel wird über einen Case (Typ "Filialverantwortung ändern") abgewickelt, der die Bearbeitung durch RD und VO steuert. Die technische Umsetzung aktualisiert den `STLGS_BranchManager__c`-Lookup am führenden Antrag und passt die AccountContactRelation (ACR) automatisch an.

Siehe auch: [docs/vertragsrelevante-datenaenderung.md](vertragsrelevante-datenaenderung.md) — Teilt den Flow `STLGS_UpdateRequestOnStatusChange` (getrennte Pfade für FV-Wechsel und VRD), [docs/antrag.md](antrag.md) — BranchManager-Lookup am Antrag.

## Geschäftsprozess

### Auslöser

Ein Wechsel der Filialverantwortung kann aus verschiedenen Gründen notwendig werden:
- **Personalwechsel**: Die bisherige Filialverantwortliche verlässt das Unternehmen oder wechselt den Standort
- **TK-Sperrung**: Bei Ampelstatus "Gesperrt" wird automatisch ein Sub-Case "Filialverantwortung ändern" erstellt (siehe [docs/testkauf.md](testkauf.md), Abschnitt TK Sperrung)
- **Organisatorische Umstrukturierung**: Juristische Person ordnet Standort-Verantwortung neu

### Ablauf

```text
RD: Quick Action "New Branch Manager" auf Account
→ Screen Flow: Neue FV auswählen + Gültigkeitsdatum setzen
→ Case erstellt (Typ "Filialverantwortung ändern", RecordType STLGS_EditCase)
→ RD bearbeitet Case, legt Führungszeugnis in ELO ab, bestätigt ELO-Nachweis
→ Übergeben an VO (Queue STLGS_SalesOrganization)
→ VO prüft: ELO-Nachweis ✓, ContactId ✓, Gültigkeitsdatum > heute ✓
→ VO aktualisiert BranchManager am Antrag (STLGS_Request__c)
→ Flow STLGS_UpdateACRMainContact feuert automatisch:
  - Alte FV: ACR → MainContact=false, IsActive=false, Role="Ehemalige Filialverantwortung"
  - Neue FV: ACR erstellt oder aktualisiert → MainContact=true, IsActive=true
→ VO meldet Wechsel ans RP (Mitteilung, kein Genehmigungsantrag)
→ VO schließt Case
```

**Wichtig:** Der FV-Wechsel ist **kein neuer Antrag** — die ASt-Nr bleibt gleich. Die Mitteilung ans RP erfolgt über einen separaten Vorgang "Vertragsrelevante Daten ändern". Das RP kann die Mitteilung theoretisch ablehnen, was einen neuen Vorgang auslöst.

### Akteure

| Akteur | Aktion |
|--------|--------|
| **RD (Innendienst)** | Legt neuen FV-Contact an, erstellt Case via Quick Action, legt Führungszeugnis in ELO ab |
| **VO (Zentrale)** | Prüft Nachweis, aktualisiert BranchManager am Antrag, meldet ans RP, schließt Case |
| **RP (extern)** | Erhält Mitteilung über Wechsel (kann theoretisch ablehnen) |
| **System** | ACR-Update automatisch via Flow bei BranchManager-Änderung am Antrag |

## Business Rules

- **Nur juristische Personen**: Die Quick Action "New Branch Manager" ist nur sichtbar wenn `STLGS_LeadingRequest__r.RecordType.DeveloperName` den String "Business" enthält
- **Führender Antrag erforderlich**: Ohne gültigen juristischen führenden Antrag (`STLGS_LeadingRequest__c`) zeigt der Flow eine Fehlermeldung: *"Für die ASt {Name} konnte kein führender, juristischer Antrag gefunden werden."*
- **Neue FV ≠ Alte FV**: Screen-Validierung verhindert Auswahl der bisherigen Filialverantwortung
- **Gültigkeitsdatum in der Zukunft**: `STLGS_ValidFrom__c > TODAY()` — sowohl im Screen Flow als auch in der Validation Rule
- **ELO-Nachweis Pflicht**: `STLGS_ELOProof__c = true` muss gesetzt sein bevor VO den Case bearbeiten kann — bezieht sich auf das Führungszeugnis der neuen FV, das in ELO archiviert werden muss
- **Kein neuer Antrag**: ASt-Nr bleibt gleich, nur Mitteilung ans RP über Vorgang "Vertragsrelevante Daten ändern"
- **RP-Ablehnung möglich**: Theoretisch kann das RP die Mitteilung ablehnen → erfordert dann neuen Vorgang
- **Validation Rule greift bei VO-Queue**: Die VR `STLGS_BranchMangagerMandatoryFields` feuert nur wenn der Case Owner die Queue `STLGS_SalesOrganization` ist — RD kann den Case also ohne ELO-Nachweis erstellen und zwischenspeichern

## Technische Umsetzung

### Datenmodell

#### Case-Felder (Typ "Filialverantwortung ändern")

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `ContactId` | Lookup(Contact) | Neue Filialverantwortliche — Standard-Feld |
| `STLGS_ValidFrom__c` | Date | Stichtag für den Wechsel |
| `STLGS_ELOProof__c` | Checkbox | Bestätigung Dokumentenablage in ELO |
| `STLGS_GeneralDescription__c` | Text | Automatisch befüllt: Name der bisherigen FV |
| `Description` | TextArea | Automatisch befüllt: Anrede + Name der bisherigen FV |
| `STLGS_Type__c` | Picklist | Wert: `Filialverantwortung ändern` |
| `Subject` | Text | Auto-generiert: "Filialverantwortung ändern an {StoreName} - {Datum}" |
| `Origin` | Picklist | Wird auf `Email` gesetzt |

#### Antrag-Feld (STLGS_Request__c)

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_BranchManager__c` | Lookup(Contact) | Aktuelle Filialverantwortliche |

- **Lookup-Filter**: Nur Contacts mit RecordType ≠ "STLG Standard Contact"
- **Field History Tracking**: Aktiviert
- **Delete Constraint**: SetNull

#### AccountContactRelation (ACR)

| Feld (API-Name) | Typ | Beschreibung |
|-----------------|-----|-------------|
| `STLGS_MainContact__c` | Checkbox | Markiert den aktiven Hauptkontakt pro Store |
| `STLGS_Role__c` | Text(255) | Freitext, z.B. `Ehemalige Filialverantwortung` |
| `IsActive` | Checkbox | Standard-Feld, steuert Sichtbarkeit |

### Automation

| Flow / Komponente | Typ | Zweck |
|-------------------|-----|-------|
| `STLGS_CreateNewBranchManager` | Screen Flow (Quick Action auf Account) | Erstellt Case "Filialverantwortung ändern" mit neuer FV und Gültigkeitsdatum |
| `STLGS_UpdateACRMainContact` | Record-Triggered Flow (After Save, `STLGS_Request__c`) | Aktualisiert ACRs: alte FV deaktivieren, neue FV als MainContact setzen. Trigger: `STLGS_BranchManager__c` nicht null |
| `STLGS_BranchMangagerMandatoryFields` | Validation Rule (Case) | Erzwingt ELO-Nachweis, ContactId und Zukunftsdatum wenn Case bei VO-Queue |
| `Account.STLGS_NewBranchManager` | Quick Action | Startet den Screen Flow `STLGS_CreateNewBranchManager` |

### Flow-Details: STLGS_CreateNewBranchManager

**Typ:** Screen Flow (via Quick Action auf Account)
**API-Version:** 60.0

1. **Get Store** — Liest Account (Filter: RecordType startet mit "STLGS")
2. **Get Leading Request** — Liest führenden Antrag (`STLGS_LeadingRequest__c`) mit RecordType "Business"
3. **Decision: Valid Business Request?** — Prüft ob Antrag existiert, sonst Fehlermeldung
4. **Entry Screen** — Zwei Spalten:
   - Links: Lookup "Neue Filialverantwortung" (Contact via Case.ContactId) + Anzeige bisherige FV (read-only)
   - Rechts: Datumsfeld "Gültig ab" mit Zukunfts-Validierung
5. **Get Edit Case Record Type** — Holt RecordType `STLGS_EditCase`
6. **Assign Case Values** — Setzt alle Case-Felder (ContactId, ValidFrom, Subject, AccountId, Type, etc.)
7. **Create Case** — Erstellt den Case
8. **Toast** — Erfolgsmeldung mit Link zum neuen Case

### Flow-Details: STLGS_UpdateACRMainContact

**Typ:** Record-Triggered Flow (After Save auf `STLGS_Request__c`)
**API-Version:** 58.0
**Entry Condition:** `STLGS_BranchManager__c IS NOT NULL`

1. **Get Main Contact** — Alle ACRs mit `STLGS_MainContact__c = true` für den Store (`STLGS_Store__c`)
2. **Loop Main Contacts** — Für jede bisherige MainContact-ACR:
   - `STLGS_MainContact__c = false`
   - `IsActive = false`
   - **Decision: Branch Manager Changed?** — Wenn `STLGS_BranchManager__c` sich geändert hat UND die ACR dem alten BranchManager gehört:
     - `STLGS_Role__c = "Ehemalige Filialverantwortung"`
3. **Remove ACR.MainContact** — Batch-Update aller gesammelten ACRs
4. **Get ACR of Branch Manager** — Sucht existierende ACR für den neuen BranchManager am Store
5. **Decision: Existing ACR?**
   - **Ja**: Update existierende ACR → `IsActive = true`, `STLGS_MainContact__c = true`
   - **Nein**: Neue ACR erstellen → `AccountId = Store`, `ContactId = BranchManager`, `IsActive = true`, `STLGS_MainContact__c = true`

### UI-Sichtbarkeit

Die Quick Action `Account.STLGS_NewBranchManager` ist nur auf folgenden Flexipages sichtbar:
- `STLG_StoreSalesCentralRecordPage` (Store-Detailseite VO)
- `STLG_StoreReadOnlyRecordPage` (Store-Detailseite Read-Only)

**Sichtbarkeitsregel:** `STLGS_LeadingRequest__r.RecordType.DeveloperName` enthält "Business"

### Abhängige Komponenten (BranchManager-Referenzen)

| Komponente | Verwendung |
|-----------|-----------|
| `STLGS_ConfirmRequest` (Flow) | Validiert Nationalität + EU-Status der BranchManager bei Antragsbestätigung |
| `STLGS_UpdateAccStatusOnCreateUpdateRequest` (Flow) | Verwendet BranchManager-ID für ContactId bei Pflichtschulung-Case-Erstellung |
| `STLGS_TextMergeService` (Apex) | Merge-Token `[!STLGS_BranchManager__r.*]` für Vertragsvorlagen |
| `STLGS_TextMergeLookupService` (Apex) | `getStoreManager()` / `getStoreManagerSalutationText()` für Dokumente |
| `Account.STLGS_LicenseOwnerNationality__c` (Formula) | Nationalität des Lizenzinhabers (bei Business: aus BranchManager) |
| `Account.STLGS_LicenseOwnerNationality2__c` (Formula) | Zweite Staatsangehörigkeit (bei Business: aus BranchManager) |

### Berechtigungen

| Permission Set | Feld | Lesen | Schreiben |
|---------------|------|-------|-----------|
| `STLGS_Sales` | `STLGS_Request__c.STLGS_BranchManager__c` | Ja | Ja |
| `STLG_SystemAdministrator` | `STLGS_Request__c.STLGS_BranchManager__c` | Ja | Ja |

## Konfiguration

- **Quick Action:** `Account.STLGS_NewBranchManager` (Type: Flow, FlowDefinition: `STLGS_CreateNewBranchManager`)
- **Custom Metadata:** `STLG_SalesforceUrl__mdt` — wird im Flow für den Toast-Link verwendet (dynamische Org-URL)
- **RecordType:** Case wird mit `STLGS_EditCase` erstellt
- **Picklist-Wert:** `STLGS_Type__c` enthält `Filialverantwortung ändern` (verfügbar in RecordTypes: `STLGS_EditCase`, `STLGS_ReadOnlyCase`, `STLGS_TestPurchase`)
- **QuickText SubCategory:** `Wechsel Filialverantwortung` — verfügbar für vorgefertigte Textbausteine

## Bekannte Probleme & Workarounds

- **Typo im VR-Namen**: `STLGS_BranchMangagerMandatoryFields` — "Mangage" statt "Manager". Funktional kein Problem, aber irreführend bei der Suche.
- **STLGS_Role__c ist ein Textfeld**: Kein Picklist, d.h. keine standardisierte Werteliste. Der Flow setzt den Wert `"Ehemalige Filialverantwortung"` als Freitext — Änderungen am Wortlaut erfordern Flow-Anpassung.
- **Alle bisherigen MainContacts werden deaktiviert**: Der Flow `STLGS_UpdateACRMainContact` setzt bei **allen** ACRs mit `STLGS_MainContact__c = true` am Store dieses Flag auf false — nicht nur bei der alten FV. Falls ein Store aus anderen Gründen mehrere MainContacts hätte, würden alle deaktiviert.
- **Kein automatischer BranchManager-Update am Antrag**: Der Screen Flow erstellt nur den Case. Die tatsächliche Aktualisierung von `STLGS_BranchManager__c` am Antrag muss manuell durch VO erfolgen. Erst dann feuert der ACR-Flow.
- **Validierung nur bei VO-Queue**: Die VR prüft ELO-Nachweis und Datum nur wenn der Case-Owner die Queue `STLGS_SalesOrganization` ist. Wenn der Case versehentlich einem anderen Owner zugewiesen wird, greift die Validierung nicht.

## Zusammenspiel mit anderen Prozessen

- **TK Sperrung**: Bei Ampelstatus "Gesperrt" (nur juristische Personen) wird automatisch ein Sub-Case "Filialverantwortung ändern" erstellt. Siehe [docs/testkauf.md](testkauf.md)
- **Kündigung**: Bei STLG-initiierter Kündigung kann ein Wechsel der FV Teil des Prozesses sein, falls ein Übernahme-Antrag folgt. Siehe [docs/kuendigung.md](kuendigung.md)
- **Pflichtschulung**: Die ContactId für Pflichtschulungs-Cases wird bei Business Accounts aus `STLGS_BranchManager__r.Id` abgeleitet — ein FV-Wechsel beeinflusst also, wer künftige Pflichtschulungen erhält
- **Vertragsvorlagen**: `STLGS_TextMergeService` verwendet BranchManager-Daten für Merge-Tokens in GBV und anderen Dokumenten
- **Vertragsrelevante Datenänderungen**: Die RP-Mitteilung zum FV-Wechsel läuft über einen separaten Vorgang "Vertragsrelevante Daten ändern" (Anliegen: Kontaktdaten Filialverantwortliche)

## Referenzen

### Codebase

- `force-app/main/default/flows/STLGS_CreateNewBranchManager.flow-meta.xml` — Screen Flow (Case-Erstellung)
- `force-app/main/default/flows/STLGS_UpdateACRMainContact.flow-meta.xml` — Record-Triggered Flow (ACR-Update)
- `force-app/main/default/quickActions/Account.STLGS_NewBranchManager.quickAction-meta.xml` — Quick Action
- `force-app/main/default/objects/Case/validationRules/STLGS_BranchMangagerMandatoryFields.validationRule-meta.xml` — VR
- `force-app/main/default/objects/STLGS_Request__c/fields/STLGS_BranchManager__c.field-meta.xml` — Lookup-Feld
- `force-app/main/default/objects/AccountContactRelation/fields/STLGS_MainContact__c.field-meta.xml` — Checkbox
- `force-app/main/default/objects/AccountContactRelation/fields/STLGS_Role__c.field-meta.xml` — Textfeld
- `force-app/main/default/classes/STLGS_TextMergeService.cls` — Merge-Token-Verarbeitung

### Jira

- **CRM-336**: "Wechsel Filialverantwortliche" (Story, Epic: CRM-88 "Antragsprozess 1.5", Status: Fertig)

## Änderungshistorie

| Datum | Änderung | Quelle |
|-------|----------|--------|
| 2026-02-20 | Initiale Erstellung | CRM-336, Codebase-Analyse (2 Flows, 1 VR, 7 Felder, 2 Apex-Klassen) |
| 2026-02-20 | Cross-Reference + Siehe-auch ergänzt | Verweis auf vertragsrelevante-datenaenderung.md, antrag.md |
