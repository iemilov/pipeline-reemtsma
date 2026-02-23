# Test Data Configuration: drKade

## Overview

This configuration defines the test data records to be created in a drKade Salesforce org. Records are organized by dependency order — parent records are created first.

## Record Groups

---

### 1. Accounts

#### 1a. Account

| Field | Value |
|-------|-------|
| sObject | `Account` |
| RecordType | `<RecordTypeDeveloperName>` |
| Name | `Test Account {{Today}}` |
| Phone | `0711-1234567` |
| BillingStreet | `Musterstraße 1` |
| BillingPostalCode | `70173` |
| BillingCity | `Stuttgart` |
| BillingCountry | `Germany` |
| referenceId | `testAccount` |

---

### 2. Contacts

#### 2a. Contact

| Field | Value |
|-------|-------|
| sObject | `Contact` |
| FirstName | `Test` |
| LastName | `Kontakt-{{Today}}` |
| Email | `test.kontakt@example.com` |
| Phone | `0711-9876543` |
| AccountId | `{{Ref:testAccount}}` |
| referenceId | `testContact` |

---

### 3. Cases

#### 3a. Case

| Field | Value |
|-------|-------|
| sObject | `Case` |
| AccountId | `{{Ref:testAccount}}` |
| ContactId | `{{Ref:testContact}}` |
| Subject | `Test Case {{Today}}` |
| Status | `New` |
| Origin | `Phone` |
| Description | `Test case` |
| referenceId | `testCase` |

---

## Dependency Order

1. **Accounts** — No dependencies
2. **Contacts** — Need Account IDs from step 1
3. **Cases** — Need Account IDs from step 1 and Contact IDs from step 2

## Notes

- All `{{Today}}` tokens are replaced with the current date (YYYY-MM-DD) to make test data identifiable
- All `{{Today+Nd}}` tokens are replaced with current date plus N days
- All `{{Year}}` tokens are replaced with the current year
- All `{{Ref:<referenceId>}}` tokens are replaced with the Salesforce ID of the referenced record created earlier
- Record Type DeveloperNames are verified against the repository metadata — the skill queries the actual RecordType IDs at runtime
- Field API names follow domain knowledge from `domain-knowledge.md` — use exact spelling to avoid deployment errors
