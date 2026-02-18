# Test Data Configuration: Lotto Baden-Württemberg

## Overview

This configuration defines the test data records to be created in a Lotto-BW Salesforce org. Records are organized by dependency order — parent records are created first.

## Record Groups

### 1. B2C Person Accounts

#### 1a. B2C Prospect Account (Interessent)

| Field | Value |
|-------|-------|
| sObject | `Account` |
| RecordType | `STLG_StandardAccount` |
| Salutation | `Herr` |
| FirstName | `Test` |
| LastName | `Interessent-{{Today}}` |
| PersonEmail | `test.interessent@example.com` |
| Phone | `0711-1234567` |
| BillingStreet | `Nordbahnhofstraße 135` |
| BillingPostalCode | `70191` |
| BillingCity | `Stuttgart` |
| BillingCountry | `Germany` |
| referenceId | `b2cProspect` |

#### 1b. B2C Customer Account (Bestandskunde)

| Field | Value |
|-------|-------|
| sObject | `Account` |
| RecordType | `STLG_StandardAccount` |
| Salutation | `Frau` |
| FirstName | `Test` |
| LastName | `Bestandskunde-{{Today}}` |
| PersonEmail | `test.bestandskunde@example.com` |
| Phone | `0711-9876543` |
| BillingStreet | `Königstraße 20` |
| BillingPostalCode | `70173` |
| BillingCity | `Stuttgart` |
| BillingCountry | `Germany` |
| STLG_CustomerNumber__c | `TEST-{{Year}}-001` |
| referenceId | `b2cCustomer` |

### 2. B2B Business Accounts & Stores

#### 2a. B2B Business Account (Geschäftskunde)

| Field | Value |
|-------|-------|
| sObject | `Account` |
| RecordType | `STLGS_BusinessAccount` |
| Name | `Test Geschäftskunde {{Today}}` |
| Phone | `0711-5551234` |
| BillingStreet | `Schillerstraße 10` |
| BillingPostalCode | `70173` |
| BillingCity | `Stuttgart` |
| BillingCountry | `Germany` |
| referenceId | `b2bBusinessAccount` |

#### 2b. B2B Potential Store (Potenzielle Annahmestelle)

| Field | Value |
|-------|-------|
| sObject | `Account` |
| RecordType | `STLGS_PotentialStore` |
| Name | `Test Pot. ASt {{Today}}` |
| Phone | `0711-5559876` |
| BillingStreet | `Marktplatz 5` |
| BillingPostalCode | `70173` |
| BillingCity | `Stuttgart` |
| BillingCountry | `Germany` |
| STLGS_RegionalDirectorate__c | `RD Stuttgart` |
| ParentId | `{{Ref:b2bBusinessAccount}}` |
| referenceId | `b2bPotentialStore` |

#### 2c. B2B Store (Aktive Annahmestelle)

| Field | Value |
|-------|-------|
| sObject | `Account` |
| RecordType | `STLGS_Store` |
| Name | `Test ASt {{Today}}` |
| Phone | `0711-5554321` |
| BillingStreet | `Hauptstraße 42` |
| BillingPostalCode | `70173` |
| BillingCity | `Stuttgart` |
| BillingCountry | `Germany` |
| STLGS_RegionalDirectorate__c | `RD Stuttgart` |
| STLGS_SalesType__c | `Vollannahmestelle` |
| ParentId | `{{Ref:b2bBusinessAccount}}` |
| referenceId | `b2bStore` |

### 3. Contacts

#### 3a. Contact for B2B Business Account

| Field | Value |
|-------|-------|
| sObject | `Contact` |
| FirstName | `Max` |
| LastName | `Testinhaber-{{Today}}` |
| Email | `max.testinhaber@example.com` |
| Phone | `0711-5551111` |
| AccountId | `{{Ref:b2bBusinessAccount}}` |
| referenceId | `contactBusinessAccount` |

#### 3b. Contact for B2B Store (Filialleiter / Branch Manager)

| Field | Value |
|-------|-------|
| sObject | `Contact` |
| FirstName | `Anna` |
| LastName | `Testleiter-{{Today}}` |
| Email | `anna.testleiter@example.com` |
| Phone | `0711-5552222` |
| AccountId | `{{Ref:b2bStore}}` |
| referenceId | `contactStoreManager` |

### 4. B2B Requests (STLGS_Request__c) — on B2B Store

All requests are created on the active B2B Store (`b2bStore`).

#### 4a. Request: Neuaufstellung (New Setup)

| Field | Value |
|-------|-------|
| sObject | `STLGS_Request__c` |
| RecordType | `STLGS_Neuaufstellung` |
| STLGS_Account__c | `{{Ref:b2bStore}}` |
| STLGS_Status__c | `Neu` |
| STLGS_RequestDate__c | `{{Today}}` |
| referenceId | `requestNeuaufstellung` |

#### 4b. Request: Umstellung (Conversion)

| Field | Value |
|-------|-------|
| sObject | `STLGS_Request__c` |
| RecordType | `STLGS_Umstellung` |
| STLGS_Account__c | `{{Ref:b2bStore}}` |
| STLGS_Status__c | `Neu` |
| STLGS_RequestDate__c | `{{Today}}` |
| referenceId | `requestUmstellung` |

#### 4c. Request: Inhaberwechsel (Owner Change)

| Field | Value |
|-------|-------|
| sObject | `STLGS_Request__c` |
| RecordType | `STLGS_Inhaberwechsel` |
| STLGS_Account__c | `{{Ref:b2bStore}}` |
| STLGS_Status__c | `Neu` |
| STLGS_RequestDate__c | `{{Today}}` |
| referenceId | `requestInhaberwechsel` |

