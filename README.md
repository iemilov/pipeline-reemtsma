# Pipeline

Repository for all toolsets and skills for AI-assisted project implementation with Claude Code.

## Prerequisites

- Git (with submodule support)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed (`npm install -g @anthropic-ai/claude-code`)
- Access to this repository (GitHub: `Lintlinger/ai-project`)

## Submodule Setup

### First-Time Setup

This repository is embedded as a Git submodule in the Salesforce CICD main repo under the path `pipeline/`.

```bash
# 1. Clone the main repo (if not already done)
git clone https://dev.azure.com/LottoBW/Salesforce%20CICD/_git/Salesforce%20CICD
cd "Salesforce CICD"

# 2. Initialize and pull the submodule
git submodule init
git submodule update

# 3. Run the setup script (creates symlinks for Claude Code)
cd pipeline
./setup.sh
```

The setup script creates symlinks in the main repo:

| Symlink | Target | Purpose |
|---------|--------|---------|
| `CLAUDE.md` | `pipeline/CLAUDE.md` | Project documentation for Claude Code |
| `.claude/settings.local.json` | `pipeline/.claude/settings.local.json` | Permissions and settings |
| `.claude/skills` | `pipeline/.claude/skills` | Custom skills (slash commands) |
| `pipeline/customer.config.md` | `pipeline/customers/<name>/config.md` | Customer-specific configuration |
| `pipeline/customer.domain.md` | `pipeline/customers/<name>/domain-knowledge.md` | Customer domain knowledge |

These symlinks are listed in the main repo's `.gitignore` and are not committed.

### Switching Customers

The setup script accepts an optional customer name argument:

```bash
# Default (lotto-bw)
cd pipeline && ./setup.sh

# Explicit customer
cd pipeline && ./setup.sh lotto-bw
```

This updates the `customer.config.md` and `customer.domain.md` symlinks to point to the specified customer folder.

### Creating a New Customer

1. Copy the template folder:
   ```bash
   cp -r pipeline/customers/_template pipeline/customers/<new-customer>
   ```
2. Fill in `config.md` with the customer's Atlassian credentials, naming conventions, org aliases, etc.
3. Fill in `domain-knowledge.md` with business glossary, process logic, and field name pitfalls
4. Run setup with the new customer name:
   ```bash
   cd pipeline && ./setup.sh <new-customer>
   ```

### Updating an Existing Repo

The `.gitmodules` file tracks the `main` branch. To pull the latest version:

```bash
git submodule update --remote pipeline
```

After updating, commit the new submodule pointer in the main repo:

```bash
git add pipeline
git commit -m "update pipeline submodule [skip ci]"
```

## Setting Up Claude Code

### 1. Start Claude Code

```bash
# Run from the Salesforce CICD repo root
claude
```

Claude Code automatically detects `CLAUDE.md`, settings, and skills via the symlinks.

### 2. Activate the Atlassian Plugin

For Jira/Confluence integration, activate the Atlassian plugin once:

```
/plugin
```

Then follow the authentication instructions.

### 3. Configure macOS Notifications (Optional)

To receive macOS notifications when Claude Code needs your attention, install `terminal-notifier` and add it to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/Applications/terminal-notifier.app/Contents/MacOS/terminal-notifier -title 'Claude Code' -message 'Needs your attention' -sound Glass"
          }
        ]
      }
    ]
  }
}
```

To install `terminal-notifier`:

```bash
curl -sL "https://github.com/julienXX/terminal-notifier/releases/download/2.0.0/terminal-notifier-2.0.0.zip" -o /tmp/terminal-notifier.zip
unzip -o /tmp/terminal-notifier.zip -d /tmp/terminal-notifier
cp -R /tmp/terminal-notifier/terminal-notifier.app /Applications/
```

Then find "terminal-notifier" in **System Settings > Notifications** to configure alert style and sounds.

### 4. Available Skills

After setup, the following slash commands are available:

| Command | Description |
|---------|-------------|
| `/create-story <epic-id>` | Creates Jira user stories from meeting transcripts |
| `/implement-us <story-key>` | Implements a user story end-to-end: reads Jira story, checks dependencies, explores codebase & existing automations, generates code, deploys to DEV, creates test data, opens PR |
| `/promote-us <story-key> <env>` | Promotes a story through environments (INT/UAT/PROD): validates locally, generates packages, pushes to trigger CI/CD pipeline, monitors result |
| `/document-us <epic-id>` | Creates a Confluence documentation page for an epic |
| `/architecture-overview` | Generates a technical architecture overview on Confluence |
| `/release-notes <version>` | Creates release notes from the latest master merge commit |
| `/commit <message>` | Commits and pushes changes to both repos safely |

## Directory Structure

```
pipeline/
├── CLAUDE.md                          # Project documentation for Claude Code
├── README.md                          # This file
├── setup.sh                           # Symlink setup script
├── customer.config.md                 # Symlink → customers/<active>/config.md
├── customer.domain.md                 # Symlink → customers/<active>/domain-knowledge.md
├── customers/
│   ├── lotto-bw/
│   │   ├── config.md                  # All Lotto BW-specific values
│   │   └── domain-knowledge.md        # Business logic context
│   └── _template/
│       ├── config.md                  # Blank template for new customers
│       └── domain-knowledge.md        # Template with section structure
└── .claude/
    ├── settings.local.json            # Permissions and settings
    └── skills/
        ├── 01-create-us/
        │   ├── SKILL.md               # Skill definition
        │   └── logs/                  # Execution logs
        ├── 02-implement-us/
        ├── 03-promote-us/
        ├── 04-document-us/
        ├── 05-architecture-overview/
        ├── 06-release-notes/
        └── 07-commit/
