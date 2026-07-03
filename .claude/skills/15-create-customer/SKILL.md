---
name: create-customer
description: Interactively scaffold a new customer config repo with all required configuration files, create the GitHub repo, and clone it into the pipeline customers directory
argument-hint: "[customer-name]"
---

## Workflow: Create New Customer Configuration

Interactively create a new customer configuration repository with all required config files and prepare it for use with Claude skills.

**Usage:** `/create-customer [customer-name]`

The `$ARGUMENTS` string is the customer folder name (lowercase, kebab-case). If empty, ask the user.

### Step 0: Parse Arguments & Validate

1. If `$ARGUMENTS` is empty, ask the user for the customer name using `AskUserQuestion`
2. Normalize the name to lowercase kebab-case (e.g., `Acme Corp` → `acme-corp`)
3. **Validate the name doesn't already exist** — check if `pipeline/customers/<name>/` already exists:
   ```bash
   ls pipeline/customers/<name>/ 2>/dev/null
   ```
   - If it exists and has config files, inform the user and abort: "Customer `<name>` already exists."
   - If the directory exists but is empty, warn and ask whether to proceed

4. **Validate the GitHub repo doesn't already exist:**
   ```bash
   gh repo view Lintlinger/pipeline-<name> --json name 2>/dev/null
   ```
   - If it exists, ask the user whether to reuse it or abort

### Step 1: Gather Customer Information (Interactive)

Collect all required configuration values interactively. Present each group as an `AskUserQuestion` with sensible defaults where possible.

#### 1a. Customer Identity

Ask using `AskUserQuestion`:
- **Full Name** — e.g., "Acme Corporation GmbH"
- **Short Name** — e.g., "Acme" (used in log file names, must be concise)

#### 1b. Platform

Ask using `AskUserQuestion`:
- "Which platform does this customer use?"
  - Option 1: `salesforce`
  - Option 2: `node-cloudflare`
  - Option 3: Other (user specifies)

#### 1c. Atlassian Configuration

Ask using `AskUserQuestion` — all values as free text:
- **Jira URL** — e.g., `https://acme.atlassian.net`
- **Confluence URL** — typically same instance + `/wiki`
- **Cloud ID** — UUID from Atlassian admin
- **Project Key** — e.g., `ACME`
- **Components** — comma-separated list

If the user doesn't have Atlassian values yet, allow skipping with placeholder values (`<not configured>`).

#### 1d. Locale & Language

Ask using `AskUserQuestion`:
- "Which language should be used for documentation and stories?"
  - Option 1: `German (de)` — sets all locale fields to German
  - Option 2: `English (en)` — sets all locale fields to English
  - Option 3: Custom — user specifies per field

Default locale mapping:
- **German**: Story Language = `German`, Documentation Language = `German`, Release Notes Language = `German`, Validation Rule Messages = `German`, Date Format = `DD.MM.YYYY`
- **English**: Story Language = `English`, Documentation Language = `English`, Release Notes Language = `English`, Validation Rule Messages = `English`, Date Format = `YYYY-MM-DD`

#### 1e. Repository & CI/CD

Ask using `AskUserQuestion`:
- **Main project repo name** — e.g., `AcmeProject` (the GitHub repo name under `Lintlinger/`)
- **Submodule branch** — default: `main`
- **CI Skip Pattern** — default: `[skip ci]`
- **Azure DevOps** — "Does this customer use Azure DevOps for CI/CD?"
  - If yes: collect Organization URL, Project, Repository
  - If no: skip

#### 1f. Pipeline Environments

Ask using `AskUserQuestion` (free text table):
- Feature branch target environment — default: `INT`
- Release branch target environment — default: `UAT`
- Master/main target environment — default: `PROD`

### Step 2: Create GitHub Repository

1. **Create the repo** under the `Lintlinger` org:
   ```bash
   gh repo create Lintlinger/pipeline-<name> --private --description "Pipeline customer config: <full-name>"
   ```
   - Must be **private** — customer configs contain sensitive workflow data

2. If creation fails, report the error and abort

### Step 3: Scaffold Configuration Files

Read the template files from `pipeline/customers/_template/` and replace all placeholders with the collected values.

#### 3a. Generate `config.md`

Read `pipeline/customers/_template/config.md` and replace:
- `<Customer Name>` → Full Name
- `<instance>` → extracted from Jira URL (e.g., `acme` from `https://acme.atlassian.net`)
- `<uuid>` → Cloud ID
- `<PROJECT>` → Project Key
- `<Component1>, <Component2>` → Components
- `<Customer Full Name>` → Full Name
- `<Customer Short Name>` → Short Name
- `<title>` → `<Short Name> Architecture Overview`
- Platform value
- All locale values
- All CI/CD values
- Azure DevOps section (fill or remove based on user input)
- Pipeline environment values

