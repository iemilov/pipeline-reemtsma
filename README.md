# Pipeline

Repository for all toolsets and skills for AI-assisted project implementation with Claude Code.

## Prerequisites

- Git (with submodule support)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed (`npm install -g @anthropic-ai/claude-code`)
- Access to this repository (GitHub: `Lintlinger/pipeline`)
- Access to the relevant customer repository (e.g., `Lintlinger/pipeline-cloudrise`)

## Architecture

### Two-Layer Submodule Structure

This repository is embedded as a Git submodule in each customer's main project repo under the path `pipeline/`. Customer-specific configuration lives in **separate GitHub repos** that are nested as submodules inside `pipeline/customers/`.

```
Main Project Repo (e.g., CloudRise)
└── pipeline/                          ← this repo (submodule)
    ├── CLAUDE.md, setup.sh, skills/   ← shared across all customers
    └── customers/
        ├── cloudrise/                 ← submodule → pipeline-cloudrise
        ├── lotto-bw/                  ← submodule → pipeline-lotto-bw
        └── drKade/                    ← submodule → pipeline-drkade
```

### Access Control

Each customer's config is a separate GitHub repo with independent access permissions:

| Repository | Contains | Access |
|------------|----------|--------|
| `pipeline` | Shared skills, CLAUDE.md, setup.sh | All team members |
| `pipeline-cloudrise` | CloudRise config, domain knowledge | CloudRise team |
| `pipeline-lotto-bw` | Lotto BW config, domain knowledge | Lotto BW team |
| `pipeline-drkade` | Dr. Kade config, domain knowledge | Dr. Kade team |

A team member only needs access to the customer repos they work on. `setup.sh` gracefully handles missing access — it will report which customer repos are unavailable.

## First-Time Setup

```bash
# 1. Clone the main project repo
git clone https://github.com/Lintlinger/CloudRise.git
cd CloudRise

# 2. Initialize the pipeline submodule
git submodule init
git submodule update

# 3. Run setup for your customer (initializes nested customer submodule + creates symlinks)
cd pipeline
./setup.sh cloudrise
```

The setup script:
1. If no customer name is provided, shows an interactive selection menu
2. Initializes the customer's nested submodule under `customers/<name>/`
3. Creates symlinks for Claude Code to find config files
4. Validates config completeness and warns about missing or placeholder fields

| Symlink | Target | Purpose |
|---------|--------|---------|
| `CLAUDE.md` | `pipeline/CLAUDE.md` | Project documentation for Claude Code |
| `.claude/settings.local.json` | `pipeline/.claude/settings.local.json` | Permissions and settings |
| `.claude/skills` | `pipeline/.claude/skills` | Custom skills (slash commands) |
| `.claude/commands` | `pipeline/.claude/skills` | Slash command aliases |
| `pipeline/customer.config.md` | `customers/<name>/config.md` | Customer-specific configuration |
| `pipeline/customer.domain.md` | `customers/<name>/domain-knowledge.md` | Customer domain knowledge |
| `pipeline/stack.config.md` | `customers/<name>/stack.config.md` | Tech stack configuration |
| `pipeline/testdata.config.md` | `customers/<name>/testdata.config.md` | Test data presets |

These symlinks are listed in the main repo's `.gitignore` and are not committed.

### Switching Customers

```bash
cd pipeline && ./setup.sh <customer-name>
```

This updates all config symlinks to point to the specified customer folder. If the customer submodule hasn't been initialized yet, `setup.sh` handles that automatically.

## Onboarding a New Team Member

### Scenario: New contributor joining an existing customer project

Example: A new developer needs access to the **lotto-bw** project.

**Step 1 — Grant GitHub access**

The repo owner grants the new user access to all required repos. Use the `/onboard-user` skill to automate this:

```bash
/onboard-user <github-username> <project-repo>
```

This adds the user as collaborator to:
- `Lintlinger/<customer-repo-name>` (main project repo)
- `Lintlinger/pipeline` (shared skills — all team members need this)
- `Lintlinger/pipeline-<customer>` (customer-specific config)

