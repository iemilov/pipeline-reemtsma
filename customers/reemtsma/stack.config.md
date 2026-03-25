# Stack Configuration: Reemtsma CRM

> **Platform:** Salesforce CRM | **API Version:** 59.0 | **Build Tool:** Salesforce DX (sfdx) | **Frontend:** Lightning Web Components (LWC) + Aura | **Languages:** Apex, JavaScript, Salesforce Metadata XML

## Tech Stack Overview

| Layer | Technology | Details |
|-------|-----------|---------|
| **Frontend** | Lightning Web Components (LWC) + Aura Components | Modern web components framework + legacy Aura for backward compatibility |
| **Backend** | Salesforce Apex | Object-oriented language running in Salesforce cloud, 208+ Apex classes |
| **Database** | Salesforce CRM | Multi-tenant relational database (40+ custom objects) |
| **Integration** | REST APIs + Named Credentials | Outbound: Schufa, Marketing Cloud; Inbound: COD platform |
| **Automation** | Flows + Triggers + Batch Jobs | Record-triggered flows, Apex triggers, scheduled batch jobs |
| **Build Tool** | Salesforce CLI (sfdx) + npm | sfdx for metadata deployment, npm for JavaScript dependencies |
| **Hosting** | Salesforce Cloud | reemtsma--uat.sandbox.my.salesforce.com (UAT), production org (prod) |

## Key Libraries & Dependencies

### Apex & Salesforce Runtime

| Library/Framework | Purpose | Version |
|-------------------|---------|---------|
| Salesforce Apex | Backend logic, REST endpoints, batch jobs, trigger handlers | API v59.0 |
| Salesforce Flows | Low-code automation (Record-triggered, scheduled) | Latest |
| Salesforce Batch | Scheduled jobs (point reduction, tier updates) | Standard |

### Frontend - JavaScript/Node Ecosystem

| Library | Purpose | Version |
|---------|---------|---------|
| `@salesforce/sfdx-lwc-jest` | Unit testing for LWC components | ^3.1.0 |
| `eslint` | JavaScript linting | ^8.11.0 |
| `@salesforce/eslint-config-lwc` | LWC-specific ESLint config | ^3.2.3 |
| `@lwc/eslint-plugin-lwc` | LWC linting rules | ^1.1.2 |
| `@salesforce/eslint-plugin-aura` | Aura component linting | ^2.0.0 |
| `prettier` | Code formatting | ^3.1.0 |
| `prettier-plugin-apex` | Apex code formatting | ^2.0.1 |
| `@prettier/plugin-xml` | XML/Metadata formatting | ^3.2.2 |
| `husky` | Git hooks manager | ^8.0.3 |
| `lint-staged` | Run linters on staged files | ^15.1.0 |

## Project Structure