#### 4d. Request: Schließung (Closure)

| Field | Value |
|-------|-------|
| sObject | `STLGS_Request__c` |
| RecordType | `STLGS_Schliessung` |
| STLGS_Account__c | `{{Ref:b2bStore}}` |
| STLGS_Status__c | `Neu` |
| STLGS_RequestDate__c | `{{Today}}` |
| referenceId | `requestSchliessung` |

### 5. B2C Cases — on B2C Customer Account

#### 5a. Case: Service Desk (B2C)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLG_ServiceDeskCase` |
| AccountId | `{{Ref:b2cCustomer}}` |
| Subject | `Test Service Desk Case {{Today}}` |
| Status | `Neu` |
| Origin | `Phone` |
| Description | `Testfall Service Desk` |
| referenceId | `caseServiceDeskB2C` |

#### 5b. Case: Gewinnbenachrichtigung (B2C)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLG_Gewinnbenachrichtigung` |
| AccountId | `{{Ref:b2cCustomer}}` |
| Subject | `Test Gewinnbenachrichtigung {{Today}}` |
| Status | `Neu` |
| Description | `Testfall Gewinnbenachrichtigung` |
| referenceId | `caseGewinnbenachrichtigung` |

### 6. B2B Cases — on B2B Store

#### 6a. Case: Service Desk (B2B)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_ServiceDeskCase` |
| AccountId | `{{Ref:b2bStore}}` |
| ContactId | `{{Ref:contactStoreManager}}` |
| Subject | `Test B2B Service Desk {{Today}}` |
| Status | `Neu` |
| Origin | `Phone` |
| STLGS_SubjectSD__c | `Allgemeine Anfrage` |
| Description | `Testfall B2B Service Desk` |
| referenceId | `caseServiceDeskB2B` |

#### 6b. Case: Testkauf (Test Purchase)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_Testkauf` |
| AccountId | `{{Ref:b2bStore}}` |
| ContactId | `{{Ref:contactStoreManager}}` |
| Subject | `Test Testkauf {{Today}}` |
| Status | `Neu` |
| Description | `Testfall Testkauf` |
| referenceId | `caseTestkauf` |

#### 6c. Case: VDE Prüfung (Electrical Safety Inspection)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_VDEPruefung` |
| AccountId | `{{Ref:b2bStore}}` |
| ContactId | `{{Ref:contactStoreManager}}` |
| Subject | `Test VDE Prüfung {{Today}}` |
| Status | `Neu` |
| Description | `Testfall VDE Prüfung` |
| referenceId | `caseVDEPruefung` |

#### 6d. Case: Pflichtschulung Jugend- und Spielerschutz (Mandatory Training)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_PflichtschulungJSS` |
| AccountId | `{{Ref:b2bStore}}` |
| ContactId | `{{Ref:contactStoreManager}}` |
| Subject | `Test Pflichtschulung {{Today}}` |
| Status | `Neu` |
| STLGS_TrainingType__c | `Präsenz` |
| STLGS_TrainingYear__c | `{{Year}}` |
| Description | `Testfall Pflichtschulung` |
| referenceId | `casePflichtschulung` |

#### 6e. Case: Besuchsbericht (Visit Report)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_Besuchsbericht` |
| AccountId | `{{Ref:b2bStore}}` |
| ContactId | `{{Ref:contactStoreManager}}` |
| Subject | `Test Besuchsbericht {{Today}}` |
| Status | `Neu` |
| Description | `Testfall Besuchsbericht` |
| referenceId | `caseBesuchsbericht` |

#### 6f. Case: Neuaufstellung (Store Setup)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_Neuaufstellung` |
| AccountId | `{{Ref:b2bStore}}` |
| ContactId | `{{Ref:contactStoreManager}}` |
| Subject | `Test Neuaufstellung Case {{Today}}` |
| Status | `Neu` |
| Description | `Testfall Neuaufstellung` |
| referenceId | `caseNeuaufstellung` |

#### 6g. Case: Inhaberwechsel (Owner Change)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_Inhaberwechsel` |
| AccountId | `{{Ref:b2bStore}}` |
| ContactId | `{{Ref:contactStoreManager}}` |
| Subject | `Test Inhaberwechsel Case {{Today}}` |
| Status | `Neu` |
| Description | `Testfall Inhaberwechsel` |
| referenceId | `caseInhaberwechsel` |

## Dependency Order

Creation must follow this sequence:

1. **Accounts** — B2C Person Accounts, then B2B Business Account, then B2B Stores (Stores need BusinessAccount as Parent)
2. **Contacts** — Need Account IDs from step 1
3. **Requests** — Need Account IDs from step 1
4. **Cases** — Need Account IDs from step 1 and Contact IDs from step 2

## Notes

- All `{{Today}}` tokens are replaced with the current date (YYYY-MM-DD) to make test data identifiable
- All `{{Year}}` tokens are replaced with the current year
- All `{{Ref:<referenceId>}}` tokens are replaced with the Salesforce ID of the referenced record created earlier
- Person Account fields (FirstName, LastName, PersonEmail) are only valid when the Account RecordType is a PersonAccount type (e.g., `STLG_StandardAccount`)
- Record Type DeveloperNames may vary between orgs — the skill queries the actual IDs at runtime
- Field API names follow domain knowledge from `domain-knowledge.md` — use exact spelling to avoid deployment errors
