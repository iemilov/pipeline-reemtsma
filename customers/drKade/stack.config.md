# Stack Configuration: Salesforce DX

## Salesforce Project

| Key | Value |
|-----|-------|
| API Version | `65.0` |
| PMD Rules File | `apex-rules.xml` |
| Source Path | `force-app/main/default/` |
| Project Config | `sfdx-project.json` |

## Naming Conventions

| Key | Value |
|-----|-------|
| Apex/Flow Prefix | `<PREFIX_>` |
| LWC Prefix | `<prefix_>` |
| Aura Prefix | `<prefix_>` |
| Test Data Factory | `<PREFIX_TestDataFactory>` |
| Apex Class Name Max Length | 40 characters |

## Org Aliases

| Alias | Username | Purpose |
|-------|----------|---------|
| `drKadeDEV` | `<username>` | DEV sandbox (default development org) |
| `drKadeUAT` | `<username>` | UAT testing sandbox |
| `drKadePROD` | — | Production (validation target) |

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
./scripts/delta-deploy.sh <output_dir> <username>   # Generate delta package from git
```

### Versioned Deployment
```bash
sf project deploy start -x deployment/<version>/package/package.xml -o <org>
```

## Architecture

### Source Structure
- `force-app/main/default/` - All Salesforce metadata organized by type
  - `classes/` - Apex classes and tests (`*Test.cls` naming)
  - `lwc/` - Lightning Web Components
  - `aura/` - Aura components
  - `flows/`, `objects/`, `triggers/`, `pages/` - Standard metadata
- `deployment/<version>/` - Versioned release packages with `package.xml` and `destructiveChanges.xml`

## CI/CD Pipeline (Azure Pipelines)

Pipeline uses `sfdx-git-delta` plugin for intelligent delta deployments. JWT authentication with service accounts stored in Azure Key Vault.

## Code Quality

### Other Quality Tools
- **ESLint** - Salesforce-specific rules via `@salesforce/eslint-config-lwc`
- **Husky** - Pre-commit hooks run lint-staged on changed files

## Conventions

- Test classes: `*Test.cls` with `test*()` or `testShould*()` methods
- Apex class names must not exceed 40 characters (Salesforce limit)
- LWC components import Apex via `@salesforce/apex/ClassName.methodName`
- Components use `@api` decorators for public properties
- When test classes are executed, always return the code coverage from the test run in a table