```
reemGit/
├── force-app/main/default/          # Main Salesforce metadata (sfdx-project.json default path)
│   ├── classes/                     # 208+ Apex classes
│   │   ├── LM_REST_*.cls           # REST endpoints (Registration, Loyalty, Engagement, Campaign)
│   │   ├── *Service.cls            # Business logic services (LoyaltyPointsService, EngagementService, etc.)
│   │   ├── *Test.cls               # Unit tests for Apex classes
│   │   └── Schufa*.cls             # Schufa integration classes
│   ├── lwc/                         # Lightning Web Components (modern UI)
│   │   ├── flowCheckbox/           # Flow checkbox input component
│   │   ├── flowAccountMap/         # Flow account mapping component
│   │   ├── flowNavigateButtons/    # Flow navigation buttons
│   │   ├── flowTextArea/           # Flow text area input
│   │   ├── caseSendAN2/            # Case sending component
│   │   ├── filesInfo/              # File information display
│   │   ├── newsletterHistoryComponent/ # Newsletter history
│   │   └── [10+ other LWC components]
│   ├── aura/                        # Aura components (legacy, deprecated but still used)
│   ├── flows/                       # 10+ automation flows
│   │   ├── CampaignMemberAfterUpsertHandler.flow    # Trigger flow on Campaign Member insert
│   │   ├── EngagementTracking_AfterInsert.flow      # Trigger flow on Engagement insert
│   │   ├── LoyaltyMemberTier*.flow                  # Loyalty tier management flows
│   │   └── [trigger flows and scheduled flows]
│   ├── objects/                     # Custom objects metadata
│   │   ├── Account/                # Standard Account (persons) with custom fields
│   │   ├── Campaign__c/            # Custom campaign object
│   │   ├── EngagementTracking__c/  # Custom engagement tracking
│   │   ├── LoyaltyMemberTier__c/   # Custom loyalty tier
│   │   └── [20+ other custom objects]
│   ├── customMetadata/              # Configuration as code (CMT)
│   │   ├── EngagementTrackingRule__mdt/     # Point awards configuration
│   │   ├── ProfileDataMapping__mdt/         # Profile field mapping
│   │   ├── Campaign_Config__mdt/            # Campaign configuration
│   │   └── [other CMT records]
│   ├── namedCredentials/            # External API authentication
│   │   ├── Schufa_API_Endpoint     # Credit check API
│   │   └── MarketingCloud_Auth     # Email service
│   ├── labels/                      # Custom labels (multi-language support)
│   ├── layouts/                     # Page layouts for objects
│   ├── quickActions/                # Quick actions (buttons, overlays)
│   ├── sites/                       # Salesforce Sites (customer portal)
│   ├── permissionsets/              # Permission set definitions
│   ├── profiles/                    # User profile definitions
│   ├── dashboards/ & reports/       # Analytics
│   ├── certs/                       # SSL certificates for Named Credentials
│   └── [staticresources, workflows, settings, etc.]
│
├── scripts/                         # Deployment and utility scripts
│   ├── apex/                        # Apex script utilities
│   ├── soql/                        # SOQL query files
│   ├── delta-deploy.sh              # Deploy only changed files (delta deployment)
│   └── rd.sh                        # Custom deployment script
│
├── manifest/                        # Deployment package definitions
│   ├── package.xml                  # Manifest for full deployment
│   └── package3.xml                 # Manifest for incremental deployment
│
├── config/                          # Salesforce DX configuration
│
├── deployment/                      # Release packages (version-organized)
│   ├── v1.0.0/                      # Past releases
│   ├── v1.1.0/
│   └── [current version]/
│
├── .forceignore                     # Files ignored in sfdx operations
├── .gitignore                       # Git ignore patterns
├── .husky/                          # Git hooks (pre-commit, commit-msg)
├── .prettierrc                      # Prettier configuration
├── .vscode/                         # VS Code settings (sfdx extension)
├── sfdx-project.json                # SFDX project configuration (api v59.0)
├── jest.config.js                   # Jest testing configuration for LWC
├── package.json                     # npm dependencies and scripts
├── azure-pipelines.yaml             # CI/CD pipeline definition
└── README.md                        # Project documentation (scaffold)
```

## Key Commands

### Development Workflow

```bash
# Authentication & Org Setup
sf auth web login --org-alias=uat                           # Authenticate to UAT org
sf auth web login --org-alias=prod                          # Authenticate to production org
sf config get target-org                                    # Show default org

# Local Development
sf project deploy start --source-dir=force-app              # Deploy all to org
sf project deploy start --source-dir=force-app --test-level=RunLocalTests  # Deploy with local tests
sf project retrieve start                                   # Retrieve metadata from org (pull)
sf source status                                            # Show status of local vs org metadata
sf source status --remote                                   # Show remote changes only

# Code Formatting & Linting
npm run prettier                                            # Format all files (Apex, XML, JS, HTML)
npm run prettier:verify                                     # Verify formatting without changes
npm run lint                                                # Run ESLint on LWC/Aura JS files

# Testing
npm run test                                                # Run all unit tests (LWC)
npm run test:unit                                           # Alias for test (sfdx-lwc-jest)
npm run test:unit:watch                                     # Watch mode for continuous testing
npm run test:unit:debug                                     # Debug mode (Node inspector)
npm run test:unit:coverage                                  # Generate coverage report

# Deployment
./scripts/delta-deploy.sh                                   # Deploy only changed files (delta)
./scripts/rd.sh                                             # Custom rollback/delta script
sf project deploy start --manifest=manifest/package.xml     # Deploy from manifest
sf project deploy start --source-dir=force-app --wait=5     # Deploy with 5-min timeout
```

