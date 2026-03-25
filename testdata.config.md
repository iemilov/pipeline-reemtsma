# Test Data Configuration: Reemtsma GMmbH

## Overview

This configuration defines test data records for Reemtsma's Salesforce CRM. Records are organized by dependency order — parent records are created first.

**Target:** Salesforce CRM (reemtsma--uat.sandbox.my.salesforce.com)
**Auth:** OAuth 2.0 Bearer Token (from `/services/oauth2/token`)
**API Version:** 59.0
**Object Formats:** Salesforce sObject notation

---

## Record Groups

### 1. Brand Records (Parent — No Dependencies)

**API Method & Endpoint:** Salesforce REST PATCH/POST to Brand__c
**Purpose:** Master brand records used across campaigns and loyalty

| Field | Record 1 (West) | Record 2 (JPS) | Record 3 (Gauloises) | Record 4 (Paramount) | Record 5 (Davidoff) | Record 6 (Skruf) |
|-------|-----------------|-----------------|--------|---------|--------|---------|
| `Name` | West | JPS | Gauloises | Paramount | Davidoff | Skruf |
| `BrandIdentifier__c` | WEST3456 | JPS37652 | GA567434 | PAR78910 | DAV4466 | SKRF2566 |
| `BrandCatalogUrl__c` | https://brand.de/products | https://brand.de/products | https://brand.de/products | https://brand.de/products | https://brand.de/products | https://brand.de/products |
| `Status__c` | Active | Active | Active | Active | Active | Active |
| `referenceId` | `brand_west` | `brand_jps` | `brand_gauloises` | `brand_paramount` | `brand_davidoff` | `brand_skruf` |

---

### 2. Campaign Records (Parent — No Dependencies)

**API Method & Endpoint:** Salesforce REST POST to Campaign__c
**Purpose:** Marketing campaigns with unique AVLCode__c identifiers

| Field | Record 1 (West Summer) | Record 2 (JPS Winter) | Record 3 (Gauloises Spring) |
|-------|--------|--------|---------|
| `Name` | West Summer Campaign 2026 | JPS Winter Challenge 2026 | Gauloises Spring Promo |
| `AVLCode__c` | `010153` | `020154` | `030155` |
| `Brand__c` | {{Ref:brand_west}} | {{Ref:brand_jps}} | {{Ref:brand_gauloises}} |
| `StartDate__c` | 2026-06-01 | 2026-12-01 | 2026-03-15 |
| `EndDate__c` | 2026-08-31 | 2027-02-28 | 2026-05-31 |
| `Status__c` | Active | Active | Active |
| `Description__c` | Summer campaign with coupons | Winter loyalty challenge | Spring product launch |
| `referenceId` | `campaign_west_summer` | `campaign_jps_winter` | `campaign_gauloises_spring` |

---

### 3. Product Records (Parent — No Dependencies)

**API Method & Endpoint:** Salesforce REST POST to Product2
**Purpose:** Tobacco products and coupon offers

| Field | Record 1 (Coupon) | Record 2 (Regular) | Record 3 (Premium) |
|-------|--------|--------|---------|
| `Name` | West Silver Coupon | JPS Regular Pack | Gauloises Gold Filter |
| `ProductCode` | COUPON_WEST_001 | PROD_JPS_001 | PROD_GAULOISE_001 |
| `IsActive` | true | true | true |
| `Family` | Coupon | Cigarette | Cigarette |
| `referenceId` | `product_coupon_west` | `product_jps_regular` | `product_gauloises_gold` |

---

### 4. Campaign Product Records (Child — Depends on Campaigns & Products)

**API Method & Endpoint:** Salesforce REST POST to Campaign_Product__c
**Purpose:** Link products to campaigns with coupon settings

| Field | Record 1 | Record 2 | Record 3 |
|-------|----------|----------|----------|
| `Campaign__c` | {{Ref:campaign_west_summer}} | {{Ref:campaign_jps_winter}} | {{Ref:campaign_gauloises_spring}} |
| `Product__c` | {{Ref:product_coupon_west}} | {{Ref:product_jps_regular}} | {{Ref:product_gauloises_gold}} |
| `IsCoupon__c` | true | false | false |
| `RedemptionPoints__c` | 50 | — | — |
| `referenceId` | `camp_prod_coupon_west` | `camp_prod_jps_regular` | `camp_prod_gauloise_gold` |

