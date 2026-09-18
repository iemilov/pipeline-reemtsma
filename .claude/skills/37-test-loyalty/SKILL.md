---
name: test-loyalty
description: End-to-end functional test of the loyalty programme for one brand in a sandbox — creates a dedicated test consumer, simulates every points channel the website and the CRM use (registration, double opt-in, login, content, events, profile, newsletter, campaign participation, tell-a-friend, service contact, birthday and anniversary, inactivity reduction, redemption), asserts points, tiers and records after each step, optionally repeats the run with the brand's programme switched off, and writes a test protocol with every scenario and result
argument-hint: [brand] [--env <environment>] [--email <address>] [--switch on|off|both] [--cleanup] [--only <channel,...>] [--format md|html]
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

> **Platform Guard:** requires `Platform = salesforce` in `customer.config.md`. **Sandbox only:** the skill refuses any org alias whose purpose in `stack.config.md > Org Configuration > Sandboxes` contains "Production", or whose instance URL lacks `.sandbox.` / `--`; there is no override.

## Purpose

Prove, with evidence, that every channel that grants or removes loyalty points behaves per configuration for one brand, and that the per-brand switch (`LoyaltyProgram__mdt.IsActive__c`) stops all of them without touching existing balances. The run needs no external API client: the website's calls are Apex REST endpoints, which the `sf` CLI invokes with its own session; the remaining channels are driven by DML and anonymous Apex.

The result is a protocol with one row per scenario: what was sent, what was expected, what the CRM holds afterwards, pass or fail, and the record IDs as evidence.

## Configuration

Read `pipeline/customer.config.md` (Platform, Short Name, Documentation Language), `pipeline/stack.config.md` (org aliases and purposes, API version, source path), `pipeline/customer.domain.md` (brand names, status codes), `pipeline/customers/<customer>/testdata.config.md` (consumer record template, brand and campaign references if present).

## Start dialog

Before anything else, ask with `AskUserQuestion` for every value not given as an argument:

1. **Brand** — the brands with `LoyaltyTier__mdt` records, each option showing the current switch state on the org.
1a. **Test environment** — one option per non-production sandbox from `stack.config.md > Org Configuration > Sandboxes` (e.g. UAT, Development), showing the admin alias, the integration alias of that environment and whether both are authenticated in the CLI. Production never appears. The choice sets `<admin-alias>` and `<integration-alias>` for the run.
2. **Switch** — `on`, `off`, or `both`. The skill compares the wish with the org: if they differ, it flips `LoyaltyProgram.<brand>.IsActive__c` via a temporary metadata deploy and **restores it at the end of the run in every exit path**. `both` runs two consumers, one per state.
3. **E-mail** — free text; the registration and the double opt-in mail go there. With `both`, the second consumer gets the `+off` / `+on` plus-address variant.

Inputs from `$ARGUMENTS` override the dialog: brand (first token), `--env <environment>` (matched against the sandbox purposes, e.g. `UAT` or `Development`; default the first "User Acceptance" environment), `--email`, `--switch`, `--only <channels>`, `--format md|html`.

**Two users per run.** `<admin-alias>` is the admin session of the chosen environment, used for verification queries, DML setup steps and metadata deploys. Every REST call that simulates the website (`registerConsumer`, `engagementService`, `processResponse`, `redeemPoints`, `LoyaltyPoints`, `loyaltyPrizes`) is sent with `<integration-alias>` — the `stack.config.md` sandbox row whose purpose contains "Integration user for <environment>". **Only the website's own user qualifies**: for this customer that is the Umbraco integration user (`integration@umbraco.com` with the sandbox suffix, e.g. `integration@umbraco.com.uat`), the account behind every engagement record and loyalty case the website creates in production. Other integration accounts in the org (e.g. `integration@reemtsma.de`, `webintegration@…`) are not the website and must not be used.

