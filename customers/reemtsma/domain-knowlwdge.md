# Domain Knowledge: Reemtsma GMmbH

> Letzte Aktualisierung: 2026-03-25 | Platform: Salesforce | Primary Brands: West, JPS, Gauloises, Paramount, Davidoff, Skruf

## Glossary

Common abbreviations and terminology used throughout the codebase and documentation:

| Abbreviation | Full Term | English |
|-------------|-----------|---------|
| **COD** | Chief Operating Distributor / Customer Order Distribution System | External web platform (consumer-facing) |
| **DOI** | Double Opt-In | Email verification workflow for DSGVO compliance |
| **CRM** | Customer Relationship Management | Salesforce instance (reemtsma--uat.sandbox.my.salesforce.com) |
| **CMT** | Custom Metadata Type | Salesforce configuration (read-only, deployable) |
| **Schufa** | Schufa-Auskunftei | German credit bureau for consumer validation |
| **POP** | Point of Purchase | In-store coupon redemption |
| **HoReCa** | Hotel, Restaurant, Café | Hospitality sector distribution channel |
| **AVLCode** | Campaign Availability Code | Unique campaign identifier (e.g., "010153") |
| **WebStatus** | Website Status | Consumer account completion status (Email pending, Password pending, Complete) |
| **GlobalStatus** | Global Account Status | Overall account state (Aktiv, Inaktiv, Werbeverweigerer - Blacklist) |
| **HashConsumerId** | Hashed Consumer ID | One-way encrypted consumer ID used in email links (prevents ID enumeration) |
| **Loyalty Tier** | LoyaltyMemberTier__c | Consumer's current level in loyalty program (Bronze, Silver, Gold, Platinum) |
| **Engagement Points** | Interaction-based Points | Points awarded for logins, content interactions, events, profile completion |
| **Status Points** | Loyalty Tier Points | Points earned toward tier progression (used in tier advancement) |
| **Bonus Points** | Promotional Points | Extra points awarded for special campaigns or achievements |

## Business Processes

### 1. Registration Campaign Management

The Registration process is the primary entry point for new consumers into the Reemtsma ecosystem. It handles consumer identity validation, duplicate detection, credit checks (Schufa), and initiates the email verification (DOI) workflow.

**Key Steps:**
1. COD sends registration request to Salesforce REST API (`/services/apexrest/registerConsumer`)
2. SF validates input fields and performs duplicate detection:
   - **Primary:** Email exact match (case-insensitive)
   - **Secondary/Tertiary:** FirstName + LastName + Birthdate + Address combinations
3. If no duplicate found: Schufa credit check is performed (external, 3-5 seconds)
4. On success: Account created with status "Aktiv", WebStatus "E-Mail verification pending"
5. Marketing Cloud sends verification email with hashed consumer ID link
6. Consumer clicks link → WebStatus updates to "Password pending"
7. Consumer sets password → COD sends final status update to SF → "Registration complete"

**Response Codes:**
- `1` = New Consumer (success)
- `2` = Pending Action (resend email, password setup)
- `3` = Duplicate Active (account already exists)
- `4` = Blocked Status (account on blacklist)
- `5` = Reactivation Success (inactive account reactivated)
- `6-10, 99` = Various error states (campaign fraud, limits exceeded, Schufa failures, validation errors)

**Key Business Rules:**
- Email + Name match with Aktiv status → Block (prevent duplicates)
- Email mismatch with name → Block (prevent account takeover)
- Inactive account with matching email + name → Allow reactivation
- Schufa negative → Block registration
- Registration limit per IP or retailer → Block with 24h timeout
- Campaign must exist (validated via AVLCode__c)
- Consent (consent_all=true) is mandatory

**Critical Fields on Account:**
- `PersonEmail` — primary duplicate detection key
- `FirstName`, `LastName` — secondary/tertiary duplicate detection
- `Birthdate__pc` — age validation + duplicate detection
- `PersonMailingPostalCode`, `PersonMailingCity`, `PersonMailingStreet` — address-based duplicate detection
- `GlobalAccountStatus__pc` — Aktiv / Inaktiv / Werbeverweigerer - Blacklist
- `WebsiteStatus__pc` — E-Mail verification pending / Password pending / Registration complete
- `HashConsumerId__pc` — used in email verification links
- `Gender__pc` — 1=Herr, 2=Frau, 3=Divers (added 16.04.2024)

### 2. Campaign Management

Campaign Management defines marketing campaigns and their associated products, redemption options, and consumer engagement questions. Campaigns are Brand-specific and serve as the context for consumer registration, loyalty tier assignment, and engagement tracking.