---

### 5. Campaign Question Records (Child — Depends on Campaigns)

**API Method & Endpoint:** Salesforce REST POST to Campaign_Question__c
**Purpose:** Profile completion questions shown to consumers

| Field | Record 1 (Duration) | Record 2 (Frequency) | Record 3 (Brand Pref) |
|-------|--------|--------|---------|
| `Campaign__c` | {{Ref:campaign_west_summer}} | {{Ref:campaign_west_summer}} | {{Ref:campaign_jps_winter}} |
| `Question__c` | How long have you been smoking? | How frequently do you smoke per day? | Which brands interest you? |
| `QuestionType__c` | SingleSelect | SingleSelect | MultiSelect |
| `IsRequired__c` | true | true | false |
| `referenceId` | `question_duration` | `question_frequency` | `question_brands` |

---

### 6. Campaign Answer Records (Child — Depends on Campaign Questions)

**API Method & Endpoint:** Salesforce REST POST to Campaign_Answer__c
**Purpose:** Predefined answers with loyalty points

| Field | Record 1 | Record 2 | Record 3 | Record 4 |
|-------|----------|----------|----------|----------|
| `Question__c` | {{Ref:question_duration}} | {{Ref:question_duration}} | {{Ref:question_frequency}} | {{Ref:question_frequency}} |
| `AnswerText__c` | Less than 3 years | 3 to 5 years | 1-5 per day | 6-10 per day |
| `PointsReward__c` | 5 | 5 | 5 | 5 |
| `referenceId` | `answer_duration_1` | `answer_duration_2` | `answer_freq_1` | `answer_freq_2` |

---

### 7. Test Consumer Accounts (Parent — No Dependencies)

**API Method & Endpoint:** Salesforce REST POST to Account (Person Account)
**Purpose:** Consumer accounts for testing registration, engagement, loyalty

**Record 1: Fresh Registration Test**

| Field | Value |
|-------|-------|
| `FirstName` | John |
| `LastName` | Doe |
| `PersonEmail` | john.doe.test@example.com |
| `Phone` | +49555001122 |
| `PersonMailingStreet` | Schillerstr. |
| `PersonMailingHouseNumber__pc` | 19 |
| `PersonMailingPostalCode` | 80336 |
| `PersonMailingCity` | Munich |
| `Birthdate__pc` | 1990-05-15 |
| `Gender__pc` | 1 |
| `GlobalAccountStatus__pc` | Aktiv |
| `WebsiteStatus__pc` | Registration complete |
| `DoubleOptIn__pc` | true |
| `ConsentWestEmail__c` | true |
| `ConsentJPSEmail__c` | false |
| `DurationOfConsumption__pc` | 2 |
| `FrequencyOfConsumption__pc` | 3 |
| `PersonMobilePhone` | +49555001122 |
| `HasInterestInCombustiveAlternatives__pc` | false |
| `referenceId` | `account_john_doe` |

**Record 2: Engagement Test**

| Field | Value |
|-------|-------|
| `FirstName` | Jane |
| `LastName` | Smith |
| `PersonEmail` | jane.smith.test@example.com |
| `Phone` | +49555002233 |
| `PersonMailingStreet` | Marienplatz |
| `PersonMailingHouseNumber__pc` | 5 |
| `PersonMailingPostalCode` | 80331 |
| `PersonMailingCity` | Munich |
| `Birthdate__pc` | 1988-03-22 |
| `Gender__pc` | 2 |
| `GlobalAccountStatus__pc` | Aktiv |
| `WebsiteStatus__pc` | Registration complete |
| `DoubleOptIn__pc` | true |
| `ConsentJPSEmail__c` | true |
| `ConsentJPSPhone__c` | true |
| `DurationOfConsumption__pc` | 3 |
| `FrequencyOfConsumption__pc` | 2 |
| `LoginJPS__pc` | true |
| `referenceId` | `account_jane_smith` |