Before the first REST call, verify the alias: `sf org display -o <integration-alias> --json` must show that username and a connected status. If the alias is missing or not authenticated, **stop and ask** the user to authenticate it (`sf org login web --alias <integration-alias>` with the Umbraco user's credentials, or the JWT flow for an API-only user); do not fall back to the admin silently. Only when the user explicitly chooses to continue without it are the calls sent with `<admin-alias>` and every REST scenario marked `pass (admin user)`. Both users are named in the protocol's *Run* table.

**Test data is kept at the end by default** so the user can inspect the consumer in the org; the next run removes it in the pre-run cleanup. `--cleanup` deletes it already at the end of the run; the run manifest `run.json` lists every created record either way.

**Pre-run cleanup (always, no question asked):** before registering, the skill removes every previous instance of the test person from the org so the registration path starts from zero. The registration matches consumers by **identity** (name, birthday, address), not by e-mail, so the lookup must use both:

```bash
sf data query -o <alias> -r csv -q "SELECT Id, PersonContactId, PersonEmail, CreatedDate FROM Account WHERE IsPersonAccount = true AND ((FirstName = '<first_name>' AND LastName = '<last_name>' AND PersonBirthdate = <birthday>) OR PersonEmail = '<email>' OR PersonEmail LIKE '<email local part>+%@<domain>')"
```

Also delete today's `Fraud_Check__c` records for the identity (`WHERE LastName__c = '<last_name>' AND Email__c = '<email>' AND CreatedDate = TODAY`): the fraud rule blocks a fourth registration of the same person within its window with response 7. Restore the test prize's stock to its value from the previous run's manifest if the previous run redeemed it.

For every account found (main consumer and plus-address variants such as the invitee), delete in this order by the contact id, then the account: `EngagementTracking__c`, `CaseShippingProduct__c` and `Case`, `InteractionLog__c`, `Coupon__c`, `CampaignMember`, `LoyaltyMemberTier__c`, then `Account`. Verify each count is 0 afterwards and list the deleted ids in the protocol's *Test consumers* table. Records the main consumer created on **other** records (e.g. the inviter coupon on a campaign) are covered by the contact-based deletes. The default test identity is the one in the appendix (Dieter Frankenheimer); with `--email` the cleanup still runs for that identity and the given address.

Only when the org is not a sandbox is this step, like everything else, refused.

**Double opt-in is done by the user:** after the registration call the skill stops and asks the user to click the confirmation link in the mail, then verifies the opt-in fields and continues. Only if the mail cannot be received is the controller logic replicated in anonymous Apex and the scenario marked `replicated`.

All expected values are read at runtime from the org's configuration, never hard-coded: `EngagementTrackingRule__mdt` (points per channel), `LoyaltyTier__mdt` (thresholds, tier bonus, inactivity reduction), `ConsumerInteractionMapping__mdt` (campaign points), `LoyaltyProgram__mdt` (switch state).

## Workflow

### Step 0: Preconditions

```bash
sf org display -o <admin-alias> --json                # instance URL, user; abort if production
sf org display -o <integration-alias> --json          # must be the website's user (integration@umbraco.com.<sandbox>) and connected
sf data query -o <alias> -r csv -q "SELECT DeveloperName, Brand__c, IsActive__c FROM LoyaltyProgram__mdt"
sf data query -o <alias> -r csv -q "SELECT DeveloperName, Brand__c, Sequence__c, QualifyingPoints__c, BonusPointsRewarding__c, ReducePointsByInactivity__c, QRResetPeriod__c FROM LoyaltyTier__mdt WHERE Brand__c = '<brand>' ORDER BY Sequence__c"
sf data query -o <alias> -r csv -q "SELECT DeveloperName, EngagementType__c, EngagementCategory__c, LoyaltyPoints__c, EngagementPoints__c, Rule__c FROM EngagementTrackingRule__mdt"
sf data query -o <alias> -r csv -q "SELECT Id, Name, AVLCode__c, Mechanic__c FROM Campaign WHERE IsActive = true AND Parent.Client_Brand__c = '<brand>' AND Mechanic__c IN ('M11','M24','M8','M10') ORDER BY CreatedDate DESC LIMIT 5"
sf data query -o <alias> -r csv -q "SELECT Id, Name, BenefitId__c, LoyaltyPoints__c, Amount__c FROM ShippingProduct__c WHERE Active__c = true AND Type__c = 'Loyalty Prize' ORDER BY LoyaltyPoints__c ASC LIMIT 3"
sf data query -o <alias> -r csv -q "SELECT Id, Name FROM Brand__c WHERE Name = '<brand>'"
sf data query -o <alias> -r csv -q "SELECT Id, AVLCode__c, Name FROM Campaign WHERE IsActive = true AND Type = 'Adressgenerierung' AND Client_Brand__c = '<brand>' ORDER BY CreatedDate DESC LIMIT 1"
```

Record the switch state, the tier table and the rule table in the protocol header as the **expected-value source**. Abort with a clear message if the brand has no tier configuration, no registration campaign, or no active prize. Record the base URL for REST calls: `<instance>/services/apexrest`.

Create the run folder `testprotocols/<YYYY-MM-DD-HHMM>-loyalty-<brand>-<alias>/` with `requests/` (every request and response body as JSON) and `queries/` (every verification query result as CSV).

### Step 1: Create the test consumer

Use a unique e-mail `loyaltytest+<run-id>@<test-domain from testdata.config.md, else example.com>` and last name `LoyaltyTest<run-id>` so the consumer is findable and removable.

1. **Registration** via REST:
   ```bash
   sf api request rest "/services/apexrest/registerConsumer" -o <integration-alias> -X POST --body @requests/01-register.json
   ```
   Body per the register contract: identifier (from `MapBrandURL__mdt` for the brand), campaign (AVL code from Step 0), first_name, last_name, street, house_number, zip, city, birthday (today's day and month, year 1980 — makes the birthday channel testable), gender, email, mobile, consent_all true, declaration_ip.
   Assert: responseCode 1, consumerId returned, account exists with `WebsiteStatus__pc = 'E-Mail verification pending'`, no Loyalty Member Tier yet.
   **Known limitation:** on sandboxes where `SchufaSetting__mdt.BypassSchufaRequest__c` is false the identity check runs for real and rejects synthetic persons (response 9). Record the registration scenario as `fail (environment)` and create the consumer with anonymous Apex in the exact shape the registration produces (ConsumerId, HashConsumerId, SourceCampaign, verification-pending status, single opt-in, ConsentAll). Never change the Schufa setting from this skill.
2. **Double opt-in** — the confirmation is a Visualforce controller. `ApexPages.currentPage()` is null in anonymous Apex, so do **not** instantiate the controller there. Either request the Visualforce page URL with the CLI session (`sf org open --url-only` to get the instance, then `curl -H "Authorization: Bearer $(sf org display --json | jq -r .result.accessToken)" "<instance>/apex/LM_EmailConfirmation?id=<base64 consumerId>"`) or, if that is blocked, replicate the controller's grant verbatim in anonymous Apex (flags, consents, `LoyaltyPointsService.upsertLoyaltyMemberTier`, `validateBrandIsLoyalty` + Engagement Tracking) and mark the scenario `replicated`. Original text kept for reference:
   ```bash
   sf apex run -o <alias> --file requests/02-doi.apex
   ```
   with `PageReference p = Page.LM_EmailConfirmation; Test.setCurrentPage` is not available outside tests, so instead: `ApexPages.currentPage()` cannot be used; call the controller's public method after setting the parameter through `ApexPages.currentPage().getParameters().put('id', EncodingUtil.base64Encode(Blob.valueOf('<consumerId>')))` inside the anonymous block, then `new LM_EmailConfirmationController().doRedirect();`.
   Assert: `RegistrationDoubleOptIn__pc = true`, `GlobalAccountStatus__pc = 'Aktiv'`, brand consents set; **switch on:** Loyalty Member Tier created with `TotalBonusPoints__c` = rule `RegisterGiveConsent` and an Engagement Tracking "Register & give consent"; **switch off:** no Loyalty Member Tier.
3. Read the baseline: `GET /services/apexrest/LoyaltyPoints?id=<consumerId>&brand=<brand>`.

Record the consumer ID, account ID, contact ID and LMT ID in `run.json` (the cleanup manifest).

### Step 2: Helper for assertions

After every channel, run the same three reads and store them:

```bash
sf api request rest "/services/apexrest/LoyaltyPoints?id=<consumerId>&brand=<brand>" -o <integration-alias>
sf data query -o <alias> -r csv -q "SELECT TotalBonusPoints__c, RedeemedBonusPoints__c, ReducedStatuspoints__c, BalanceBonusPoints__c, BalanceStatusPoints__c, CurrentTier__c, NewTierLevel__c, PreviousTier__c, PointsReason__c FROM LoyaltyMemberTier__c WHERE Contact__c = '<contactId>' AND Brand__c = '<brand>'"
sf data query -o <alias> -r csv -q "SELECT Id, Category__c, Engagement_Type__c, LoyaltyPoints__c, EarnedEngagementPoints__c, CreatedDate FROM EngagementTracking__c WHERE Contact__c = '<contactId>' AND Brand__c = '<brand>' ORDER BY CreatedDate"
```

Expected delta = value from the rule table (switch on) or 0 with the Engagement Tracking still written where the code records the interaction regardless (switch off). A scenario passes only when the delta, the Engagement Tracking row and the endpoint response all match.

### Step 3: Channels

Run in this order; each has a key for `--only`. Every REST body is saved before sending, every response after.

| Key | Channel | Simulation | Expected delta (switch on) | Expected (switch off) |
|---|---|---|---|---|
| `login` | Website login | `POST /engagementService` `{ConsumerId, Brand, Category:"PW_Login", Data:{LoginEventTech__pc:"PWR_<timestamp>_<brand>"}}` | rule `Normal_Login`; second call same day: 0 | 0, account login flags still set |
| `login-nl` | Newsletter login | same with token `NL_<timestamp>_<brand>` | 0 (only Normal/PWR tokens count) | 0 |
| `like` | Content like | Category `ContentLike`, Data `{ArticleID__c:"T<run>", ArticleText__c:"https://…", ContentLike:true}`; repeat once | rule `ContentLike`; repeat: rejected — today as HTTP 400 `DUPLICATE_VALUE` (report as finding, dedup itself passes) | 0 |
| `text` | Text read | Category `Text`, Data `{ArticleID__c:"T<run>2", ArticleText__c:"…"}` | rule `Text` | 0 |
| `event` | Event | Category `Event`, Data `{EventId__c:"E<run>", EventUrl__c:"…"}` | rule `Event` | 0 |
| `profile` | Profile fields | Category `Profile_completion`, Data with MobileNumber, DurationOfConsumption, FrequencyOfConsumption, SideBrandId, HasInterestInCombustiveAlternatives | 10 per field (5 rules) + 100 % profile bonus as coded (50); note the rule says 0 — report the discrepancy | 0 |
| `newsletter` | Newsletter click | insert `EngagementTracking__c(Contact__c, Brand__c, Category__c='Newsletter', Engagement_Type__c='Log-in')` via `sf data create record` | rule `Newsletter` written into the record and LMT | ET stays without LoyaltyPoints |
| `campaign` | Campaign participation | `POST /processResponse` with the survey campaign's AVL code and `statusId` of "Participation"; repeat once | mapping points; repeat: 0 (once per campaign) | 0 |
| `taf` | Tell-a-friend | 1) inviter gets a CampaignMember on the brand's active **M4** retrial campaign (status Registration); 2) invitee registered with `invitedBy = <TAFReferralCode>` (or by DML with `InvitedBy__pc` when Schufa blocks it) and a CampaignMember on the **M5** regs campaign that shares the M4 campaign's **parent**, status "Registration by invitation"; 3) `CampaignMemberService.handleRegistrationByInvitation(<m5 member id>)` | inviter: referral counted, coupon issued when the campaign's reward threshold is reached, ET `TellAFriend` with LP | ET Tell-a-friend with EP only, coupon still issued |
| `consent` | Register & give consent via profile | reset `Consent_<Brand>_Email__pc = false` (note: any change stamps `<Brand>EmailLastChangeTimestamp__pc`, so the grant is only reachable for consumers who never held the consent — use a consumer registered with `consent_all:false` for a positive test), then `Profile_completion` with `Consent<Brand>Email: true` | rule `RegisterGiveConsent` once | consent set, 0 |
| `purchase` | Purchase intention | `Purchase_Intention` category | handler exists but is not routed: 200, nothing written — report as "not connected" | same |
| `contactform` | Contact form | `Contact_Form` category | no writer exists for rule `ContactForm`: 200, nothing written — report as finding | same |
| `service` | Service contact | insert a Case with ContactId, `CaseBrand__c` = brand, Type "Sonstiges" | 0 loyalty, rule `ServiceRequest` engagement points, ET created | ET created without LoyaltyPoints |
| `tierup` | Tier change | if the total is below the tier-2 threshold, grant enough via campaign or newsletter inserts to cross it | `NewTierLevel__c = '2'`, `PreviousTier__c = '1'`, tier bonus added, `StatusChangeDatetime__c` set | no change |
| `birthday` | Birthday / anniversary | set `Birthdate` to today (already), set `Login<Brand>TimestampEarliest__pc` to today minus one year and `Login<Brand>__pc = true`; then either wait for the 02:00 UTC scheduled flow or mark **manual**: the flow cannot be started on demand | rule `BirthdayMembership` (both) or `Birthday` | 0 |
| `inactivity` | Inactivity reduction | set `LatestInteraction__pc` to today minus 13 months on the contact, then run the batch logic **on the test record only**: `new LM_ReduceLoyaltyPointsBatch().execute(null, [SELECT … FROM LoyaltyMemberTier__c WHERE Contact__c = '<contactId>'])` in anonymous Apex. **Never start `Database.executeBatch` for this test** — with the brand switched on it reduces every inactive consumer of the brand in the org (5,250 records on one UAT run) | `ReducedStatuspoints__c` += min(reduce value, status balance), tier drops if below threshold | untouched |
| `redeem` | Redemption | `POST /redeemPoints` `[{consumerId, brand, benefitId:<cheapest prize>, quantity:1}]` | case of type Loyalty Program created, one CaseShippingProduct, `RedeemedBonusPoints__c` += price, prize stock −1, InteractionLog "Redeemed" | same — redemption is not gated by the switch; report it as such |
| `redeem-dup` | Double submission | send the same redeem body twice within one second (`&` in shell) | **today: two cases** — report as known defect, not as pass | same |
| `read` | Read endpoints | `GET /LoyaltyPoints`, `GET /loyaltyPrizes` | values consistent with the LMT | tier from Sequence 1, zeros when no LMT |

