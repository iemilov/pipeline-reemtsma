# Test Data Configuration: drKade

## Overview

This configuration defines the test data records to be created in a drKade Salesforce org. Records are organized by dependency order — parent records are created first.

## Record Groups

---

### 1. Accounts

#### 1a. GP Office Account

| Field | Value |
|-------|-------|
| sObject | `Account` |
| RecordType | `DRKA_GPOffice` |
| Name | `Test Apotheke {{Today}}` |
| DRKA_BusinessStatus__c | `Active Customer` |
| DRKA_CustomerBlocked__c | `N` |
| DRKA_OperatingLicenseAvailable__c | `true` |
| DRKA_Mass_Order_Group__c | `Group 1` |
| CTPHARMA__ExternalId__c | `EXT-TEST-001` |
| BillingStreet | `Musterstraße 1` |
| BillingPostalCode | `70173` |
| BillingCity | `Stuttgart` |
| BillingCountry | `Germany` |
| ShippingStreet | `Musterstraße 1` |
| ShippingPostalCode | `70173` |
| ShippingCity | `Stuttgart` |
| ShippingCountry | `Germany` |
| referenceId | `testAccount` |

---

### 2. Contacts

#### 2a. Doctor Contact

| Field | Value |
|-------|-------|
| sObject | `Contact` |
| RecordType | `Doctor` |
| FirstName | `Dr. Max` |
| LastName | `Mustermann-{{Today}}` |
| Email | `max.mustermann@example.com` |
| DRKA_Roles__c | `Owner` |
| AccountId | `{{Ref:testAccount}}` |
| referenceId | `testDoctor` |

#### 2b. Portal Contact

| Field | Value |
|-------|-------|
| sObject | `Contact` |
| RecordType | `DRKA_Contact` |
| FirstName | `Anna` |
| LastName | `Apothekerin-{{Today}}` |
| Email | `anna.apothekerin@example.com` |
| DRKA_Roles__c | `Owner` |
| Contact_Source__c | `PTA Portal` |
| AccountId | `{{Ref:testAccount}}` |
| referenceId | `testPortalContact` |

---

### 3. Leads

#### 3a. PTA Portal Lead

| Field | Value |
|-------|-------|
| sObject | `Lead` |
| FirstName | `Test` |
| LastName | `PTA Lead {{Today}}` |
| Email | `pta.lead@example.com` |
| Company | `Test Apotheke` |
| LeadSource | `PTA Portal` |
| Is_Portal_Lead__c | `true` |
| Role__c | `Pharmacist` |
| referenceId | `testLead` |

---

### 4. Contact Registrations

#### 4a. Portal Registration

| Field | Value |
|-------|-------|
| sObject | `ContactRegistration__c` |
| FirstName__c | `Test` |
| LastName__c | `Registrierung {{Today}}` |
| Email__c | `registration@example.com` |
| Account_Name__c | `Test Apotheke` |
| ContactPLZ__c | `70173` |
| City__c | `Stuttgart` |
| Address__c | `Musterstraße 1` |
| Role__c | `Pharmacist` |
| InterestCategory__c | `Proctology;Gynecology` |
| ApprovalStatus__c | `Approved` |
| referenceId | `testRegistration` |

---

### 5. Brands & Indications

#### 5a. Brand

| Field | Value |
|-------|-------|
| sObject | `Brand__c` |
| Name | `Posterisan Akut` |
| PTA_Description__c | `Test Beschreibung für Posterisan Akut` |
| PTA_Order__c | `1` |
| Accent_Color__c | `#1665AF` |
| ContentImageUrl__c | `https://example.com/posterisan.png` |
| referenceId | `testBrand` |

#### 5b. Second Brand

| Field | Value |
|-------|-------|
| sObject | `Brand__c` |
| Name | `Kadefungin 3` |
| PTA_Description__c | `Test Beschreibung für Kadefungin` |
| PTA_Order__c | `2` |
| referenceId | `testBrand2` |

#### 5c. Indication

| Field | Value |
|-------|-------|
| sObject | `Indication__c` |
| Name | `Proktologie` |
| Content__c | `Test Indikation Proktologie` |
| PTA_Order__c | `1` |
| referenceId | `testIndication` |

#### 5d. Second Indication

| Field | Value |
|-------|-------|
| sObject | `Indication__c` |
| Name | `Gynäkologie` |
| Content__c | `Test Indikation Gynäkologie` |
| PTA_Order__c | `2` |
| referenceId | `testIndication2` |

#### 5e. Brand-Indication Junction

| Field | Value |
|-------|-------|
| sObject | `BrandIndication__c` |
| Brand__c | `{{Ref:testBrand}}` |
| Indication__c | `{{Ref:testIndication}}` |
| referenceId | `testBrandIndication` |

---

### 6. Trainings & Quizzes