**Record 3: Duplicate Detection Test**

| Field | Value |
|-------|-------|
| `FirstName` | Robert |
| `LastName` | Brown |
| `PersonEmail` | robert.brown.test@example.com |
| `Phone` | +49555003344 |
| `PersonMailingStreet` | Karlsplatz |
| `PersonMailingHouseNumber__pc` | 12 |
| `PersonMailingPostalCode` | 80335 |
| `PersonMailingCity` | Munich |
| `Birthdate__pc` | 1980-01-15 |
| `Gender__pc` | 1 |
| `GlobalAccountStatus__pc` | Aktiv |
| `WebsiteStatus__pc` | Registration complete |
| `DoubleOptIn__pc` | true |
| `referenceId` | `account_robert_brown` |

**Record 4: Loyalty Tier Test**

| Field | Value |
|-------|-------|
| `FirstName` | Alice |
| `LastName` | Johnson |
| `PersonEmail` | alice.johnson.test@example.com |
| `Phone` | +49555004455 |
| `PersonMailingStreet` | Neuschwanstein Str. |
| `PersonMailingHouseNumber__pc` | 25 |
| `PersonMailingPostalCode` | 87629 |
| `PersonMailingCity` | Füssen |
| `Birthdate__pc` | 1992-07-10 |
| `Gender__pc` | 2 |
| `GlobalAccountStatus__pc` | Aktiv |
| `WebsiteStatus__pc` | Registration complete |
| `DoubleOptIn__pc` | true |
| `ConsentGauloisesEmail__c` | true |
| `ConsentGauloisesPhone__c` | true |
| `DurationOfConsumption__pc` | 2 |
| `FrequencyOfConsumption__pc` | 4 |
| `SideBrand__pc` | {{Ref:brand_davidoff}} |
| `HasInterestInCombustiveAlternatives__pc` | true |
| `referenceId` | `account_alice_johnson` |

---

### 8. Campaign Member Records (Child — Depends on Accounts & Campaigns)

**API Method & Endpoint:** Salesforce REST POST to CampaignMember
**Purpose:** Link consumers to campaigns, track registration source

| Field | Record 1 | Record 2 | Record 3 | Record 4 |
|-------|----------|----------|----------|----------|
| `AccountId` | {{Ref:account_john_doe}} | {{Ref:account_jane_smith}} | {{Ref:account_robert_brown}} | {{Ref:account_alice_johnson}} |
| `CampaignId` | {{Ref:campaign_west_summer}} | {{Ref:campaign_jps_winter}} | {{Ref:campaign_west_summer}} | {{Ref:campaign_gauloises_spring}} |
| `Status` | Member | Responded | Member | Member |
| `DateAdded` | 2026-06-15 | 2026-12-20 | 2026-06-18 | 2026-03-25 |
| `referenceId` | `camp_mem_john_west` | `camp_mem_jane_jps` | `camp_mem_robert_west` | `camp_mem_alice_gaul` |

---

### 9. Loyalty Member Tier Records (Child — Depends on Accounts)

**API Method & Endpoint:** Salesforce REST POST to LoyaltyMemberTier__c
**Purpose:** Track loyalty status per consumer per brand

| Field | Record 1 (John-West) | Record 2 (Jane-JPS) | Record 3 (Alice-Gauloises) |
|-------|--------|--------|---------|
| `Account__c` | {{Ref:account_john_doe}} | {{Ref:account_jane_smith}} | {{Ref:account_alice_johnson}} |
| `Brand__c` | {{Ref:brand_west}} | {{Ref:brand_jps}} | {{Ref:brand_gauloises}} |
| `Sequence__c` | 1 | 2 | 3 |
| `CurrentTier__c` | Bronze | Silver | Gold |
| `BalanceStatusPoints__c` | 45 | 175 | 325 |
| `BalanceBonusPoints__c` | 10 | 25 | 50 |
| `PointsForReachingNextTier__c` | 55 | 75 | 175 |
| `NextPointsExpirationDate__c` | 2027-03-25 | 2027-03-25 | 2027-03-25 |
| `referenceId` | `loyalty_john_west` | `loyalty_jane_jps` | `loyalty_alice_gaul` |