Every step also checks that nothing was written for the **other** brand of the consumer.

### Step 4: Switch handling and second run (`--switch both`)

1. Retrieve `LoyaltyProgram.<brand>` custom metadata into a scratch folder, flip `IsActive__c`, set `DeactivatedSince__c` to today and `DeactivationReason__c` to "test-loyalty run <run-id>", deploy to the sandbox, verify by query.
2. Create a **second** test consumer and repeat Step 1 and Step 3 with the "switch off" expectations.
3. Restore the original metadata record from the retrieved copy, deploy, verify. Restoration happens **always**, also after a failure (record the restore result in the protocol; if it fails, print the exact deploy command for the user).

If the org already has the switch off at Step 0, run the off scenarios first with the existing state, then flip on for the second consumer, then restore.

### Step 5: Cleanup

Only with `--cleanup`: delete, in order, Engagement Tracking, Case Shipping Products and Cases, Interaction Logs, Campaign Members, Coupons, Loyalty Member Tiers, then the test accounts (both consumers), all by the IDs in `run.json`; restore the prize stock by +1 per redeemed unit. Verify by re-querying each ID. The manifest stays in the run folder with a `cleaned` flag.

### Step 6: Protocol

Write `testprotocols/<run-folder>/protocol.<md|html>` in the Documentation Language. **Everything is a table** so results can be scanned and compared between runs:

