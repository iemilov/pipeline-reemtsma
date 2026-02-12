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
