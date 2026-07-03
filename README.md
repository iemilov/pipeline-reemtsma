# Pipeline

Repository for all toolsets and skills for AI-assisted project implementation with Claude Code.

## Prerequisites

- Git
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed (`npm install -g @anthropic-ai/claude-code`)
- Access to this repository (GitHub: `Lintlinger/pipeline`)
- Access to the relevant customer config repository (e.g., `Lintlinger/pipeline-cloudrise`)

## Architecture

### Repository Structure

This repository is embedded as a Git submodule in each customer's main project repo under the path `pipeline/`. Customer-specific configuration lives in **separate private GitHub repos** that are cloned locally by `setup.sh` into `pipeline/customers/` (gitignored, not tracked).

```
Main Project Repo (e.g., CloudRise)
└── pipeline/                          ← this repo (submodule)
    ├── CLAUDE.md, setup.sh, skills/   ← shared across all customers
    └── customers/                     ← gitignored (except _template/)
        ├── _template/                 ← tracked template for new customers
        └── <customer>/               ← cloned by setup.sh (gitignored)
```

### Access Control

Each customer's config is a separate private GitHub repo with independent access permissions:

| Repository | Contains | Access |
|------------|----------|--------|
| `pipeline` | Shared skills, CLAUDE.md, setup.sh | All team members |
| `pipeline-<customer>` | Customer config, domain knowledge | Customer team only |

A team member only needs access to the customer config repos they work on. The pipeline repo itself contains **no customer names or references** — customer isolation is enforced by GitHub repo permissions and gitignore.

## First-Time Setup

```bash
# 1. Clone the main project repo
git clone https://github.com/Lintlinger/<main-project-repo>.git
cd <main-project-repo>

# 2. Initialize the pipeline submodule
git submodule update --init pipeline

# 3. Run setup for your customer (clones customer config repo + creates symlinks)
cd pipeline
./setup.sh <customer-name>
```

The setup script:
1. If no customer name is provided, shows an interactive selection menu (lists already-cloned customers)
2. Clones the customer config repo (`pipeline-<name>`) into `customers/<name>/` if not already present
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

This updates all config symlinks to point to the specified customer folder. If the customer config hasn't been cloned yet, `setup.sh` handles that automatically.

## Onboarding a New Team Member

### Scenario: New contributor joining an existing customer project

Example: A new developer needs access to a customer project.

**Step 1 — Grant GitHub access**

The repo owner grants the new user access to all required repos. Use the `/onboard-user` skill to automate this:

```bash
/onboard-user <github-username> <project-repo>
```

This adds the user as collaborator to:
- `Lintlinger/<main-project-repo>` (main project repo)
- `Lintlinger/pipeline` (shared skills — all team members need this)
- `Lintlinger/pipeline-<customer>` (customer-specific config)

It also generates setup instructions for the new collaborator.

**Step 2 — Clone and set up**

The new contributor runs:

```bash
# Clone the main project repo
git clone https://github.com/Lintlinger/<main-project-repo>.git
cd <main-project-repo>

# Initialize pipeline submodule
git submodule update --init pipeline

# Run setup (clones customer config repo automatically)
cd pipeline
./setup.sh <customer-name>
```

**Step 3 — Verify**

```bash
# Check that customer config is accessible
cat pipeline/customer.config.md       # should show customer config

# Start Claude Code
cd ..   # back to main project root
claude
```

**What about other customers?**

The new user will NOT be able to clone customer config repos they don't have access to. Running `./setup.sh other-customer` would fail with:

```
Error: Failed to clone https://github.com/Lintlinger/pipeline-other-customer.git
You may not have access to this customer repository.
```

This is by design — each customer's data is isolated by GitHub repository permissions. The pipeline repo itself contains no customer names, so users cannot even discover which other customers exist.

## Creating a New Customer

Use the `/create-customer` skill for automated setup, or manually:

