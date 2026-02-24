# Domain Knowledge: Dr. KADE Health Care

Dr. KADE Health Care is a pharmaceutical company. The Salesforce org manages a **PTA Portal** (Professional Training Academy) for healthcare professionals (pharmacists, doctors), along with order management, sales tracking, and marketing automation.

## Glossary

Common abbreviations used throughout the codebase and documentation:

| Abbreviation | Full Term | Context |
|-------------|-----------|---------|
| **PTA** | Pharmazeutisch-technische Assistenten | Portal for pharmacy professionals, used as LWC prefix (`pTA_*`) |
| **DRKA** | Dr. KADE | Apex/object naming prefix (`DRKA_*`) |
| **PZN** | Pharmazentralnummer | Unique pharmaceutical product identifier in Germany |
| **CT** | CTSALESORDER | Order management package (managed package) |
| **CTPHARMA** | CT Pharma Activity | Pharma activity/visit tracking (managed package) |
| **GP** | General Practitioner | Primary care doctor / Allgemeinmediziner |
| **OCR** | Optical Character Recognition | Certificate validation via Azure Functions |
| **MCAE** | Marketing Cloud Account Engagement | Formerly Pardot — marketing automation |

## Domain Terminology

| German Term | English | Usage in Code |
|-------------|---------|---------------|
| Pflichttext | Mandatory text | Required pharmaceutical product disclosure text |
| Gebrauchsinformation | Usage information (patient leaflet) | Download link on brand cards |
| Fachinformation | Specialist information (SmPC) | Download link for healthcare professionals |
| Indikation | Indication | Medical condition treated by a product (`Indication__c`) |
| Marke / Brand | Pharmaceutical brand | Product brand (`Brand__c`), e.g. Posterisan, Kadefungin |
| Schulung / Training | Training | Educational content for PTA portal (`Training__c`) |
| Gewinnspiel / Lotterie | Lottery / Prize draw | Promotional campaigns (`LotterySetting__c`) |
| Apotheke | Pharmacy | Target institution for PTA portal |
| Außendienst | Field sales | Pharma sales representatives |

## Business Processes

### PTA Portal — Registration & Approval

1. Healthcare professional registers via `userRegistrationForm` LWC
2. `ContactRegistration__c` record created with role (Pharmacist/Doctor)
3. Certificate uploaded → Azure blob storage via `AzureUploadPTAFileBatch`
4. OCR validation via Azure Functions extracts name and validates certificate
5. Lead created with `LeadSource = 'PTA Portal'` and `Is_Portal_Lead__c = true`
6. Approval workflow: New → Manual Approval / Approved / Rejected
7. On approval: Lead converted to Contact via `DRKA_LeadConversionInvocable`
8. Lead assigned by postal code via `DRKA_LeadQueueAssignmentInvocable` using `DRKA_AssignmentSetting__mdt`
9. Fallback assignment: `DRKA_LeadReviewQueue`

### PTA Portal — Training & Quizzes

1. Trainings (`Training__c`) organized in series (`TrainingSeries__c`)
2. Trainings linked to brands and indications
3. Quiz (`Quiz__c`) with randomized questions (`PTA_QuizQuestionRandomizer`)
4. Progress tracked per user via `QuizUser__c` (auto-numbered QU-XXXX)
5. Individual answers in `QuizUserAnswer__c`
6. Completion triggers Pardot external activity via `PardotExternalActivityService`
7. Lottery participation possible on quiz completion (`LotteryScheduledBatch`)

### Order Management

1. Orders via CTSALESORDER managed package (`orders__Order__c`)
2. Record types: `DRKA_MasterMassOrder`, `DRKA_SampleOrder`
3. Workflow: Create → Finalize → Validate → Post-Processing
4. Mass orders processed by `DRKA_MassOrderHandlerBatch`
5. Sample orders validated by `DRKA_SampleOrderValidator`
6. Validated record types: `DRKA_SalesOrderValidated`, `DRKA_SampleOrderValidated`
7. Trigger handler: `DRKA_CTOrderTriggerHandler`

### Pharma Activity & Event Tracking

1. Field sales activities recorded in `CTPHARMA__Activity__c` (managed package)
2. Activity types: On-Site, Remote, JointVisit
3. Calendar Events auto-created via `DRKA_EventCreator`
4. Activities linked to Accounts and Contacts

### Sales & Market Data

1. `DRKA_Sales_Goal__c` — targets per brand, area, period
2. `DRKA_Market_Data__c` — market performance metrics
3. `DRKA_Sales_Data__c` — actual sales data
4. Hash-based linking: `{Brand}_{AreaCode}_{Period}` matches goals to actuals
5. Batch processing: `MarketDataProcessingBatch`, `SalesDataProcessingBatch`