**Key Steps:**
1. Campaign created in SF with unique `AVLCode__c` identifier
2. Products assigned to campaign (coupon vs. regular products)
3. Redemption options configured per product (Online, POP, Promoter, Vending, HoReCa)
4. Profile completion questions and answers configured (with points rewards)
5. Campaign published and available via API
6. Consumer registers with campaign code → Campaign Member record auto-created
7. Campaign Member insert triggers Loyalty Tier creation and Engagement Point initialization

**Campaign Lookup Scenarios:**
- Registration validation: Campaign code must exist (`AVLCode__c`)
- Fraud prevention: Consumer cannot register twice with same campaign
- Product retrieval: Get all products + coupon details for campaign
- Q&A retrieval: Get all questions/answers for campaign (profile completion)
- Redemption validation: Verify channel availability for product in campaign

**Key Objects:**
- `Campaign__c` (custom) — Master campaign record with AVLCode__c
- `CampaignMember` (standard) — Links consumer (Account) to Campaign
- `Campaign_Product__c` (custom) — Maps products to campaigns
- `Campaign_Question__c` (custom) — Profile completion questions
- `Campaign_Answer__c` (custom) — Answers with point rewards
- `Redemption_Option__c` (custom) — Channel availability per product

**Critical Business Rules:**
- Campaign identified by `AVLCode__c` (not Name, which can be non-unique)
- 1 Campaign : 1 Brand (no multi-brand campaigns)
- Consumer can only register once per campaign (fraud check → Response Code 6)
- All products in campaign available in all redemption channels OR channel validation required per product
- Campaign status (Active/Archived) controls new registrations
- Archived campaigns prevent new member creation but preserve existing members

### 3. Engagement Tracking Service

Engagement Tracking measures and rewards consumer interactions with the Reemtsma ecosystem. Every interaction (login, content click, event attendance, profile field completion) is recorded and points are awarded, automatically triggering loyalty tier updates.

**Supported Interactions:**
- **Login** (Category: Interaction) — Daily login, 5 points/day max, per brand (deduplicated)
- **Content Like** (Category: Content) — Like button on article, 3 points, unique per article + consumer
- **Content Read** (Category: Content) — Read text article, 2 points per article
- **Event Attendance** (Category: Content) — Participate in event, 10 points per event
- **Purchase Intention** (Category: Interaction) — Indicate intent to purchase, 2 points per brand (1 per brand max)
- **Profile Completion** (Category: Profile_Completion) — Fill optional profile field, 10 status points + 9 engagement points per field

**Profile Completion Fields:**
- `SideBrandId` — Secondary brand preference
- `DurationOfConsumption` — How long consuming brand (enum: <3 years, 3-5 years, >5 years)
- `FrequencyOfConsumption` — Frequency per day/week (enum: 1-5, 6-10, 11-20, >20)
- `Mobile` — Mobile device info
- `HasInterestInCombustiveAlternatives` — Interest in e-cigarettes, pouches, heat-not-burn (tree structure with brand options)

**Key Validations:**
- Consent required: `ConsentXXXEmail__c` (or Phone/Mail based on channel) must be true for Brand
- Unique keys enforced: Content interactions use `HashConsumerId + ArticleID` (prevents duplicate clicks)
- Login deduplication: Only 1 login per consumer + brand + calendar day = 5 points
- Interaction rules loaded from `EngagementTrackingRule__mdt` (config-driven, no hardcoding)

**Data Flow:**
1. COD sends engagement request: `POST /engagementService` with ConsumerId, Brand, Category, Type, Data
2. SF validates consent, unique key, and engagement type
3. EngagementTracking__c record created with metadata
4. Flow triggers → looks up EngagementTrackingRule__mdt → retrieves point value
5. LoyaltyMemberTier__c updated with new points (via LoyaltyPointsService)
6. Tier-up logic evaluates if consumer advances to next tier

**Critical Fields on EngagementTracking__c:**
- `Account__c` — Consumer link
- `Brand__c` — Brand context
- `Category__c` — Content / Interaction / Profile_Completion
- `Engagement_Type__c` — Specific action type
- `ConsumerXCombination__c` — Unique key (prevents duplicates)
- `PointsAwarded__c` — Points for this interaction (auto-populated from CMT)

### 4. Loyalty Management

Loyalty Management tracks consumer tier progression, points accumulation, prize availability, and redemption. The system awards tiers (Bronze, Silver, Gold, Platinum) based on engagement and status points, manages point expiration, and enables prize claims via coupon redemption.

