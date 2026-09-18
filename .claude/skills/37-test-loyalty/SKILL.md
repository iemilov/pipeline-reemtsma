---
name: test-loyalty
description: End-to-end functional test of the loyalty programme for one brand in a sandbox — creates a dedicated test consumer, simulates every points channel the website and the CRM use (registration, double opt-in, login, content, events, profile, newsletter, campaign participation, tell-a-friend, service contact, birthday and anniversary, inactivity reduction, redemption), asserts points, tiers and records after each step, optionally repeats the run with the brand's programme switched off, and writes a test protocol with every scenario and result
argument-hint: [brand] [org-alias] [--email <address>] [--switch on|off|both] [--cleanup] [--only <channel,...>] [--format md|html]
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
2. **Switch** — `on`, `off`, or `both`. The skill compares the wish with the org: if they differ, it flips `LoyaltyProgram.<brand>.IsActive__c` via a temporary metadata deploy and **restores it at the end of the run in every exit path**. `both` runs two consumers, one per state.
3. **E-mail** — free text; the registration and the double opt-in mail go there. With `both`, the second consumer gets the `+off` / `+on` plus-address variant.

Inputs from `$ARGUMENTS` override the dialog: brand (first token), org alias (second token, default the first "User Acceptance" alias), `--email`, `--switch`, `--only <channels>`, `--format md|html`.

**Test data is kept by default** so the user can inspect the consumer in the org. `--cleanup` deletes it by ID at the end; the run manifest `run.json` lists every created record either way.

**Existing consumer with that e-mail:** the skill looks the address up on the org before registering. If a person account exists, it asks whether to delete it (with its loyalty, engagement, case and campaign records) so the registration path is exercised cleanly, or to reuse it and skip registration and double opt-in.

**Double opt-in is done by the user:** after the registration call the skill stops and asks the user to click the confirmation link in the mail, then verifies the opt-in fields and continues. Only if the mail cannot be received is the controller logic replicated in anonymous Apex and the scenario marked `replicated`.

All expected values are read at runtime from the org's configuration, never hard-coded: `EngagementTrackingRule__mdt` (points per channel), `LoyaltyTier__mdt` (thresholds, tier bonus, inactivity reduction), `ConsumerInteractionMapping__mdt` (campaign points), `LoyaltyProgram__mdt` (switch state).

## Workflow

### Step 0: Preconditions

```bash
sf org display -o <alias> --json                      # instance URL, user; abort if production
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
   sf api request rest "/services/apexrest/registerConsumer" -o <alias> -X POST --body @requests/01-register.json
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
sf api request rest "/services/apexrest/LoyaltyPoints?id=<consumerId>&brand=<brand>" -o <alias>
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
| `taf` | Tell-a-friend | register a second consumer with `invitedBy = <TAFReferralCode of the test consumer>` and confirm its DOI | rule `TellAFriend` on the inviter | 0 |
| `service` | Service contact | insert a Case with ContactId, `CaseBrand__c` = brand, Type "Sonstiges" | 0 loyalty, rule `ServiceRequest` engagement points, ET created | ET created without LoyaltyPoints |
| `tierup` | Tier change | if the total is below the tier-2 threshold, grant enough via campaign or newsletter inserts to cross it | `NewTierLevel__c = '2'`, `PreviousTier__c = '1'`, tier bonus added, `StatusChangeDatetime__c` set | no change |
| `birthday` | Birthday / anniversary | set `Birthdate` to today (already), set `Login<Brand>TimestampEarliest__pc` to today minus one year and `Login<Brand>__pc = true`; then either wait for the 02:00 UTC scheduled flow or mark **manual**: the flow cannot be started on demand | rule `BirthdayMembership` (both) or `Birthday` | 0 |
| `inactivity` | Inactivity reduction | set `LatestInteraction__pc` to today minus 13 months on the contact, then `sf apex run` with `Database.executeBatch(new LM_ReduceLoyaltyPointsBatch(), 50);` and wait for the job (`AsyncApexJob` polling) | `ReducedStatuspoints__c` += min(reduce value, status balance), tier drops if below threshold | untouched |
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

Write `testprotocols/<run-folder>/protocol.<md|html>` in the Documentation Language:

1. **Header** — brand, org, date, switch state(s) tested, test consumers (IDs), expected-value sources (tier table, rule table, mapping rows used, prize used).
2. **Result summary** — scenarios run, passed, failed, manual, known defects.
3. **Scenario table** — one row per channel and run mode: key, what was sent (link to the request file), expected, actual (points delta, tier, ET row, response code), status `pass | fail | manual | known-defect`, evidence (record IDs, query file).
4. **Timeline** — every step with timestamp and the Loyalty Member Tier values after it.
5. **Deviations** — configuration versus code (e.g. the 100 % profile bonus of 50 versus rule 0), defects found (double redemption), anything unverifiable (scheduled flow).
6. **Cleanup** — what was deleted, what remains, switch restored yes/no.

`html` format uses the `documentation/` page style; `md` is a plain table document.

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