1. **Run** — brand, switch state under test, org, date/time, data kept or cleaned, evidence folders.
2. **Test consumers** — role, name, e-mail, ConsumerId, Account, Contact, created via, state (kept/deleted); include any pre-existing account that was matched and what happened to it.
3. **Expected values** — one row per configuration source with the values used, plus the rule that applies to the tested switch state.
4. **Result summary** — total / pass / fail / manual / with finding, and a one-sentence verdict.
5. **What was tested** — one row per scenario: #, channel, how simulated, expected, observed, status (✅ pass · ❌ fail · ⚠️ manual · "pass (finding)"), evidence file.
6. **State of the consumer after the run** — Loyalty Member Tier, engagement records, campaign members, logs, cases, account flags, points endpoint.
7. **Findings** — ID, severity (High/Medium/Low), channel, finding, impact, evidence, suggested action. Design notes that are not defects go below the table.
8. **Not verifiable in this run** — channel, reason, how to verify.
9. **Cleanup** — records deleted, switch modified, stock changed, each yes/no.

`html` renders the same tables in the `documentation/` page style.

### Step 7: Log and summary

Create `<YYYY-MM-DD>-<customer-short-name>-<brand>-test-loyalty.json` in `.claude/skills/37-test-loyalty/logs/` per the CLAUDE.md schema; `summary` starts with `[brand=<b>] [org=<alias>] [pass=<n>] [fail=<n>] [manual=<n>] [switch-restored=yes|no|n/a]`.

