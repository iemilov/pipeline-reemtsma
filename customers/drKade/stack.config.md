# Stack Configuration: Salesforce DX

## Salesforce Project

| Key | Value |
|-----|-------|
| Project Name | `pta` |
| API Version | `65.0` |
| Manifest API Version | `62.0` |
| Namespace | — (no managed package namespace) |
| Login URL | `https://login.salesforce.com` |
| PMD Rules File | `apex-rules.xml` |
| Source Path | `force-app/main/default/` |
| Project Config | `sfdx-project.json` |
| Scratch Org Config | `config/project-scratch-def.json` |

## Naming Conventions

| Type | Prefix | Examples |
|------|--------|----------|
| Apex Classes (core) | `DRKA_` | `DRKA_AccountBuilder`, `DRKA_CTOrderTriggerHandler` |
| Apex Classes (portal) | `PTA_` | `PTA_FAQListController`, `PTA_TrainingsCardController` |
| Flows | `DRKA_` / `PTA_` | `DRKA_CTOrder_Approval_Return`, `PTA_QuizUzer_After_Create` |
| LWC (camelCase) | `pTA_` | `pTA_BrandCard`, `pTA_QuizWrapper` |
| Aura | — | `PDFButton`, `ProductInfoHost` |
| Test Classes | `*Test` suffix | `ContactTriggerHandlerTest`, `DRKA_AccountBuilderTest` |
| Test Data Factory | `DRKA_TestFactory` | Single factory class for all test data |
| Apex Class Name Max Length | 40 characters | Salesforce platform limit |

## Org Aliases

| Alias | Purpose |
|-------|---------|
| `KadeUAT` | UAT testing sandbox (default development org) |
| `KadePROD` | Production (validation target) |

## Dependencies

### Dev Dependencies (package.json)

| Package | Version | Purpose |
|---------|---------|---------|
| `eslint` | `^9.29.0` | JavaScript linting |
| `@salesforce/eslint-config-lwc` | `^4.0.0` | LWC ESLint rules |
| `@salesforce/eslint-plugin-aura` | `^3.0.0` | Aura ESLint rules |
| `@salesforce/eslint-plugin-lightning` | `^2.0.0` | Lightning ESLint rules |
| `@lwc/eslint-plugin-lwc` | `^3.1.0` | LWC-specific ESLint rules |
| `eslint-plugin-import` | `^2.31.0` | Import linting |
| `eslint-plugin-jest` | `^28.14.0` | Jest test linting |
| `prettier` | `^3.5.3` | Code formatting |
| `prettier-plugin-apex` | `^2.2.6` | Apex code formatting |
| `@prettier/plugin-xml` | `^3.4.1` | XML formatting |
| `@salesforce/sfdx-lwc-jest` | `^7.0.2` | LWC Jest testing |
| `husky` | `^9.1.7` | Git hooks |
| `lint-staged` | `^16.1.2` | Pre-commit staged file processing |

## Key Commands

### Linting & Formatting
```bash
npm run lint                  # ESLint on Aura & LWC files
npm run prettier              # Format all supported files
npm run prettier:verify       # Check formatting without changes
```

### Testing (LWC Jest)
```bash
npm test                      # Run all Jest tests
npm run test:unit:watch       # Watch mode
npm run test:unit:coverage    # With coverage report
npm run test:unit:debug       # Debug with inspector
```

### Apex Deployment & Testing
```bash
sf project deploy start --source-dir force-app/main/default/classes/MyClass.cls force-app/main/default/classes/MyClass.cls-meta.xml -o <org>
sf apex run test --class-names MyTestClass --result-format human --synchronous --wait 10 -o <org>
```

### Delta Deployment Scripts
```bash
./scripts/delta-deploy.sh <output_dir> <username>   # Generate delta package from git (API v63.0)
./scripts/rd.sh -r <metadata>                       # Retrieve metadata from org
./scripts/rd.sh -d <metadata>                       # Deploy metadata to org
```

### Versioned Deployment
```bash
sf project deploy start -x deployment/<version>/package/package.xml -o <org>
```

## Architecture