---

### 10. Engagement Tracking Records (Child — Depends on Accounts)

**API Method & Endpoint:** Salesforce REST POST to EngagementTracking__c
**Purpose:** Log consumer interactions (logins, content, events, profile completion)

**Record 1: Login Engagement**

| Field | Value |
|-------|-------|
| `Account__c` | {{Ref:account_jane_smith}} |
| `Brand__c` | JPS |
| `Category__c` | Website general |
| `Engagement_Type__c` | Log-in |
| `EngagementDate__c` | 2026-03-25T10:30:00Z |
| `PointsAwarded__c` | 5 |
| `LoyaltyTierUpdate__c` | {{Ref:loyalty_jane_jps}} |
| `referenceId` | `engage_jane_login_1` |

**Record 2: Content Like Engagement**

| Field | Value |
|-------|-------|
| `Account__c` | {{Ref:account_john_doe}} |
| `Brand__c` | West |
| `Category__c` | Content |
| `Engagement_Type__c` | Click |
| `ArticleID__c` | article_12345 |
| `ArticleText__c` | Top 10 Smoking Tips for Beginners |
| `ConsumerContentLikeCombination__c` | {{Ref:account_john_doe}}_article_12345 |
| `EngagementDate__c` | 2026-03-24T15:45:00Z |
| `PointsAwarded__c` | 3 |
| `LoyaltyTierUpdate__c` | {{Ref:loyalty_john_west}} |
| `referenceId` | `engage_john_click_1` |

**Record 3: Event Attendance Engagement**

| Field | Value |
|-------|-------|
| `Account__c` | {{Ref:account_alice_johnson}} |
| `Brand__c` | Gauloises |
| `Category__c` | Content |
| `Engagement_Type__c` | Event |
| `EventId__c` | event_999 |
| `EventUrl__c` | https://gauloises-events.de/spring-festival-2026 |
| `ConsumerEventIdCombination__c` | {{Ref:account_alice_johnson}}_event_999 |
| `EngagementDate__c` | 2026-03-22T18:00:00Z |
| `PointsAwarded__c` | 10 |
| `LoyaltyTierUpdate__c` | {{Ref:loyalty_alice_gaul}} |
| `referenceId` | `engage_alice_event_1` |

**Record 4: Profile Completion Engagement**

| Field | Value |
|-------|-------|
| `Account__c` | {{Ref:account_alice_johnson}} |
| `Brand__c` | Gauloises |
| `Category__c` | Website general |
| `Engagement_Type__c` | Profile Completion |
| `EngagementDate__c` | 2026-03-20T12:00:00Z |
| `PointsAwarded__c` | 50 |
| `LoyaltyTierUpdate__c` | {{Ref:loyalty_alice_gaul}} |
| `referenceId` | `engage_alice_profile_complete` |

---

## Presets

Named presets bundle record groups for common testing scenarios:

| Preset Name | Record Groups | Org Alias | Description |
|-------------|---------------|-----------|-------------|
| `minimal-setup` | 1, 2, 3, 4 | uat | Brands, campaigns, products only (no consumer data) |
| `registration-test` | 1, 2, 7 (Records 1, 3), 8 (Records 1, 3) | uat | Test fresh registration + duplicate detection |
| `engagement-test` | 1, 2, 8, 10 (Records 1-3) | uat | Test logins, content interactions, events |
| `loyalty-complete` | 1, 2, 3, 4, 5, 6, 7 (All), 8 (All), 9 (All), 10 (All) | uat | Complete test suite with all entity types |
| `profile-completion` | 1, 2, 7 (Record 4), 8 (Record 4), 9 (Record 3), 10 (Record 4) | uat | Test profile completion & tobacco alternatives |
| `loyalty-tier-progression` | 1, 2, 7 (Record 4), 8 (Record 4), 9 (Record 3) | uat | Test loyalty tier management |

---

## Dependency Order

### Execution Sequence (Required)