Present: the result summary, failed scenarios with expected versus actual, known defects, the protocol path, and whether the switch was restored.

## Important Rules

- **Sandbox only, no override.** Production is refused at Step 0.
- **Expected values from configuration**, read at run time, never typed into the skill.
- **Every assertion has evidence on disk** — request, response, query result. A scenario without evidence is `manual`, never `pass`.
- **Restore the switch** in every exit path of Step 4.
- **Clean up only on request and by ID**, never by name pattern, and never touch records not in `run.json`. Kept test consumers are listed in the protocol with their IDs.
- Do not hide code-versus-configuration discrepancies; they are findings in the protocol.
- No AI attribution in the protocol.

## Error Handling

- Registration fails (fraud check, Schufa unavailable in sandbox): report the response code; if Schufa returns 99, retry once, then mark the run `failed` — nothing else can run without a consumer.
- REST call returns 400 or the endpoint is missing: save the response, mark the scenario `fail`, continue with the next channel.
- Batch job does not finish within 5 minutes: mark `inactivity` as `manual` with the job ID.
- Metadata deploy for the switch fails: skip the switch-off run, say so, and do not attempt a restore that was never needed.
- Cleanup fails for a record: list the remaining IDs in the protocol and the manifest; never leave the switch flipped because cleanup failed.