**Key Concepts:**
- **Loyalty Tier** (`LoyaltyMemberTier__c`) — Consumer's current membership level per brand
- **Status Points** (`BalanceStatusPoints__c`) — Points for tier progression (earned through engagement, reset on tier-up)
- **Bonus Points** (`BalanceBonusPoints__c`) — Extra promotional points (never expire or longer expiry)
- **Tier Sequence** (`Sequence__c`) — Current tier ID (Bronze=1, Silver=2, Gold=3, Platinum=4)
- **Points for Next Tier** (`PointsForReachingNextTier__c`) — Remaining points needed for next tier
- **Expiration Date** (`NextPointsExpirationDate__c`) — When current batch of points expires

**Tier Structure (Brand-specific mapping):**
- **Bronze Tier** — Entry level (0-99 points)
- **Silver Tier** — Mid-level (100-249 points)
- **Gold Tier** — High level (250-499 points)
- **Platinum Tier** — Premium (500+ points)

**Point Lifecycle:**
1. Consumer earns points through engagement (login, content, profile completion, events)
2. Status Points accumulate in `BalanceStatusPoints__c`
3. When threshold reached (e.g., 100 points) → Consumer moves to next tier
4. Tier-up event triggered → Points reset (some stay, some expire based on rules)
5. Bonus points never counted toward tier progression (separate bucket)
6. Points expire based on `NextPointsExpirationDate__c` (typically 12-24 months)

**Scheduled Jobs:**
- **LoyaltyMemberTierScheduled** — Reduces expired points (scheduled, nightly)
- **LoyaltyMemberTier_Anniversary_scheduled** — Resets/refreshes points on anniversary date

**Prize Redemption:**
- Consumer with sufficient points calls `POST /redeemLoyaltyPoints`
- SF validates: Points balance >= coupon cost, coupon available, channel allowed
- Coupon-Interaction created (tracks redemption history)
- Points deducted from `BalanceStatusPoints__c`
- Consumer receives reward (code, link, or direct benefit)
- Analytics updated for dashboard

**Key Fields on LoyaltyMemberTier__c:**
- `Account__c` — Consumer
- `Brand__c` — Brand context
- `Sequence__c` — Current tier ID
- `BalanceStatusPoints__c` — Points toward next tier
- `BalanceBonusPoints__c` — Promotional points
- `PointsForReachingNextTier__c` — Points needed for tier-up (calculated)
- `NextPointsExpirationDate__c` — When current points expire
- `CurrentTier__c` — Tier name (Bronze, Silver, Gold, Platinum)

**Critical Business Rules:**
- Only status points count toward tier progression (bonus points excluded)
- Tier-up is automatic (via flow/batch when threshold reached)
- Points expire after defined period (e.g., 12 months from award date)
- Consumer must have active engagement (recent login or interaction) to redeem
- Loyalty tier created automatically on Campaign Member insert
- Brand-specific tier thresholds can differ (configured via CMT or custom settings)

## Common Field Name Pitfalls

Frequently confused field names — use the correct spelling to avoid deployment errors:

| Correct | Common Mistake |
|---------|---------------|
| `PersonEmail` | ~~Email~~, ~~ConsumerEmail__c~~ |
| `Birthdate__pc` | ~~BirthDate__c~~, ~~DOB__c~~ |
| `PersonMailingPostalCode` | ~~ZIP__c~~, ~~PostalCode__c~~ |
| `PersonMailingCity` | ~~City__c~~ |
| `PersonMailingStreet` | ~~Street__c~~, ~~StreetName__c~~ |
| `PersonMailingHouseNumber__pc` | ~~HouseNumber__c~~, ~~HouseNum__c~~ |
| `GlobalAccountStatus__pc` | ~~AccountStatus__c~~, ~~Status__c~~ |
| `WebsiteStatus__pc` | ~~RegistrationStatus__c~~, ~~WebStatus__c~~ (close, but plural) |
| `DoubleOptIn__pc` | ~~DOI__c~~, ~~OptIn__c~~ |
| `HashConsumerId__pc` | ~~ConsumerIdHashed__c~~ (correct in API response, but field is HashConsumerId) |
| `EngagementTracking__c` | ~~Engagement__c~~, ~~Interaction__c~~ |
| `LoyaltyMemberTier__c` | ~~LoyaltyTier__c~~, ~~ConsumerLoyalty__c~~ |
| `BalanceStatusPoints__c` | ~~StatusPoints__c~~ (needs Balance prefix) |
| `BalanceBonusPoints__c` | ~~BonusPoints__c~~ (needs Balance prefix) |
| `EngagementTrackingRule__mdt` | ~~EngagementRule__mdt~~, ~~PointsRule__mdt~~ |
| `ConsentWestEmail__c` | ~~ConsentEmail__c~~, ~~WestConsent__c~~ (must include brand name) |
| `LoginWest__pc` | ~~WestLogin__c~~, ~~LoginFlag__c~~ (pc = person custom, not standard field) |
| `AVLCode__c` | ~~CampaignCode__c~~, ~~Code__c~~ (specific to campaign, not generic) |