#### 6a. Training Series

| Field | Value |
|-------|-------|
| sObject | `TrainingSeries__c` |
| Name | `Test Schulungsreihe {{Today}}` |
| Published__c | `true` |
| PublishingStartDate__c | `{{Today}}` |
| PublishingEndDate__c | `{{Today+365d}}` |
| referenceId | `testTrainingSeries` |

#### 6b. Training

| Field | Value |
|-------|-------|
| sObject | `Training__c` |
| Title__c | `Test Schulung {{Today}}` |
| Content__c | `Testinhalt für Schulung` |
| ShortDescription__c | `Kurzbeschreibung` |
| PTA_Duration__c | `30` |
| PTA_Order__c | `1` |
| PTA_Topic__c | `Proktologie` |
| PTA_Question_Count__c | `5` |
| Published__c | `true` |
| PublishingStartDate__c | `{{Today}}` |
| PublishingEndDate__c | `{{Today+365d}}` |
| referenceId | `testTraining` |

#### 6c. Quiz

| Field | Value |
|-------|-------|
| sObject | `Quiz__c` |
| Name | `Test Quiz {{Today}}` |
| QuizIndication__c | `Proctology` |
| referenceId | `testQuiz` |

#### 6d. Quiz Reference (links Quiz to Training)

| Field | Value |
|-------|-------|
| sObject | `QuizReference__c` |
| Quiz__c | `{{Ref:testQuiz}}` |
| Training__c | `{{Ref:testTraining}}` |
| RelateToObject__c | `Training` |
| referenceId | `testQuizReference` |

#### 6e. Quiz Question

| Field | Value |
|-------|-------|
| sObject | `QuizQuestion__c` |
| Quiz__c | `{{Ref:testQuiz}}` |
| Question__c | `Was ist die häufigste Anwendung von Posterisan Akut?` |
| referenceId | `testQuestion` |

#### 6f. Quiz Answer (correct)

| Field | Value |
|-------|-------|
| sObject | `QuizAnswer__c` |
| QuizQuestion__c | `{{Ref:testQuestion}}` |
| Answer__c | `Zur Behandlung von Hämorrhoidalbeschwerden` |
| IsCorrect__c | `true` |
| Points__c | `1` |
| referenceId | `testAnswerCorrect` |

#### 6g. Quiz Answer (incorrect)

| Field | Value |
|-------|-------|
| sObject | `QuizAnswer__c` |
| QuizQuestion__c | `{{Ref:testQuestion}}` |
| Answer__c | `Zur Behandlung von Kopfschmerzen` |
| IsCorrect__c | `false` |
| Points__c | `0` |
| referenceId | `testAnswerWrong` |

#### 6h. Quiz User (progress tracking)

| Field | Value |
|-------|-------|
| sObject | `QuizUser__c` |
| Quiz__c | `{{Ref:testQuiz}}` |
| CorrectAnswers__c | `1` |
| IsCanceled__c | `false` |
| referenceId | `testQuizUser` |

---

### 7. Lottery

#### 7a. Lottery Setting

| Field | Value |
|-------|-------|
| sObject | `LotterySetting__c` |
| Quiz__c | `{{Ref:testQuiz}}` |
| IsActive__c | `true` |
| NumberOfWinners__c | `3` |
| QuizSuccessRate__c | `80` |
| StartDate__c | `{{Today}}` |
| ExecutionDate__c | `{{Today+30d}}` |
| referenceId | `testLottery` |

---

### 8. Products & Orders

#### 8a. Product

| Field | Value |
|-------|-------|
| sObject | `CTPHARMA__Product__c` |
| Name | `Posterisan Akut Salbe` |
| DRKA_MaxSampleQuantity__c | `2` |
| DRKA_PZN__c | `04957864` |
| referenceId | `testProduct` |

#### 8b. Sample Order

| Field | Value |
|-------|-------|
| sObject | `orders__Order__c` |
| RecordType | `DRKA_SampleOrder` |
| orders__AccountId__c | `{{Ref:testAccount}}` |
| orders__ContactId__c | `{{Ref:testDoctor}}` |
| orders__OrderType__c | `Sample` |
| orders__Stage__c | `Pending` |
| DRKA_OrderStartDate__c | `{{Today}}` |
| DRKA_DeliveryDate__c | `{{NextMonday}}` |
| referenceId | `testSampleOrder` |

#### 8c. Mass Order

| Field | Value |
|-------|-------|
| sObject | `orders__Order__c` |
| RecordType | `DRKA_MasterMassOrder` |
| orders__AccountId__c | `{{Ref:testAccount}}` |
| orders__ContactId__c | `{{Ref:testDoctor}}` |
| orders__OrderType__c | `Master Mass` |
| orders__Stage__c | `Pending` |
| DRKA_Mass_Order_Group__c | `Group 1` |
| DRKA_OrderStartDate__c | `{{Today}}` |
| DRKA_DeliveryDate__c | `{{NextMonday}}` |
| referenceId | `testMassOrder` |