## Appendix: reference request bodies (verified on reemUAT, 2026-09-18)

Use these shapes verbatim, replacing the placeholders. Values marked *per brand* are resolved in Step 0: `<identifier>` from `MapBrandURL__mdt` (`DeveloperName` whose `Brand__c` matches the brand), `<mainBrand>` from `BrandVariant__c.BrandVariantID__c` of a variant of the brand, `<regCampaign>` from an active campaign of type `Adressgenerierung` whose parent's `Client_Brand__c` is the brand, `<surveyCampaign>` from an active M11/M24 campaign of the brand, `<benefitId>` from the cheapest active loyalty prize.

**Registration** — `POST /services/apexrest/registerConsumer` (a real identity is needed for the Schufa check on orgs without bypass; the sample person below passed on UAT)

```json
{"identifier":"<identifier>","campaign":"<regCampaign>","mainBrand":"<mainBrand>",
 "gender":1,"first_name":"Dieter","last_name":"Frankenheimer",
 "street":"SCHWACHHAUSER HEERSTR.","house_number":"2","address_additional":"More info...",
 "zip":"28203","city":"BREMEN","birthday":"2000-12-27",
 "email":"<email>","mobile":"+49555555","declaration_ip":"192.168.0.1",
 "consent_all":true,"env":"test"}
```

Response codes: 1 created, 5 reactivated an existing account matched by **identity** (name, birthday, address, not e-mail) — check for such an account before registering (`SELECT Id FROM Account WHERE LastName = … AND PersonBirthdate = …`), 9 Schufa negative, 10 validation. Registration of an invitee adds `"invitedBy":"<TAFReferralCode of the inviter>"`.

**Engagement service** — `POST /services/apexrest/engagementService` with `-o <integration-alias>`, always `{"ConsumerId":"<consumerId>","Brand":"<brand>","Category":…,"Data":{…}}`