#### 3b. Generate `stack.config.md`

Read `pipeline/customers/_template/stack.config.md` and replace:
- `<Stack Name>` → Platform-appropriate name (e.g., "Salesforce DX" or "Node.js / Cloudflare Workers")
- Leave tech stack details as placeholders — these will be filled in as the project evolves
- If the platform is known, pre-fill obvious values:
  - **salesforce**: Frontend = `Lightning Web Components`, Backend = `Apex / Salesforce Platform`, Database = `Salesforce Objects`, Build Tool = `sf CLI`, Hosting = `Salesforce`
  - **node-cloudflare**: Frontend = `<framework>`, Backend = `Cloudflare Workers`, Database = `D1 / KV`, Build Tool = `wrangler`, Hosting = `Cloudflare`

#### 3c. Generate `domain-knowledge.md`

Read `pipeline/customers/_template/domain-knowledge.md` and replace:
- `<Customer Name>` → Full Name
- Leave the rest as template placeholders — domain knowledge is built over time

#### 3d. Generate `testdata.config.md`

- **If platform is `salesforce`**: Copy the template as-is (will be filled during test data setup)
- **If platform is NOT `salesforce`**: Skip this file (test data skill is Salesforce-only)

### Step 4: Initialize Local Repository & Push

1. **Clone the empty repo** into a temp directory:
   ```bash
   cd /tmp && git clone https://github.com/Lintlinger/pipeline-<name>.git
   ```

2. **Copy generated files** into the cloned repo:
   ```bash
   cp config.md stack.config.md domain-knowledge.md [testdata.config.md] /tmp/pipeline-<name>/
   ```

3. **Commit and push**:
   ```bash
   cd /tmp/pipeline-<name>
   git add .
   git commit -m "Initial customer configuration: <full-name>"
   git push origin main
   ```

4. **Clean up** the temp clone:
   ```bash
   rm -rf /tmp/pipeline-<name>
   ```

### Step 5: Clone into Pipeline Customers Directory

Clone the new customer config repo into the pipeline's customers directory:

```bash
cd <pipeline-dir>
git clone https://github.com/Lintlinger/pipeline-<name>.git customers/<name>
```

The `customers/` directory is gitignored (except `_template/`), so this clone is local-only and does not affect the pipeline repo's git state. No commit needed.

### Step 6: Summary & Next Steps

Present a summary:

```
NEW CUSTOMER CONFIGURATION
──────────────────────────────────────────────────
Customer:     <Full Name> (<Short Name>)
Platform:     <platform>
Repo:         Lintlinger/pipeline-<name> (private)
Local clone:  pipeline/customers/<name>/
Config files: config.md, stack.config.md, domain-knowledge.md[, testdata.config.md]

NEXT STEPS
──────────────────────────────────────────────────
1. Switch to this customer:
   cd pipeline && ./setup.sh <name>

2. Review and refine config files:
   - pipeline/customers/<name>/config.md — fill in any <not configured> values
   - pipeline/customers/<name>/stack.config.md — add project-specific tech stack details
   - pipeline/customers/<name>/domain-knowledge.md — add glossary and business processes

3. Onboard collaborators:
   /onboard-pipeline-user <github-username> <project-repo>
```

## Important Rules

- Follow all conventions from CLAUDE.md
- The GitHub org is `Lintlinger` — all repos live under this account
- Customer config repos follow the naming pattern `pipeline-<customer-folder-name>`
- Customer folder names are **lowercase kebab-case**
- Config repos must be **private** — they contain internal workflow configuration
- **Never hardcode values** — read templates from `_template/` and replace placeholders
- **Customer configs are gitignored** — cloning a customer repo into `customers/<name>/` does not require a pipeline commit. No pointer management needed.
- **Platform-specific files**: Only create `testdata.config.md` for Salesforce customers
- **Incomplete config is OK** — the user can fill in remaining placeholders later. Use `<not configured>` for values the user doesn't have yet
- ALWAYS create a log file named `<YYYY-MM-DD>-<customer-short-name>-<name>-create-customer.json` in `.claude/skills/15-create-customer/logs/` — use the structured JSON format from CLAUDE.md

## Error Handling

- **Customer already exists**: Inform the user and abort — do not overwrite existing config
- **GitHub repo creation fails**: Report the error (likely insufficient permissions) and abort
- **Clone fails**: Report the error. If the repo was created, inform the user that they can clone it manually with `git clone https://github.com/Lintlinger/pipeline-<name>.git customers/<name>`
- **User skips Atlassian config**: Use `<not configured>` placeholders — skills will prompt for values when needed
- **`gh` CLI not authenticated**: Inform the user to run `gh auth login` first