## Important Record IDs & System Values

| Record / Value | ID / Code | Notes |
|--------|--------|--------|
| Portal Account | `001x000xxx35tPN` | Hard-coded in SiteRegisterController (legacy, not used by COD) |
| West Brand ID | `WEST3456` | Used in identifier field, links to Brand Communication Preference |
| JPS Brand ID | `JPS37652` | Standard JPS identifier |
| Gauloises Brand ID | `GA567434` | Standard Gauloises identifier |
| Paramount Brand ID | `PAR78910` | Standard Paramount identifier |
| Davidoff Brand ID | `DAV4466` | Standard Davidoff identifier |
| Skruf Brand ID | `SKRF2566` | Standard Skruf identifier |
| Schufa Service | Named Credential | External credit bureau API (config in Named Credentials) |
| Marketing Cloud | Named Credential | Email service for DOI verification emails |
| Gender Male | `1` | Enum value for Mr. / Herr |
| Gender Female | `2` | Enum value for Ms. / Frau |
| Gender Other | `3` | Enum value for Other / Divers (added 16.04.2024) |

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/registerConsumer` | POST | Consumer registration, duplicate detection, account creation |
| `/campaignInfo` | GET | Fetch campaign details (products, redemption options, Q&A) |
| `/engagementService` | POST | Log consumer engagement (login, content, events, profile completion) |
| `/getCustomerLoyaltyPoints` | GET | Fetch loyalty tier, point balance, expiration dates |
| `/redeemLoyaltyPoints` | POST | Redeem points for coupon/prize |
| `/getLoyaltyPrizes` | GET | Fetch available prizes for consumer |
| `/getCouponRedemptionDetails` | GET | Fetch coupon details after redemption |

---

## Engagement Service API — Complete Process & Specification

### Overview

The Engagement Service API (`POST /services/apexrest/engagementService`) is the central endpoint for logging all consumer interactions with the Reemtsma ecosystem. It accepts various interaction types (logins, content interactions, events, profile completions, purchase intentions) and automatically:

1. Validates consumer identity and consent
2. Creates EngagementTracking__c records with metadata
3. Looks up point awards from EngagementTrackingRule__mdt
4. Updates LoyaltyMemberTier__c with new points
5. Triggers tier-up logic if thresholds reached

### API Endpoint Details

**Base URL:** `https://reemtsma--uat.sandbox.my.salesforce.com/services/apexrest/engagementService`

**HTTP Method:** POST

**Authentication:** Bearer Token (from OAuth2 token endpoint)

**Content-Type:** application/json

**Mandatory Parameters (in every request):**
- `ConsumerId` (string) — Unique consumer identifier (hashed or non-hashed both accepted)
- `Brand` (string) — Brand name: "West", "JPS", "Gauloises", "Paramount", "Davidoff", "Skruf"
- `Category` (string) — Interaction category: "Content", "Interaction", "Profile_completion"
- `Data` (object) — Category-specific payload (structure varies by engagement type)

### Engagement Type 1: Content Like

**Purpose:** Log when consumer clicks "Like" button on article/content

**Request:**
```json
{
  "ConsumerId": "179fd66d",
  "Brand": "West",
  "Category": "Content",
  "Data": {
    "ArticleID__c": "article-12345",
    "ArticleText__c": "Top 10 Smoking Tips for Beginners"
  }
}
```

**Backend Process:**
1. Extract ArticleID__c and ArticleText__c from Data
2. Create unique key: `HashConsumerId + ArticleID` (e.g., `abc123def456article-12345`)
3. Look up EngagementTrackingRule__mdt for "Content Like" → Points = 3
4. Create EngagementTracking__c record:
   - Category__c = "Content"
   - Engagement_Type__c = "Click"
   - ConsumerContentLikeCombination__c = unique key (prevents duplicate clicks)
   - ArticleID__c, ArticleText__c = stored for analytics
5. Call LoyaltyPointsService.upsertLoyaltyMemberTier() → update points

**Response:**
```json
{
  "status": "success",
  "message": "Content like engagement recorded",
  "pointsAwarded": 3,
  "currentBalance": 153,
  "newTierLevel": "Silver"
}
```

**Error Cases:**
- Consumer not found → 404 with error message
- Brand not matching consumer's profile → 400 with consent error
- Duplicate click (same ArticleID within dedup window) → 409 with conflict message

---

### Engagement Type 2: Content Read (Text)