### Source Structure
- `force-app/main/default/` — All Salesforce metadata organized by type
  - `classes/` — ~130 Apex classes (~64 test classes, ~66 production)
  - `lwc/` — ~45 Lightning Web Components
  - `aura/` — 2 Aura components (`PDFButton`, `ProductInfoHost`)
  - `flows/` — 10+ Flows (`DRKA_*`, `PTA_*`)
  - `objects/`, `triggers/`, `pages/` — Standard metadata
  - `staticresources/` — 15 static resources (`PTA_*`, `CKEditor*`)
  - `sites/` — `PTA_Portal` Experience Cloud site
  - `experiences/` — `PTA_Portal1` Experience Bundle
- `deployment/<version>/` — Versioned release packages with `package.xml` and `destructiveChanges.xml`
- `scripts/` — Delta deploy and retrieve/deploy helper scripts
- `manifest/package.xml` — Full org manifest (API v62.0)

### Managed Packages
| Package | Namespace | Purpose |
|---------|-----------|---------|
| CT Sales Order | `orders` | Order management (`orders__Order__c`, `orders__OrderLineItem__c`) |
| CT Pharma | `CTPHARMA` | Pharma activity tracking (`CTPHARMA__Activity__c`) |

## CI/CD Pipeline (Azure Pipelines)

**File:** `azure-pipelines.yaml`

Pipeline uses `sfdx-git-delta` plugin for intelligent delta deployments. JWT authentication with service accounts stored in Azure Key Vault. Variable group: `SalesforceVariables`.

### Pipeline Stages

| Branch Pattern | Stage | Target | Action |
|----------------|-------|--------|--------|
| `feature/*` | UAT | UAT sandbox | Delta deploy |
| `feature/*` | Generate_US_Package | — | Commits deployment files back to branch |
| `master` | PROD | Production | Validation only (manual deploy parameter) |

### Pipeline Tools
- Node.js 21.x
- Salesforce CLI (`sf`)
- `sfdx-git-delta` plugin (delta package generation)
- JWT authentication with OpenSSL certificate

## Code Quality

### Pre-commit Hooks (Husky + lint-staged)

On every commit, the following runs automatically on staged files:

| File Pattern | Action |
|--------------|--------|
| `*.{cls,cmp,component,css,html,js,json,md,page,trigger,xml,yaml,yml}` | `prettier --write` |
| `**/{aura,lwc}/**/*.js` | `eslint` |
| `**/lwc/**` | `sfdx-lwc-jest --bail --findRelatedTests --passWithNoTests` |

### ESLint Configuration

**File:** `eslint.config.js`
- Aura: `@salesforce/eslint-plugin-aura` (recommended + locker)
- LWC: `@salesforce/eslint-config-lwc` (recommended)
- Tests: LWC config with `@lwc/lwc/no-unexpected-wire-adapter-usages` disabled

### Prettier Configuration

**File:** `.prettierrc`
- Plugins: `prettier-plugin-apex`, `@prettier/plugin-xml`
- Overrides: LWC HTML → `lwc` parser; Aura `.cmp`/`.page`/`.component` → `html` parser
- Ignored: `**/staticresources/**`, `.sfdx`, `.sf`, `coverage/`

### Jest Configuration

**File:** `jest.config.js`
- Base: `@salesforce/sfdx-lwc-jest/config`
- Ignores: `.localdevserver`

## Conventions

- Test classes: `*Test.cls` with `test*()` or `testShould*()` methods
- Apex class names must not exceed 40 characters (Salesforce limit)
- LWC components import Apex via `@salesforce/apex/ClassName.methodName`
- Components use `@api` decorators for public properties
- When test classes are executed, always return the code coverage from the test run in a table
- Formatted file types: `cls`, `cmp`, `component`, `css`, `html`, `js`, `json`, `md`, `page`, `trigger`, `xml`, `yaml`, `yml`

## Ignored Files

### .forceignore
- `package.xml`, `**/jsconfig.json`, `**/.eslintrc.json`, `**/__tests__/**`

### .gitignore
- `.sf/`, `.sfdx/`, `node_modules/`, `.env`, `coverage/`, `.pmdCache`