It also generates setup instructions for the new collaborator.

**Manual alternative** — grant access via GitHub to:
- `Lintlinger/pipeline` (shared skills — all team members need this)
- `Lintlinger/pipeline-lotto-bw` (customer-specific config)
- The main project repo (e.g., the Lotto BW Salesforce CICD repo)

**Step 2 — Clone and set up**

The new contributor runs:

```bash
# Clone the main project repo (with submodules)
git clone --recurse-submodules https://github.com/Lintlinger/<main-project-repo>.git
cd <main-project-repo>

# Run setup for the customer
cd pipeline
./setup.sh lotto-bw
```

If `--recurse-submodules` was not used during clone:

```bash
git submodule update --init           # initializes pipeline/
cd pipeline
./setup.sh lotto-bw                   # initializes customers/lotto-bw/ submodule + symlinks
```

**Step 3 — Verify**

```bash
# Check that customer config is accessible
cat pipeline/customer.config.md       # should show Lotto BW config

# Start Claude Code
cd ..   # back to main project root
claude
```

**What about other customers?**

The new user will NOT be able to initialize customer submodules they don't have access to. Running `./setup.sh cloudrise` would fail with:

```
Error: Failed to initialize submodule for customers/cloudrise
You may not have access to this customer repository.
```

This is by design — each customer's data is isolated by GitHub repository permissions.

## Creating a New Customer