**Purpose:** Log when consumer reads/scrolls through text article

**Request:**
```json
{
  "ConsumerId": "179fd66d",
  "Brand": "JPS",
  "Category": "Content",
  "Data": {
    "ArticleID__c": "text-5678",
    "ArticleText__c": "The History of JPS Cigarettes"
  }
}
```

**Backend Process:**
1. Extract ArticleID__c from Data
2. Create unique key: `HashConsumerId + ArticleID`
3. Look up EngagementTrackingRule__mdt for "Text" → Points = 2
4. Create EngagementTracking__c record:
   - Category__c = "Content"
   - Engagement_Type__c = "Text"
   - ConsumerArticleIdCombination__c = unique key
5. Update LoyaltyMemberTier__c + 2 points

**Response:**
```json
{
  "status": "success",
  "pointsAwarded": 2,
  "currentBalance": 155,
  "newTierLevel": "Silver"
}
```

---

### Engagement Type 3: Event Attendance

**Purpose:** Log consumer participation in brand event (online or offline)

**Request:**
```json
{
  "ConsumerId": "179fd66d",
  "Brand": "Gauloises",
  "Category": "Content",
  "Data": {
    "EventId__c": "event-999",
    "EventUrl__c": "https://gauloises-events.de/summer-festival-2026"
  }
}
```

**Backend Process:**
1. Extract EventId__c and EventUrl__c from Data
2. Create unique key: `HashConsumerId + EventID`
3. Look up EngagementTrackingRule__mdt for "Event" → Points = 10
4. Create EngagementTracking__c record:
   - Category__c = "Content"
   - Engagement_Type__c = "Event"
   - ConsumerEventIdCombination__c = unique key
   - EventUrl__c = stored for tracking
5. Update LoyaltyMemberTier__c + 10 points

**Response:**
```json
{
  "status": "success",
  "pointsAwarded": 10,
  "currentBalance": 165,
  "newTierLevel": "Silver"
}
```

---

### Engagement Type 4: Login

**Purpose:** Log daily login (deduplicated to 1 per consumer per brand per calendar day)

**Request:**
```json
{
  "ConsumerId": "179fd66d",
  "Brand": "West",
  "Category": "Interaction",
  "Data": {
    "LoginEventTech__pc": "Normal"
  }
}
```

**Alternative (Password Reset):**
```json
{
  "ConsumerId": "179fd66d",
  "Brand": "West",
  "Category": "Interaction",
  "Data": {
    "LoginEventTech__pc": "PWR"
  }
}
```

**Backend Process:**
1. Extract LoginEventTech__pc from Data (must be "Normal" or "PWR")
2. Check: Has consumer already logged in today (calendar date) for this brand?
   - If YES → Return null (no points awarded, no record created)
   - If NO → Continue
3. Look up EngagementTrackingRule__mdt for "Normal Login" → Points = 5
4. Update Account flags:
   - If consumer's GlobalAccountStatus != "Aktiv" → Set to "Aktiv", WebsiteStatus = "Registration complete"
   - Set brand-specific login flag: LoginWest__pc = true (or LoginJPS__pc, etc.)
5. Create EngagementTracking__c record:
   - Category__c = "Website general"
   - Engagement_Type__c = "Log-in"
6. Update LoyaltyMemberTier__c + 5 points

**Response (First Login Today):**
```json
{
  "status": "success",
  "pointsAwarded": 5,
  "currentBalance": 170,
  "newTierLevel": "Silver"
}
```

**Response (Duplicate Login Same Day):**
```json
{
  "status": "success",
  "message": "Already logged in today for this brand",
  "pointsAwarded": 0,
  "currentBalance": 170,
  "newTierLevel": "Silver"
}
```

---

### Engagement Type 5: Purchase Intention

**Purpose:** Log consumer's intent to purchase brand product

**Request:**
```json
{
  "ConsumerId": "179fd66d",
  "Brand": "Paramount",
  "Category": "Interaction",
  "Data": {
    "PurchaseIntention": true
  }
}
```

**Backend Process:**
1. Extract PurchaseIntention from Data (boolean)
2. If PurchaseIntention = true:
   - Look up EngagementTrackingRule__mdt for "Purchase Intention" → Points = 2
   - Create EngagementTracking__c record:
     - Category__c = "Interaction"
     - Engagement_Type__c = "PurchaseIntention"
   - Update LoyaltyMemberTier__c + 2 points
3. If PurchaseIntention = false:
   - No action (no record created, no points awarded)

**Response (Intent = True):**
```json
{
  "status": "success",
  "pointsAwarded": 2,
  "currentBalance": 172,
  "newTierLevel": "Silver"
}
```