### Advanced SOQL & Apex

```bash
sf data query --query "SELECT Id, Name FROM Account LIMIT 10"  # Execute SOQL query
sf apex run                                                    # Execute Apex anonymous (interactive)
sf apex run --file=scripts/apex/cleanup.apex                   # Execute Apex from file

# View logs
sf apex logs get --number=5                                    # Fetch debug logs
sf apex logs tail                                              # Stream logs in real-time
```

### Org Management

```bash
sf org create sandbox --target-org=prod --name=uat1           # Create sandbox from production
sf org list                                                    # List authenticated orgs
sf org display                                                 # Display info about current org
sf org delete --target-org=uat --no-prompt                     # Delete org
```

## Architecture

### High-Level Architecture

```
                    ┌─────────────────────────┐
                    │  External Systems       │
                    ├─────────────────────────┤
                    │  Schufa (Credit Check)  │
                    │  Marketing Cloud (Email)│
                    │  COD Website (Consumer) │
                    └───────────┬─────────────┘
                                │ HTTPS / REST
                                ▼
                    ┌─────────────────────────┐
                    │  Salesforce REST APIs   │
                    ├─────────────────────────┤
                    │ /registerConsumer       │
                    │ /engagementService      │
                    │ /campaignInfo           │
                    │ /redeemLoyaltyPoints    │
                    │ /getLoyaltyPoints       │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │  Apex Services Layer    │
                    ├─────────────────────────┤
                    │ LM_REST_CreateAccount   │
                    │ EngagementService       │
                    │ LoyaltyPointsService    │
                    │ CampaignMemberService   │
                    │ InteractionService      │
                    └───────────┬─────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
        ┌──────────────────────┐  ┌──────────────────────┐
        │  Flows & Automation  │  │  Business Logic      │
        ├──────────────────────┤  ├──────────────────────┤
        │ Record Triggers      │  │ Batch Jobs           │
        │ Scheduled Flows      │  │ (Point Reduction)    │
        │ Subflows             │  │ Custom Validation    │
        └──────────────────────┘  └──────────────────────┘
                    │                       │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │  Salesforce Database    │
                    ├─────────────────────────┤
                    │ Account (Consumers)     │
                    │ Campaign & Members      │
                    │ EngagementTracking      │
                    │ LoyaltyMemberTier       │
                    │ CustomMetadata (Config) │
                    │ [40+ other objects]     │
                    └─────────────────────────┘
```

### Data Model — Key Entities

| Object | Type | Purpose | Key Fields |
|--------|------|---------|-----------|
| **Account** | Standard | Consumer (person account) | PersonEmail, FirstName, LastName, Birthdate__pc, GlobalAccountStatus__pc, WebsiteStatus__pc |
| **Campaign__c** | Custom | Marketing campaign | AVLCode__c (unique), Brand__c, StartDate__c, EndDate__c |
| **CampaignMember** | Standard | Campaign enrollment | AccountId, CampaignId, Status |
| **EngagementTracking__c** | Custom | Interaction logs | Account__c, Brand__c, Category__c, Engagement_Type__c, PointsAwarded__c |
| **LoyaltyMemberTier__c** | Custom | Loyalty status | Account__c, Brand__c, Sequence__c, BalanceStatusPoints__c, BalanceBonusPoints__c |
| **Campaign_Product__c** | Custom | Product-campaign linking | Campaign__c, Product__c, IsCoupon__c, RedemptionPoints__c |
| **Campaign_Question__c** | Custom | Profile questions | Campaign__c, Question__c, QuestionType__c |
| **ProfilePreference__c** | Custom | Tobacco alternatives | Account__c, Brand__c, Product__c (nested structure) |
| **Interaction__c** | Custom | Generic interactions | Account__c, Type__c, Data__c (JSON) |