#### 8d. Order Line Item

| Field | Value |
|-------|-------|
| sObject | `orders__OrderLineItem__c` |
| orders__OrderId__c | `{{Ref:testSampleOrder}}` |
| ProductId__c | `{{Ref:testProduct}}` |
| orders__Quantity__c | `2` |
| referenceId | `testLineItem` |

---

### 9. Sales & Market Data

#### 9a. Sales Goal

| Field | Value |
|-------|-------|
| sObject | `DRKA_Sales_Goal__c` |
| DRKA_Brand__c | `Posterisan Akut` |
| DRKA_Area_Code__c | `900` |
| DRKA_Period__c | `{{Year}}-Q1` |
| DRKA_Value_Type__c | `A` |
| DRKA_Date__c | `{{Today}}` |
| DRKA_Goal__c | `100` |
| referenceId | `testSalesGoal` |

#### 9b. Market Data

| Field | Value |
|-------|-------|
| sObject | `DRKA_Market_Data__c` |
| DRKA_Brand__c | `Posterisan Akut` |
| DRKA_Market__c | `Test Market` |
| DRKA_Area_Code__c | `900` |
| DRKA_Date__c | `{{Today}}` |
| DRKA_YTD__c | `1000` |
| DRKA_Period__c | `{{Year}}-Q1` |
| referenceId | `testMarketData` |

#### 9c. Sales Data

| Field | Value |
|-------|-------|
| sObject | `DRKA_Sales_Data__c` |
| DRKA_Brand__c | `Posterisan Akut` |
| DRKA_Area_Code__c | `900` |
| DRKA_Date__c | `{{Today}}` |
| DRKA_Period__c | `{{Year}}-Q1` |
| referenceId | `testSalesData` |

---

### 10. Pharma Activities

#### 10a. Joint Visit Activity

| Field | Value |
|-------|-------|
| sObject | `CTPHARMA__Activity__c` |
| RecordType | `JointVisit` |
| CTPHARMA__Status__c | `Planned` |
| CTPHARMA__Type__c | `On-Site` |
| CTPHARMA__StartDate__c | `{{Today}}T09:00:00.000Z` |
| CTPHARMA__EndDate__c | `{{Today}}T10:00:00.000Z` |
| CTPHARMA__AccountId__c | `{{Ref:testAccount}}` |
| referenceId | `testActivity` |

---

### 11. Content References

#### 11a. Training-Indication Link

| Field | Value |
|-------|-------|
| sObject | `ContentReference__c` |
| Training__c | `{{Ref:testTraining}}` |
| Indication__c | `{{Ref:testIndication}}` |
| RelateObject__c | `Training` |
| RelateToObject__c | `Indication` |
| referenceId | `testContentRef` |

---

## Dependency Order

1. **Accounts** — No dependencies
2. **Contacts** — Need Account IDs from step 1
3. **Leads** — No dependencies
4. **Contact Registrations** — No dependencies (optional Account link)
5. **Brands & Indications** — No dependencies; BrandIndication needs both
6. **Trainings & Quizzes** — Quiz needs no dependency; QuizReference needs Quiz + Training; Questions need Quiz; Answers need Question
7. **Lottery** — Needs Quiz from step 6 (and QuizReference must exist)
8. **Products & Orders** — Products have no dependencies; Orders need Account + Contact; Line Items need Order + Product
9. **Sales & Market Data** — No dependencies (OwnerId set to running user)
10. **Pharma Activities** — Need Account from step 1
11. **Content References** — Need Training from step 6 + Indication from step 5

## Token Reference

| Token | Replacement |
|-------|-------------|
| `{{Today}}` | Current date (`YYYY-MM-DD`) |
| `{{Today+Nd}}` | Current date plus N days |
| `{{Year}}` | Current year (`YYYY`) |
| `{{NextMonday}}` | Next Monday from today |
| `{{Ref:<referenceId>}}` | Salesforce ID of the referenced record |

## Notes

- Record Type DeveloperNames are verified against repository metadata — the skill queries actual RecordType IDs at runtime
- Field API names follow domain knowledge from `domain-knowledge.md`
- Area code `900` is the standard test area code used in DRKA test classes
- Orders use `{{NextMonday}}` for delivery dates (calculated as `(Today+7).toStartOfWeek() + 1`)
- When inserting leads that may be duplicates, use `Database.DMLOptions` with `AllowSave = true`
- Market/Sales data batch processing requires `OwnerId` to be set explicitly
- Quiz must have a `QuizReference__c` linking it to a Training before LotterySetting can function
- Valid indication categories: `Gynecology`, `Proctology`, `Gastroenterology`, `Nutrition`