**Response (Intent = False):**
```json
{
  "status": "success",
  "message": "Purchase intention not selected",
  "pointsAwarded": 0
}
```

---

### Engagement Type 6: Profile Completion

**Purpose:** Log completion of optional profile fields (SideBrandId, DurationOfConsumption, etc.)

**When Consumer Selects "NO" to Tobacco Alternatives:**

**Request:**
```json
{
  "ConsumerId": "179fd66d",
  "Brand": "JPS",
  "Category": "Profile_completion",
  "Data": {
    "HasInterestInCombustiveAlternatives": false
  }
}
```

**When Consumer Selects "YES" and Chooses Brands:**

**Request:**
```json
{
  "ConsumerId": "179fd66d",
  "Brand": "JPS",
  "Category": "Profile_completion",
  "Data": {
    "SideBrandId": "Gauloises",
    "DurationOfConsumption": 2,
    "FrequencyOfConsumption": 3,
    "Mobile": "+49555555",
    "HasInterestInCombustiveAlternatives": true,
    "InterestInCombustiveAlternatives": [
      {
        "question": "E-Zigaretten",
        "brand": ["blu", "Vuse"]
      },
      {
        "question": "Einweg E-Zigaretten",
        "brand": ["Crystal", "blu bar"]
      },
      {
        "question": "Tabakerhitzer",
        "brand": ["glo"]
      },
      {
        "question": "Tabakfreie Nicotine Pouches",
        "brand": ["Loop"]
      }
    ]
  }
}
```

**DurationOfConsumption Enum:**
- `1` = "Less than 3 years" / "Weniger als 3 Jahre"
- `2` = "3 to 5 years" / "3 bis 5 Jahre"
- `3` = "More than 5 years" / "Mehr als 5 Jahre"

**FrequencyOfConsumption Enum:**
- `1` = "1 to 5" / "1 bis 5 pro Tag"
- `2` = "6 to 10" / "6 bis 10 pro Tag"
- `3` = "11 to 20" / "11 bis 20 pro Tag"
- `4` = "More than 20" / "Mehr als 20 pro Tag"

**CombustiveAlternatives Categories & Brands:**
- **E-Zigaretten (E-Cigarettes):** Vuse, blu, Veev, other
- **Einweg E-Zigaretten (Disposable E-Cigarettes):** Crystal, Elfbar, blu bar, Vuse GO, other
- **Tabakerhitzer (Heat-Not-Burn):** IQOS, glo, other
- **Tabakfreie Nicotine Pouches (Nicotine Pouches):** Loop, Skruf, XQS, Velo, Scooper, other

**Backend Process:**
1. For each profile field received in Data:
   - Map to target Account field (via ProfileDataMapping__mdt)
   - Calculate loyalty points per field: 10 status points + variable engagement points
   - Store field name in Account.LoyaltyOptionalFieldsTech__pc (semicolon-separated list)
2. Update Account with new field values
3. Check each field against previous value:
   - If field changed from empty → award points
   - If field value same as before → NO points awarded (prevent re-awards)
4. If HasInterestInCombustiveAlternatives = true:
   - Parse InterestInCombustiveAlternatives array
   - Create/update ProfilePreference__c records (one per question-brand combination)
5. After all fields processed:
   - Check if Profile is 100% completed (all mandatory fields filled)
   - If YES and Profile_Completed__pc = false → Award 9 engagement points + mark Profile_Completed__pc = true
6. Call giveEngagementPointsForProfileCompletion() to create engagement tracking record

**Response (Some Fields Completed):**
```json
{
  "status": "success",
  "message": "Profile fields updated",
  "pointsAwarded": 19,
  "fieldsCompleted": {
    "SideBrandId": 10,
    "DurationOfConsumption": 10,
    "FrequencyOfConsumption": 10,
    "Mobile": 10,
    "ProfileCompletionBonus": 9
  },
  "currentBalance": 191,
  "newTierLevel": "Silver",
  "profileCompletion": "80%"
}
```

**Response (Full Profile Completed):**
```json
{
  "status": "success",
  "message": "Profile 100% completed!",
  "pointsAwarded": 49,
  "currentBalance": 240,
  "newTierLevel": "Gold",
  "profileCompletion": "100%"
}
```

---

### Error Handling & Response Codes

**HTTP 200 — Success**
- Engagement recorded successfully
- Points awarded and loyalty tier updated (or no points if duplicate/condition not met)

**HTTP 400 — Bad Request**
- Missing mandatory parameter (ConsumerId, Brand, Category, Data)
- Invalid Brand name (not in list: West, JPS, Gauloises, Paramount, Davidoff, Skruf)
- Invalid Data structure for engagement type
- Consumer not found in Salesforce
- Consumer's WebsiteStatus = "Deactivated" (no engagement for deactivated accounts)
- No Consent for Brand (ConsentXXXEmail__c = false and engagement requires consent)