### Integration Points

**Inbound (External → SF):**
- COD Platform: `/registerConsumer`, `/engagementService`, `/campaignInfo`, `/redeemLoyaltyPoints`
- Brand Websites: `/engagementService` (logins, events, profile completion)
- Marketing Automation: `/getLoyaltyPoints`, `/getLoyaltyPrizes`

**Outbound (SF → External):**
- Schufa API: Credit bureau checks (via Named Credential)
- Marketing Cloud: Email verification, tier-up notifications (via Named Credential)
- Azure DevOps: CI/CD pipeline triggered on master branch commits

## Code Quality Standards

### Linting & Static Analysis

| Tool | Config | Purpose |
|------|--------|---------|
| **ESLint** | `.eslintrc.json` (via @salesforce/eslint-config-lwc) | JavaScript linting for LWC and Aura |
| **@lwc/eslint-plugin-lwc** | Built-in | LWC best practices (no direct DOM access, template reactive, etc.) |
| **Prettier** | `.prettierrc` | Code formatting (Apex, XML, JS, HTML, JSON, YAML) |
| **prettier-plugin-apex** | Integrated | Apex formatting with customizable rules |
| **@prettier/plugin-xml** | Integrated | XML/Metadata formatting |
| **sfdx-lwc-jest** | `jest.config.js` | Unit testing framework for LWC |

### Testing Standards

- **Unit Tests:** Jest for LWC components, sfdx-lwc-jest for Apex
- **Apex Tests:** Minimum 75% code coverage required for deployment (Salesforce standard)
- **LWC Tests:** All custom LWC components should have unit tests
- **Integration Tests:** Covered via Flows and manual testing in UAT

### Pre-Commit Hooks

Husky + lint-staged enforce:
1. **Prettier formatting** on all changed files (Apex, XML, JS, HTML, JSON, YAML, Markdown)
2. **ESLint validation** on all changed LWC/Aura JS files
3. **Blocks commit** if formatting fails (use `npm run prettier` to fix)

```bash
npm run precommit  # Manually run pre-commit checks
```

## Naming Conventions

### Apex Classes

| Type | Pattern | Example |
|------|---------|---------|
| REST Endpoint | `LM_REST_<Function>` | `LM_REST_CreateAccount`, `LM_REST_GetLoyaltyPoints` |
| Service Class | `<Domain>Service` | `EngagementService`, `LoyaltyPointsService`, `CampaignMemberService` |
| Helper/Utility | `<Name>Utility` or `<Name>Helper` | `InteractionService`, `SchufaHelper` |
| Batch Job | `<Process>Batch` | `LM_ReduceLoyaltyPointsBatch`, `SchufaLogCampaignUpdateBatch` |
| Scheduled Job | `<Process>Schedulable` | `LM_ReduceLoyaltyPointsSchedulable` |
| Test Class | `<ClassName>Test` | `LM_REST_CreateAccountTest`, `EngagementServiceTest` |
| Trigger | `<ObjectName>Trigger` | `AccountTrigger`, `EngagementTrackingTrigger` |

### Custom Objects & Fields

| Type | Pattern | Example |
|------|---------|---------|
| Custom Object | `<Name>__c` | `EngagementTracking__c`, `LoyaltyMemberTier__c`, `Campaign__c` |
| Person Account Field | `<FieldName>__pc` | `Birthdate__pc`, `GlobalAccountStatus__pc`, `LoginWest__pc` |
| Custom Field (Standard Object) | `<FieldName>__c` | `AVLCode__c` on Campaign |
| CMT | `<Name>__mdt` | `EngagementTrackingRule__mdt`, `ProfileDataMapping__mdt` |