```

## How It Works

### Architecture

The pipeline submodule acts as a private layer on top of the customer-visible Salesforce CICD repository. The separation ensures that AI tooling, skill prompts, and internal workflows remain confidential while the main repo stays clean.

```
Salesforce CICD (Azure DevOps)     pipeline/ (GitHub, private)
├── force-app/                     ├── CLAUDE.md (generic)
├── deployment/                    ├── setup.sh
├── scripts/                       ├── customers/<name>/config.md
├── .gitignore (ignores .claude/)  ├── customers/<name>/domain-knowledge.md
└── .gitmodules (→ pipeline)       └── .claude/
         ↑                               ├── settings.local.json
         └── symlinks by setup.sh ───────└── skills/ (generic)
```

Skills are **generic** — they contain no customer-specific values. All customer-specific configuration (Atlassian credentials, naming prefixes, org aliases, language settings, etc.) lives in `customers/<name>/config.md`. Switching customers only requires changing the symlink target.

### Workflow: From Transcript to Deployment

1. Place meeting transcripts (`.docx`, `.xlsx`) into the transcript input folder (see `customer.config.md`)
2. `/create-story <epic-id>` — reads transcripts, creates Jira user stories linked to the epic
3. `/implement-us <story-key>` — full implementation workflow:
   - Reads Jira story, transitions to "In Progress", checks for blocking dependencies
   - Explores codebase patterns and scans for conflicting automations (triggers, flows, validation rules)
   - Creates feature branch, generates implementation code
   - Deploys to DEV org, runs PMD + Apex tests
   - Creates test data in DEV org for manual verification
   - Opens a pull request with Jira story reference
   - Saves any manual deployment steps to `deployment/<version>/Release-<version>-Manual-Deployment-Steps.md`
4. `/promote-us <story-key> <env>` — promotes through environments:
   - `INT`: validates feature branch, pushes to trigger INT pipeline
   - `UAT`: validates locally (PMD + tests), generates delta package, pushes release branch to trigger UAT2 pipeline + DEV sync, validates against PROD
   - `PROD`: confirms with user, pushes master to trigger PROD validation pipeline
   - Monitors pipeline status, comments on Jira story, surfaces manual deployment steps
5. `/document-us <epic-id>` — generates Confluence documentation
6. `/release-notes <version>` — generates release notes from the latest master merge

### Submodule Pointer Management

Git submodules always pin to a specific commit. The `.gitmodules` file is configured with `branch = main` so that `git submodule update --remote` fetches from the `main` branch.

After any change inside `pipeline/`, two commits are needed:

```bash
# 1. Commit inside the submodule
cd pipeline
git add . && git commit -m "description" && git push

# 2. Update the submodule pointer in the main repo
cd ..
git add pipeline
git commit -m "update pipeline submodule [skip ci]"
```

If only step 1 is done, the main repo will show `pipeline` as modified (displayed as `pipeline.diff` in VS Code). This is harmless but should be committed to keep things clean.

## Important Notes

- **Confidentiality:** The customer has no access to this submodule. Sensitive information (skill prompts, internal processes) must only be committed here, never to the main repo.
- **Logs:** Each skill execution creates a log file under `.claude/skills/<skill>/logs/` in the format `<YYYY-MM-DD>-<identifier>-<skill-name>.txt`.
- **No AI attribution:** Never include `Co-Authored-By: Claude` or similar AI attribution in commits to the main repo.
- **`.gitignore` in main repo:** The entries for `CLAUDE.md`, `.claude/`, and `pipeline/.env` ensure that symlinks and sensitive files are never committed to the main repo.
- **Customer config symlinks:** `customer.config.md` and `customer.domain.md` are local symlinks inside `pipeline/` — they are gitignored and not committed.