**HTTP 404 — Not Found**
- Consumer ID does not exist in Salesforce

**HTTP 409 — Conflict**
- Duplicate engagement detected (same ArticleID/EventID already logged within dedup window)
- Should not block request, just return "already recorded" message

**HTTP 500 — Server Error**
- Salesforce internal error
- EngagementTrackingRule__mdt not found for engagement type
- LoyaltyPointsService update fails

**Error Response Format:**
```json
{
  "status": "error",
  "errorCode": "CONSENT_MISSING",
  "message": "Consumer has not granted consent for West brand engagement",
  "details": {
    "brand": "West",
    "missingConsent": "ConsentWestEmail__c"
  }
}
```

---

### Consent Validation

Before any engagement is recorded, the system validates that the consumer has provided consent for the Brand.

**Consent Mapping:**

| Brand | Email Consent Field | Phone Consent Field | Mail Consent Field |
|-------|-------------------|-------------------|------------------|
| West | ConsentWestEmail__c | ConsentWestPhone__c | ConsentWestMail__c |
| JPS | ConsentJPSEmail__c | ConsentJPSPhone__c | ConsentJPSMail__c |
| Gauloises | ConsentGauloisesEmail__c | ConsentGauloisesPhone__c | ConsentGauloisesMail__c |
| Paramount | ConsentParamountEmail__c | ConsentParamountPhone__c | ConsentParamountMail__c |
| Davidoff | ConsentDavidoffEmail__c | ConsentDavidoffPhone__c | ConsentDavidoffMail__c |
| Skruf | ConsentSkrufEmail__c | ConsentSkrufPhone__c | ConsentSkrufMail__c |

**Consent Check Logic:**
- At minimum, one of {Email, Phone, Mail} for the Brand must be = true
- If no consent → Reject engagement with HTTP 400

---

### Point Awards & Tier Progression

**Point Sources:**
- Content Like: 3 points
- Text Read: 2 points
- Event Attendance: 10 points
- Daily Login: 5 points (max 1 per day per brand)
- Purchase Intention: 2 points
- Profile Field Completion: 10 points per field
- Full Profile Completion: 9 additional engagement points

**Tier Thresholds (Brand-specific, typically):**
- Bronze: 0-99 status points
- Silver: 100-249 status points
- Gold: 250-499 status points
- Platinum: 500+ status points

**Tier-Up Automation:**
- After each engagement, LoyaltyPointsService.upsertLoyaltyMemberTier() calculates new tier
- If threshold crossed → Update Sequence__c (tier ID), send tier-up notification (optional)
- Bonus points NOT counted toward tier progression (separate bucket)

---

### Rate Limiting & Throttling

Currently NOT enforced in API (no explicit rate limit per request), but:
- Login events deduplicated per calendar day per brand
- Content clicks deduplicated per ArticleID per consumer (prevents spam)
- Large batch requests should be staggered (no burst limits documented, but best practice: max 10 requests/second per consumer)

---

### Auditing & Logging

All engagement records are audit-logged:
- EngagementTracking__c records are immutable after insert (no updates)
- Salesforce Audit Trail captures all changes to Account consent fields
- LoyaltyMemberTier__c changes tracked via field history tracking

---

### Integration Points

**Called By:**
- COD (Consumer Order Distribution) website
- Brand loyalty websites (west.de, jps.de, gauloises.de, etc.)
- Mobile apps (future)

**Calls To:**
- LoyaltyPointsService (update tier)
- InteractionService (validate consent, create records)
- EngagementTrackingRule__mdt (lookup points)
- ProfileDataMapping__mdt (map fields for profile completion)

**Called By:**
- Flows: EngagementTracking_AfterInsert, Before_Trigger_Engagement_Tracking
- Batch jobs: LoyaltyMemberTierScheduled (nightly point reduction)

## Key Apex Classes & Flows