### LWC Components

| Type | Pattern | Example |
|------|---------|---------|
| LWC Folder | `camelCase` | `flowCheckbox`, `newsletterHistoryComponent`, `caseSendAN2` |
| LWC JS File | `<componentName>.js` | `flowCheckbox.js` |
| LWC HTML Template | `<componentName>.html` | `flowCheckbox.html` |
| LWC CSS | `<componentName>.css` | `flowCheckbox.css` |
| LWC Meta | `<componentName>.js-meta.xml` | `flowCheckbox.js-meta.xml` |

### Flows

| Type | Pattern | Example |
|------|---------|---------|
| Trigger Flow | `<Trigger><Action>` | `CampaignMemberAfterUpsertHandler`, `EngagementTracking_AfterInsert` |
| Scheduled Flow | `<Process>_Scheduled` | `LoyaltyMemberTier_Anniversary_scheduled` |
| Subflow | `Subflow_<Name>` | `Subflow_Manage_engagement_tracking` |

## File Size & Complexity Guidelines

| Component | Max Size | Notes |
|-----------|----------|-------|
| Apex Class | 5000 LOC | Break into service classes if larger |
| LWC Component | 1000 LOC | Split into subcomponents if logic exceeds |
| Flow | 1000 elements | Use subflows for reusable logic; consider Apex if too complex |
| Metadata XML | Varies | Salesforce standard limits |

## Org Configuration

### Sandboxes

| Alias | Type | Purpose | Refresh Frequency |
|-------|------|---------|-------------------|
| `uat` | Sandbox | User Acceptance Testing | Manual |
| `dev` | Developer Sandbox | Development & integration | As needed |
| `sit` | Sandbox | System Integration Testing | Manual |

### Named Credentials

| Name | System | Auth Type | Notes |
|------|--------|-----------|-------|
| `Schufa_API_Endpoint` | Schufa | OAuth 2.0 / Basic Auth | Credit bureau checks |
| `MarketingCloud_Auth` | Marketing Cloud | OAuth 2.0 | Email verification, notifications |

### Custom Settings / CMT

- **EngagementTrackingRule__mdt:** Point awards (configurable, no hardcoding)
- **ProfileDataMapping__mdt:** Profile field mappings
- **Campaign_Config__mdt:** Campaign-specific settings

## Performance Considerations

| Optimization | Implementation |
|--------------|-----------------|
| **Batch Processing** | Scheduled batch jobs for point reduction (nightly) |
| **Caching** | Platform Cache (future enhancement) |
| **Query Optimization** | SOQL with indexed fields (Email, AVLCode__c, Brand__c) |
| **API Rate Limiting** | Salesforce org limits; client-side throttling recommended |
| **Deduplication** | Login dedup per day, content click unique keys |

## Security Best Practices

- **with sharing** keyword on all Apex classes (enforce field-level security)
- **Credential Storage:** Named Credentials for API keys (no hardcoding)
- **Input Validation:** All API endpoints validate ConsumerId, Brand, Category
- **Consent Tracking:** Audit trail on consent field changes
- **Sensitive Data:** Schufa scores logged but not exposed to frontend

## Git & Deployment Strategy

- **Branch Pattern:** `feature/<story-key>` for development, `release/<version>` for releases, `master` for production
- **Delta Deployment:** Use `scripts/delta-deploy.sh` for incremental deployments
- **Manifest Deployment:** Use `manifest/package.xml` for full deployments
- **CI/CD:** Azure DevOps pipeline (triggers on PR to master)
- **Deployment Validation:** Run tests before deploying to production

## Helpful Resources

- [Salesforce Developer Docs](https://developer.salesforce.com/)
- [LWC Documentation](https://lwc.dev/)
- [Apex Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.apex_guide.meta/apex_guide/)
- [Salesforce DX Setup](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_intro.htm)
- [Jest + LWC Testing](https://www.salesforce.com/blog/2022/02/testing-lwc-jest.html)