1. **Brand Records** — No dependencies (6 records)
2. **Campaign Records** — Depend on Brand (3 records)
3. **Product Records** — No dependencies (3 records)
4. **Campaign Product Records** — Depend on Campaign + Product (3 records)
5. **Campaign Question Records** — Depend on Campaign (3 records)
6. **Campaign Answer Records** — Depend on Campaign Question (4 records)
7. **Test Consumer Accounts** — No dependencies (4 records)
8. **Campaign Member Records** — Depend on Account + Campaign (4 records)
9. **Loyalty Member Tier Records** — Depend on Account (3 records)
10. **Engagement Tracking Records** — Depend on Account + LoyaltyMemberTier (4 records)

---

## Testing Scenarios Enabled by These Records

| Scenario | Uses Accounts | Uses Campaigns | Uses Engagement | Purpose |
|----------|---------------|-----------------|-----------------|---------|
| Fresh Registration | John Doe | West Summer | — | Test new consumer creation flow |
| Duplicate Detection | Robert Brown (duplicate name as setup) | West Summer | — | Test email + name mismatch blocking |
| Engagement Tracking | Jane Smith | JPS Winter | Logins, Clicks, Events | Test point awards and tier updates |
| Loyalty Tier Progression | Alice Johnson | Gauloises Spring | Profile Completion | Test tier-up automation |
| Profile Completion | Alice Johnson | Gauloises Spring | ✓ | Test optional field rewards |
| Campaign Registration Flow | All consumers | All campaigns | ✓ | End-to-end workflow testing |

---

## Notes

### Token Replacement
- All `{{Ref:<referenceId>}}` tokens are replaced with actual Salesforce IDs created in prior steps
- Example: `{{Ref:campaign_west_summer}}` becomes the actual Campaign__c ID after step 2

### Timestamps
- All `EngagementDate__c` values use ISO 8601 format with UTC timezone (Z)
- Adjust timestamps based on test execution date (records use relative dates: -1 day, -2 days, etc.)

### Email Safety
- All test email addresses use `.test@example.com` domain
- In production deployments, change to non-interfering test domains
- Emails are **not** sent to external services (Schufa, Marketing Cloud) during test mode

### Salesforce-Specific Notes
- **Person Accounts:** All Account records are Person Accounts (IsPersonAccount = true, auto-set by Salesforce)
- **Currency:** Field values assume EUR (Reemtsma's operating currency)
- **Timezone:** Times in UTC; Salesforce org converts to local timezone (Europe/Berlin)
- **API Version:** Use API v59.0 for all requests (matching sfdx-project.json)
- **Bulk Operations:** For large preset loads (>100 records), use Bulk API 2.0 instead of REST

### Cleanup
- Add suffix (e.g., `_TEST`, `_SANDBOX`) to all test records for easy identification
- Implement cleanup job to purge old test data (by creation date older than 30 days)
- Use `/cleanup-testdata <org-alias>` skill to remove test records interactively

### Refresh & Persistence
- Test accounts can be manually re-created in sandbox (no persistence requirement)
- Sandbox is refreshed periodically — maintain backup of test data configs
- Keep these configurations version-controlled (git) for reproducibility

---

## Creating Test Data via CLI

### Using Salesforce REST API

```bash
# Authenticate
sf auth web login --org-alias=uat

# Create a single record
sf data create record --sobject=Account \
  --values="FirstName=John LastName=Doe PersonEmail=john.doe@example.com" \
  --target-org=uat

# Bulk create via file (JSON format)
sf data create record --sobject=Brand__c \
  --input-file=scripts/brand-records.json \
  --target-org=uat

# Query to verify
sf data query --query "SELECT Id, Name FROM Brand__c" --target-org=uat
```

### Using Apex Anonymous Execution

```bash
# Execute Apex to create test data (via script file)
sf apex run --file=scripts/apex/create-testdata.apex --target-org=uat
```

### Using the `/create-testdata` Skill

```bash
# Interactive preset selection
/create-testdata uat loyalty-complete

# Preset-based creation (West campaign setup)
/create-testdata uat registration-test

# Preset: Engagement & Loyalty testing
/create-testdata uat engagement-test
```
