# Domain Knowledge: Lotto Baden-Württemberg

## Glossary

Common abbreviations used throughout the codebase and documentation:

| Abbreviation | German | English |
|-------------|--------|---------|
| **ASt** | Annahmestelle | Sales Point / Store |
| **ASten** | Annahmestellen | Sales Points (plural) |
| **RD** | Regionaldirektion | Regional Management |
| **VO** | Vertriebsorganisation | Sales Organization |
| **VS** | Vertriebssteuerung | Sales Control |
| **TK** | Testkauf | Test Purchase / Mystery Shopping |
| **VDE** | Verband der Elektrotechnik | Electrical Safety Inspection |
| **LMS** | Learning Management System | External training platform for online courses |
| **AST-Leiter** | Annahmestellenleiter | Store Manager (responsible for mandatory training) |

## Testkauf (TK) — Test Purchase / Mystery Shopping

### Batch Processing

**Class:** `STLGS_UpdateTestPurchaseBatch`

- **Manual execution:** `Database.executeBatch(new STLGS_UpdateTestPurchaseBatch(), 200);`
- Processes TK cases with status "TK durchgeführt" from previous calendar week
- **Important:** Lotto billing week runs Saturday-Saturday (not standard Mon-Sun Salesforce week)
- Code uses `isDateInLastWeek()` logic: `Date.today().toStartOfWeek().addDays(-7)` to calculate the previous week

### Key Validation Rules

- `STLGS_PreventStatusChange2ndLevelSD`: Status "Zugewiesen an 2nd Level" requires `STLGS_ChecksToKBDone__c=true`

### Processing Logic

| TK Result | Other Open TKs? | Target Status | Notes |
|-----------|-----------------|---------------|-------|
| `nicht bestanden` | — | "Testkaufergebnis nicht geprüft" | Manual review required |
| `bestanden` | No | "Abrechnung" | Full automation |
| `bestanden` | Yes | "nicht geprüft" | Manual review (other TKs pending) |
| TK-Art "Nachschulung" | — | "nicht geprüft" | Always manual review (CRM-2497) |
| `Fehlanfahrt` | — | "nicht geprüft" | No Ampelstatus calculation |

## VDE Prüfung (Electrical Safety Inspection)

### Asset Creation

Flow-based automated asset creation based on `Account.STLGS_SalesType__c`:

| Sales Type | Number of Assets |
|-----------|-----------------|
| "Vollannahmestelle" | 12 standard assets |
| "Lotto Kompakt" | 7 standard assets |

### Custom Asset Fields

| Field | Type | Description |
|-------|------|-------------|
| `Case__c` | Lookup(Case) | Related inspection case |
| `STLGS_Type__c` | Picklist | e.g., "Terminal & Drucker", "Lottowand", "weitere Geräte" |
| `STLGS_ErrorFound__c` | Checkbox | Error discovered during inspection |
| `STLGS_InspectionStickerApplied__c` | Checkbox | Inspection sticker applied |
| `STLGS_InspectionDate__c` | Date | Date of inspection |

## Pflichtschulung Jugend- und Spielerschutz (Mandatory Training)

### Overview

Each ASt-Leiter must complete mandatory youth/player protection training annually. Training is tracked via Cases of type `Pflichtschulung Jugend- und Spielerschutz` with two training types:

| Training Type | Description | Created by |
| ------------- | ----------- | ---------- |
| **Präsenz** | In-person classroom training | Flow `STLGS_UpdateAccStatusOnCreateUpdateRequest` |
| **Online** | E-learning via external LMS | Flow `STLGS_CreateTrainingOnGeprueft` (CRM-2568) |

### Key Fields on Training Cases

| Field | Description |
| ----- | ----------- |
| `STLGS_TrainingType__c` | "Präsenz" or "Online" |
| `STLGS_TrainingYear__c` | Training year (e.g., "2025", "2026") |
| `STLGS_Type__c` | "Pflichtschulung Jugend- und Spielerschutz" |
| `STLGS_TrainingModulesCompleted__c` | Number of completed online modules |
| `STLGS_TrainingModulesTotal__c` | Total online modules (currently 6) |
| `STLGS_TrainingModulesProgress__c` | Formula field: `Completed/Total * 100` (read-only) |
| `STLGS_LastUpdatedLMS__c` | Timestamp of last LMS sync (auto-set by flow `STLG_CaseSetLastUpdatedLMS`) |
| `STLGS_LeadingRequest__c` | Lookup to the Request that triggered case creation |

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

## Common Field Name Pitfalls

Frequently confused field names — use the correct spelling to avoid deployment errors:

| Correct | Common Mistake |
|---------|---------------|
| `STLGS_RegionalDirectorate__c` | ~~RegionalDirection~~ |
| `STLGS_SubjectSD__c` | ~~SubjectDescription~~ |
| `STLG_TMFTicketId__c` | ~~T_MFTicketId~~ |
| `STLGS_ProServicesCase__c` | Means "Sichtbar für ProServices" |
| `STLG_FollowupDate__c` | ~~FollowUpDate~~ (capital U) |

## Bulk Data Operations

### Preferred Approach: Composite Tree API

```bash
POST /services/data/v65.0/composite/tree/Case
```

- Maximum 200 records per request
- Each record requires `referenceId` in `attributes`
- Add 2-second pause between batches for rate limiting

**Avoid:** `sf data import bulk` has persistent line ending issues on macOS — prefer Composite Tree API.

## Important Record IDs (Production)

| Record | ID | Notes |
|--------|----|-------|
| RecordType `STLGS_ServiceDeskCase` | `012Tr000003l2pRIAQ` | Service Desk case record type |
| Queue `ProServices` | `00GTr000005KTsfMAG` | ProServices queue |