### Marketing Automation (Pardot/MCAE)

1. OAuth2 integration via `PardotExternalActivityService`
2. Sends external activities (training participation, quiz completion)
3. Credentials stored in `Pardot_Integration__c` custom setting
4. Async processing via Queueable (50 requests per batch with chaining)

## Key Custom Objects

| Object | Purpose |
|--------|---------|
| `Brand__c` | Pharmaceutical product brands |
| `Indication__c` | Medical indications / conditions |
| `BrandIndication__c` | Junction: brand ↔ indication |
| `Training__c` | Educational training content |
| `TrainingSeries__c` | Grouped training series |
| `Quiz__c` | Assessment quizzes |
| `QuizQuestion__c` | Quiz questions |
| `QuizAnswer__c` | Answer options |
| `QuizUser__c` | User quiz progress (QU-XXXX) |
| `QuizUserAnswer__c` | Individual user answers |
| `Webinar__c` | Webinar events |
| `WebinarParticipant__c` | Webinar participants |
| `ContactRegistration__c` | Portal registration data |
| `Registration_Change_Request__c` | Change requests for existing contacts |
| `orders__Order__c` | Orders (CTSALESORDER package) |
| `orders__OrderLineItem__c` | Order line items |
| `CTPHARMA__Activity__c` | Pharma field activities |
| `DRKA_Market_Data__c` | Market performance metrics |
| `DRKA_Sales_Data__c` | Sales actuals |
| `DRKA_Sales_Goal__c` | Sales targets |
| `DRKA_Account2AccountRelation__c` | Account hierarchies |
| `LotterySetting__c` | Lottery/prize draw configuration |
| `LotteryResult__c` | Lottery results |
| `ContentReference__c` | Content associations |

## Key Custom Metadata

| Metadata | Purpose |
|----------|---------|
| `DRKA_AssignmentSetting__mdt` | Lead assignment rules by postal code + city |
| `Azure_Files_Config__mdt` | Azure blob storage config (CDN URL, container, SAS token) |
| `OCR_Config__mdt` | OCR endpoint URL and function key |
| `EmailConfigurationSetting__mdt` | Context → email template mapping |

## Record Types

| Object | Record Type | Purpose |
|--------|-------------|---------|
| Contact | `Doctor` | Medical professional |
| Contact | `DRKA_Contact` | General contact |
| Account | `DRKA_GPOffice` | GP practice / pharmacy |
| orders__Order__c | `DRKA_MasterMassOrder` | Bulk material orders |
| orders__Order__c | `DRKA_SampleOrder` | Sample distribution |
| orders__Order__c | `DRKA_SalesOrderValidated` | Validated mass order |
| orders__Order__c | `DRKA_SampleOrderValidated` | Validated sample order |
| CTPHARMA__Activity__c | `JointVisit` | Joint field visit |

## Integrations

| System | Purpose | Key Classes |
|--------|---------|-------------|
| Azure Blob Storage | Certificate file storage | `AzureUploadPTAFileBatch` |
| Azure Functions | OCR certificate validation | `AzureUploadPTAFileBatch` |
| Pardot / MCAE | Marketing automation | `PardotExternalActivityService` |
| CTSALESORDER | Order management (managed pkg) | `DRKA_CTOrderTriggerHandler` |
| CTPHARMA | Activity tracking (managed pkg) | `DRKA_CTPharma_ActivityTriggerHandler` |

## Scheduled & Batch Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `Sched_AzureUploadPTA` | Recurring | Upload PTA certificates to Azure |
| `SelfReschedulingBatchOCRScheduler` | Self-rescheduling | OCR validation of certificates |
| `LotteryScheduledBatch` | Recurring | Execute lottery drawings |
| `MarketDataProcessingSchedulable` | Recurring | Link market data to sales goals |
| `SalesDataProcessingSchedulable` | Recurring | Process sales data |

## Common Field Name Pitfalls

| Correct | Common Mistake |
|---------|---------------|
| `ApprovalStatus__c` | ~~Approval_Status__c~~ (on Lead) |
| `Approval_Status__c` | ~~ApprovalStatus__c~~ (on Registration_Change_Request__c) |
| `Is_Portal_Lead__c` | ~~IsPortalLead__c~~ |
| `orders__Stage__c` | ~~Stage__c~~ (namespaced field) |
| `orders__Order__c` | ~~Order__c~~ (namespaced object) |
| `CTPHARMA__Activity__c` | ~~Activity__c~~ (namespaced object) |