| Component | Type | Purpose |
|-----------|------|---------|
| `LM_REST_CreateAccount` | Apex Class | Main registration endpoint (`/registerConsumer`), duplicate detection, Schufa integration |
| `EngagementService` | Apex Class | Engagement tracking logic (logins, content, events, profile completion) |
| `LoyaltyPointsService` | Apex Class | Loyalty tier updates, point accumulation, tier-up automation |
| `LM_CampaignService` | Apex Class | Campaign queries and validations |
| `CampaignMemberService` | Apex Class | Campaign Member CRUD and business logic |
| `InteractionService` | Apex Class | Helper for engagement tracking (consent validation, record creation) |
| `CampaignMemberAfterUpsertHandler` | Flow | Triggered after Campaign Member insert → creates Loyalty Tier, initializes engagement |
| `EngagementTracking_AfterInsert` | Flow | Triggered after EngagementTracking insert → applies point rules, updates loyalty tier |
| `Before_Trigger_Engagement_Tracking` | Flow | Pre-insert validation for engagement (consent check, unique key) |
| `LoyaltyMemberTierScheduled` | Scheduled Flow | Nightly: Reduces expired points, manages point expiration |
| `JBSystemFlow_CampaignMember` | Flow | Job Board system integration (standard flow) |
| `JBSystemFlow_LoyaltyMemberTier_c` | Flow | Job Board system integration for loyalty tier |

## Consent & Privacy Considerations

### Consent Fields on Account

Each consumer maintains brand-specific consent flags for three channels:

```
ConsentWestEmail__c, ConsentWestPhone__c, ConsentWestMail__c
ConsentJPSEmail__c, ConsentJPSPhone__c, ConsentJPSMail__c
ConsentGauloisesEmail__c, ConsentGauloisesPhone__c, ConsentGauloisesMail__c
ConsentParamountEmail__c, ConsentParamountPhone__c, ConsentParamountMail__c
ConsentDavidoffEmail__c, ConsentDavidoffPhone__c, ConsentDavidoffMail__c
```

**DSGVO Compliance:**
- Consent is mandatory at registration (consent_all=true in API)
- Engagement tracking only proceeds if brand-specific consent is granted
- No Schufa data re-fetched if duplicate detected (performance + privacy)
- Audit trail maintains full history of consent changes
- Opt-out requests processed within 30 days (legal requirement)

## Testing & Validation Scenarios

Comprehensive test scenarios documented in `/architecture/registration/TEST_SCENARIOS.md`:

1. **S1: Fresh Registration** — New email, success → Response Code 1
2. **S2: Duplicate Active** — Email + name match, active account → Response Code 3
3. **S3: Name Match Hijacking** — Name match without email (fraud prevention) → Response Code 3
4. **S4: Reactivation** — Reactivate inactive account → Response Code 5
5. **S5: Email Mismatch** — Email match but name mismatch (account takeover block) → Response Code 10
6. **S6: Email Verification Pending** — Resend verification email → Response Code 2
7. **S7: Password Pending** — Complete password setup → Response Code 2
8. **EC1-EC8:** Edge cases (blocked status, invalid campaign, missing fields, registration limits, Schufa negative/timeout, invalid brand/identifier)

## Deployment & CI/CD Notes

- **Skip Pattern:** `[skip ci]` in commit message bypasses Azure DevOps pipeline
- **Branch Pattern:** `feature/<story-key>` for development, `release/<version>` for releases, `master` for production
- **Org Alias:** Configured in `stack.config.md` (uat, prod, etc.)
- **Co-Author Policy:** **Never** add `Co-Authored-By` lines to commits (customer requirement)
- **AI Attribution:** **Never** reference Claude or AI in commits, PRs, or metadata (customer requirement)

## Known Limitations & Future Enhancements

| Item | Current State | Potential Enhancement |
|------|---------------|----------------------|
| Multi-brand campaigns | Not supported (1:1 Campaign-Brand binding) | Support for cross-brand campaigns with sync'd Q&A |
| Referral system | Basic referral code generation (6-char alphanumeric) | Referral rewards, tiered referral bonuses |
| Points expiration | Fixed 12-month window | Flexible expiration rules per tier/brand |
| Engagement gamification | Points only | Badges, achievements, leaderboards |
| Predictive engagement | None | ML-based churn prediction, personalization |
| Mobile app integration | API-only, no native app | Native mobile app with offline engagement tracking |
| Cross-brand loyalty | Single-brand tier system | Cross-brand loyalty pooling (future) |

## Change Log & Maintenance

| Date | Change | Author | Notes |
|------|--------|--------|-------|
| 2026-03-25 | Initial domain knowledge creation | Claude Code | Comprehensive documentation of Registration, Campaign, Engagement, Loyalty |
| — | Registration process: Added Gender=3 (Divers) option | — | Updated 16.04.2024, documented in API |
| — | Engagement Service API: Updated 21.11.2024 | — | Added combustible alternatives question tree |
| — | Campaign Info API: Updated 23.08.2024 | — | Refined redemption channel structure |

---

*This document is the authoritative source for Reemtsma business process documentation. For detailed implementation notes per feature, refer to individual epic documentation or Jira stories. For API specifications, see `/architecture/registration/webintegration/api-descriptions/`.*