| Channel | Category | Data |
|---|---|---|
| login (counts) | `PW_Login` | `{"LoginEventTech__pc":"PWR_<yyyymmddhhmmss>_<brand>"}` |
| login (newsletter, no points) | `NL_Login` | `{"LoginEventTech__pc":"NL_<yyyymmddhhmmss>_<brand>"}` |
| like | `ContentLike` | `{"ArticleID__c":"<≤8 chars>","ArticleText__c":"https://<brand-site>/magazine/…","ContentLike":true}` |
| text | `Text` | `{"ArticleID__c":"<≤8 chars>","ArticleText__c":"https://…"}` — the combination key is 20 characters, longer ids fail with STRING_TOO_LONG |
| event | `Event` | `{"EventId__c":"<id>","EventUrl__c":"https://…"}` |
| profile | `Profile_completion` | `{"MobileNumber":"+49555555","DurationOfConsumption":2,"FrequencyOfConsumption":1,"SideBrandId":"<BrandVariantID of another variant>","HasInterestInCombustiveAlternatives":true,"InterestInCombustiveAlternatives":[{"question":"E-Zigaretten","brand":["blu"]}]}` — the array is mandatory, its absence raises a null pointer |

Repeats: login once per day, like/text/event once per item (repeat returns HTTP 400 `DUPLICATE_VALUE`), profile fields once each; a field already filled at registration (mobile) earns nothing.

**Campaign participation** — `POST /services/apexrest/processResponse`

```json
{"consumerId":"<consumerId>","campaignId":"<surveyCampaign AVL code>","statusId":"10"}
```

`statusId` 10 = Participation for M11/M24 (see `ConsumerInteractionMapping__mdt.StatusId__c`). Repeat returns code 110.

**Newsletter click** — DML, no endpoint: `sf data create record -s EngagementTracking__c -v "Contact__c=<contactId> Brand__c=<brand> Category__c=Newsletter Engagement_Type__c=Log-in"`.

**Service contact** — DML: create the Case **without** contact (`CaseBrand__c=<Brand__c Id> Subject=… Origin=Web`), then update it with `ContactId=<contactId>`; the flow reacts to the contact change, not to creation.

**Tell-a-friend** — verified sequence (anonymous Apex):

```apex
insert new CampaignMember(CampaignId = '<M4 retrial campaign>', ContactId = <inviterContact>, Status = 'Registration');
CampaignMember cm = new CampaignMember(CampaignId = '<M5 regs campaign, same ParentId as the M4>', ContactId = <inviteeContact>, Status = 'Registration by invitation');
insert cm;   // invitee account must carry InvitedBy__pc = inviterContact
CampaignMemberService.handleRegistrationByInvitation(cm.Id);
```

Find the pair with `SELECT Id, Mechanic__c, ParentId FROM Campaign WHERE Mechanic__c IN ('M4','M5') AND Parent.Client_Brand__c = '<brand>' AND IsActive = true`; M4 and M5 must share `ParentId`. An M5 under a different parent, or a registration campaign of another mechanic, counts nothing.

**Consent via profile** — `{"Category":"Profile_completion","Data":{"Consent<Brand>Email":true}}`; key names per `ProfileDataMapping__mdt` (`ConsentJPSEmail`, `ConsentGauloisesEmail`, …).

**Not connected** — `Purchase_Intention` and any contact-form category return 200 and write nothing.

**Anniversary preparation** — `sf data update record -s Contact -i <contactId> -v "Login<Brand>TimestampEarliest__c=<today minus one year>T09:00:00.000Z"`; the birthday is the registration birthday. The scheduled flow runs at 02:00 UTC; verify the next day.

**Inactivity** — prepare by setting `LatestInteraction__pc` to 13 months ago on a consumer **with** a Loyalty Member Tier, then anonymous Apex:

```apex
LoyaltyMemberTier__c lmt = [SELECT Id, Brand__c, BalanceStatusPoints__c, ReducedStatuspoints__c, ReduceByInactivity__c FROM LoyaltyMemberTier__c WHERE Contact__c = '<contactId>'];
new LM_ReduceLoyaltyPointsBatch().execute(null, new List<LoyaltyMemberTier__c>{lmt});
```

Do not use `Database.executeBatch` here: it processes the whole org.

**Redemption** — `POST /services/apexrest/redeemPoints`

```json
[{"consumerId":"<consumerId>","brand":"<brand>","benefitId":"<benefitId>","quantity":1}]
```

Codes: 105 not enough points, 106 no Loyalty Member Tier (switch off or never earned), 107 stock. Double submission: send the same body twice concurrently and count the cases.

**Reads** — `GET /services/apexrest/LoyaltyPoints?id=<consumerId>&brand=<brand>`, `GET /services/apexrest/loyaltyPrizes`.
