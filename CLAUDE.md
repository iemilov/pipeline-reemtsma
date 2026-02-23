# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Customer-specific values:** See `pipeline/customer.config.md` for customer-specific configuration (Atlassian credentials, locale, CI/CD settings).

**Stack configuration:** See `pipeline/stack.config.md` for tech stack details (commands, architecture, libraries, code quality). This is a symlink to the active customer's stack config — each customer may use a different tech stack.

**Domain knowledge:** See `pipeline/customer.domain.md` for customer-specific business logic, glossary, and field name pitfalls.

## Repository Structure (CRITICAL)

**Main Project:** Parent repository (customer-specific)

- Customer has **READ ACCESS** to this repository
- Contains all project code and deployment configuration

**Submodule:** `ai-project` (this repository)

- Customer has **NO ACCESS** to this submodule
- Contains CLAUDE.md, custom skills, and internal AI workflow documentation
- This separation ensures sensitive workflows, prompts, and automation details remain confidential

**Important:** Never commit sensitive information (API keys, internal processes, skill prompts) to the main project repository - only to this submodule.

## Project Overview

The tech stack and project details vary per customer. See `pipeline/stack.config.md` for the active customer's stack configuration (architecture, commands, libraries, conventions, code quality rules).

### Customer Switching

All three config symlinks in `pipeline/` point to the active customer folder:
- `customer.config.md` → `customers/<name>/config.md`
- `customer.domain.md` → `customers/<name>/domain-knowledge.md`
- `stack.config.md` → `customers/<name>/stack.config.md`

## Custom Skills (Slash Commands)

### Transcript → User Story → Code workflow

1. Place meeting transcripts (`.docx`, `.xlsx`) into the transcript input folder (see `customer.config.md`)
2. `/create-story <epic-id>` — Reads all transcripts, synthesizes requirements, creates Jira user stories linked to the epic, and generates implementation notes
3. `/implement-us <story-key>` — Reads the Jira story, explores codebase patterns, and generates a first draft of implementation code using the customer's tech stack (see `stack.config.md`)
4. `/promote-us <story-key> <target-env>` — Promotes a story through environments: validates locally, generates deployment packages, pushes to trigger the CI/CD pipeline, monitors the result
5. `/document-us <epic-id>` — Fetches the epic and all linked stories from Jira, generates a Confluence page with business and technical documentation
6. `/architecture-overview [space-key]` — Analyzes the full repository and publishes a comprehensive technical architecture overview to Confluence
7. `/release-notes [version]` — Generates release notes from the latest merge commit by resolving all referenced Jira stories
8. `/code-review [space-key]` — Performs a comprehensive code review based on the project's tech stack and publishes results to Confluence or as local Markdown
9. `/build-knowledge <epic-id|topic>` — Builds comprehensive internal domain documentation as Markdown topic files, consolidating knowledge from Jira, Confluence, codebase, and existing docs

## Additional Skill Remarks

- ALWAYS create a log file for each execution of a skill in this pattern: `<YYYY-MM-DD>-<customer-short-name>-<identifier>-<skill-name>.txt` where `<customer-short-name>` is the **Short Name** from `customer.config.md` and `<identifier>` is the story key, epic key, or version depending on the skill. Copy the complete output as text into this file and store it under the `logs/` subfolder of each skill's directory (e.g., `.claude/skills/02-implement-us/logs/`)
- NEVER state in any metadata that it was co-authored by Claude Code
- All Atlassian integration details (Jira URL, Cloud ID, Confluence URL, project key, components) are in `customer.config.md`
- Deployment commits include the CI skip pattern from `customer.config.md`