1. Create a new private repo named `pipeline-<customer-name>` on GitHub
2. Fill in the config files (use `customers/_template/` as reference):
   - `config.md` — Atlassian credentials, CI/CD settings, folder paths, locale
   - `domain-knowledge.md` — Business glossary, processes, field name pitfalls
   - `stack.config.md` — Tech stack, commands, libraries, conventions
   - `testdata.config.md` — Test data presets (Salesforce only)
3. Clone into the pipeline:
   ```bash
   cd pipeline
   git clone https://github.com/Lintlinger/pipeline-<customer>.git customers/<customer>
   ./setup.sh <customer>
   ```
   No pipeline commit needed — `customers/` is gitignored.

## Updating

### Pull latest pipeline (shared skills)

From the main project repo:
```bash
git submodule update --remote pipeline
git add pipeline
git commit -m "Update pipeline"
```

### Pull latest customer config

```bash
cd pipeline/customers/<customer>
git pull origin main
```

No pipeline commit needed — customer configs are gitignored.

### Pipeline pointer management

Git submodules pin to a specific commit. After any change inside `pipeline/`, two commits are needed:

```bash
# 1. Commit inside the pipeline
cd pipeline
git add . && git commit -m "description" && git push

# 2. Update the pointer in the main repo
cd ..
git add pipeline
git commit -m "Update pipeline"
```

The `/commit` skill handles this automatically.

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
| `/commit <message>` | Commits and pushes changes to all repos safely |
| `/create-testdata [org] [preset]` | Creates test data records in a Salesforce org |
| `/cleanup-testdata [org] [scope]` | Deletes test data records from a Salesforce org |
| `/write-crm-doc` | Creates or updates a Salesforce Knowledge article |
| `/onboard-user <user> <project-repo>` | Adds a GitHub user to required pipeline repos |
| `/create-customer [name]` | Scaffolds a new customer config repo |

## Directory Structure

```
pipeline/
├── CLAUDE.md                          # Project documentation for Claude Code
├── README.md                          # This file
├── setup.sh                           # Clone + symlink setup script
├── .gitignore                         # Ignores customers/*/ (except _template/)
├── customer.config.md                 # Symlink → customers/<active>/config.md
├── customer.domain.md                 # Symlink → customers/<active>/domain-knowledge.md
├── stack.config.md                    # Symlink → customers/<active>/stack.config.md
├── testdata.config.md                 # Symlink → customers/<active>/testdata.config.md
├── customers/
│   ├── _template/                     # Tracked template for new customers
│   │   ├── config.md
│   │   ├── domain-knowledge.md
│   │   ├── stack.config.md
│   │   └── testdata.config.md
│   └── <customer>/                    # Cloned by setup.sh (gitignored)
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
        ├── ...
        └── 15-create-customer/
```

## How It Works

### Architecture

The pipeline acts as a private layer on top of the customer-visible main project repository. Customer configs are further isolated into per-customer private repos, cloned locally (not tracked).

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
└── customers/<name>/ (cloned, gitignored)
    ├── config.md
    ├── domain-knowledge.md
    ├── stack.config.md
    └── testdata.config.md
```

Skills are **generic** — they contain no customer-specific values. All customer-specific configuration lives in per-customer repos under `customers/<name>/`. Switching customers only requires running `setup.sh <name>`.

## Important Notes

- **Confidentiality:** The customer has no access to the pipeline repo or other customers' config repos. Sensitive information (skill prompts, internal processes) must only be committed here, never to the main repo.
- **Customer isolation:** Customer data isolation is enforced by GitHub repo permissions. Customer config repos are cloned locally into gitignored directories — the pipeline repo contains no customer names or references.
- **Logs:** Each skill execution creates a structured JSON log file under `.claude/skills/<skill>/logs/`.
- **No AI attribution:** Never include `Co-Authored-By: Claude` or similar AI attribution in commits to the main repo.
- **`.gitignore` in main repo:** The entries for `CLAUDE.md`, `.claude/`, and `pipeline/.env` ensure that symlinks and sensitive files are never committed to the main repo.
- **Customer config symlinks:** `customer.config.md`, `customer.domain.md`, `stack.config.md`, and `testdata.config.md` are local symlinks inside `pipeline/` — they are gitignored and not committed.