1. Create a new repo from the template:
   - Go to [pipeline-customer-template](https://github.com/Lintlinger/pipeline-customer-template) on GitHub
   - Click **"Use this template"** → **"Create a new repository"**
   - Name it `pipeline-<customer-name>` (e.g., `pipeline-acme`)
   - Set visibility to **Private**

2. Fill in the config files in the new repo:
   - `config.md` — Atlassian credentials, CI/CD settings, folder paths, locale
   - `domain-knowledge.md` — Business glossary, processes, field name pitfalls (add a `docs/` subfolder for detailed topic files)
   - `stack.config.md` — Tech stack, commands, libraries, conventions
   - `testdata.config.md` — Test data presets and record definitions
   - `README.md` — Auto-generated from template; do not customize per customer

3. Add as submodule in the pipeline repo:
   ```bash
   cd pipeline
   git submodule add https://github.com/Lintlinger/pipeline-<customer>.git customers/<customer>
   git add .gitmodules customers/<customer>
   git commit -m "add customer submodule: <customer>"
   git push
   ```

4. Run setup:
   ```bash
   ./setup.sh <customer>
   ```

## Updating

### Pull latest pipeline (shared skills)

```bash
git submodule update --remote pipeline
```

### Pull latest customer config

```bash
cd pipeline
git submodule update --remote customers/<customer>
```

### After any submodule update

Commit the updated pointer in the parent repo:

```bash
git add pipeline
git commit -m "update pipeline submodule [skip ci]"
```

## Setting Up Claude Code

### 1. Start Claude Code

```bash
# Run from the main project repo root
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
| `/design-us <story-key>` | Creates implementation notes for a user story based on codebase analysis |
| `/implement-us <story-key>` | Implements a user story: reads Jira, explores codebase, generates code, deploys, creates test data, opens PR |
| `/promote-us <story-key> <env>` | Promotes a story through environments: validates, generates packages, triggers CI/CD, monitors result |
| `/document-us <epic-id>` | Creates a Confluence documentation page for an epic |
| `/architecture-overview` | Generates a technical architecture overview on Confluence |
| `/release-notes <version>` | Creates release notes from the latest merge commit |
| `/code-review` | Performs a code review and publishes to Confluence or local Markdown |
| `/build-knowledge <topic>` | Builds domain documentation from Jira, Confluence, and codebase |
| `/commit <message>` | Commits and pushes changes to both repos safely |
| `/create-testdata [org] [preset]` | Creates test data records in a Salesforce org |
| `/cleanup-testdata [org] [scope]` | Deletes test data records from a Salesforce org |
| `/write-crm-doc` | Creates or updates a Salesforce Knowledge article |
| `/onboard-user <user> <project-repo>` | Adds a GitHub user to a main project repo and all required pipeline repos |

## Directory Structure

```
pipeline/
├── CLAUDE.md                          # Project documentation for Claude Code
├── README.md                          # This file
├── setup.sh                           # Symlink + submodule setup script
├── .gitmodules                        # Customer submodule definitions
├── customer.config.md                 # Symlink → customers/<active>/config.md
├── customer.domain.md                 # Symlink → customers/<active>/domain-knowledge.md
├── stack.config.md                    # Symlink → customers/<active>/stack.config.md
├── testdata.config.md                 # Symlink → customers/<active>/testdata.config.md
├── customers/
│   ├── cloudrise/                     # Submodule → pipeline-cloudrise
│   │   ├── config.md
│   │   ├── domain-knowledge.md
│   │   ├── stack.config.md
│   │   └── testdata.config.md
│   ├── lotto-bw/                      # Submodule → pipeline-lotto-bw
│   │   ├── config.md
│   │   ├── domain-knowledge.md
│   │   ├── stack.config.md
│   │   ├── testdata.config.md
│   │   └── docs/                      # Optional domain topic files
│   ├── drKade/                        # Submodule → pipeline-drkade
│   └── _template/                     # Local template (not a submodule)
│       ├── config.md
│       ├── domain-knowledge.md
│       ├── stack.config.md
│       └── testdata.config.md
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
        ├── 07-commit/
        ├── 08-code-review/
        ├── 09-create-testdata/
        ├── 10-build-knowledge/
        ├── 11-design-us/
        ├── 12-cleanup-testdata/
        ├── 13-write-crm-doc/
        └── 14-onboard-user/
```

## How It Works

### Architecture

The pipeline submodule acts as a private layer on top of the customer-visible main project repository. Customer configs are further isolated into per-customer repos for access control.

```
Main Project Repo (customer has READ access)
├── project code, deployment config
├── .gitmodules (→ pipeline)
└── .gitignore (ignores .claude/, CLAUDE.md)
         ↑
         └── symlinks by setup.sh

pipeline/ (private, team-only)
├── CLAUDE.md, setup.sh (shared)
├── .claude/skills/ (shared, generic)
├── .gitmodules (→ customer repos)
└── customers/<name>/ (per-customer submodule)
    ├── config.md
    ├── domain-knowledge.md
    ├── stack.config.md
    └── testdata.config.md
```

Skills are **generic** — they contain no customer-specific values. All customer-specific configuration lives in per-customer repos under `customers/<name>/`. Switching customers only requires running `setup.sh <name>`.

### Submodule Pointer Management

Git submodules always pin to a specific commit. After any change inside `pipeline/`, two commits are needed:

```bash
# 1. Commit inside the submodule
cd pipeline
git add . && git commit -m "description" && git push

# 2. Update the submodule pointer in the main repo
cd ..
git add pipeline
git commit -m "update pipeline submodule [skip ci]"
```

The `/commit` skill handles this automatically.

## Important Notes

- **Confidentiality:** The customer has no access to the pipeline submodule or other customers' repos. Sensitive information (skill prompts, internal processes) must only be committed here, never to the main repo.
- **Access control:** Customer data isolation is enforced by GitHub repo permissions. Each `customers/<name>/` folder is a submodule pointing to a separate private repo.
- **Logs:** Each skill execution creates a structured JSON log file under `.claude/skills/<skill>/logs/`.
- **No AI attribution:** Never include `Co-Authored-By: Claude` or similar AI attribution in commits to the main repo.
- **`.gitignore` in main repo:** The entries for `CLAUDE.md`, `.claude/`, and `pipeline/.env` ensure that symlinks and sensitive files are never committed to the main repo.
- **Customer config symlinks:** `customer.config.md`, `customer.domain.md`, `stack.config.md`, and `testdata.config.md` are local symlinks inside `pipeline/` — they are gitignored and not committed.
