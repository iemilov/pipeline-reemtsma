# Agent Runtime Adapter

> Maps logical operations (ask the user, dispatch a subagent, run an independent review, print warnings) to the active `Agent Runtime` from `customer.config.md`. Skills reference the sections below by number.

## §1 Runtime resolution
<!-- TODO: Agent Runtime key, ## Skill Runtime Overrides, preferred-runtime frontmatter -->

### §1a Runtime mismatch warning
<!-- TODO: the standardized warning text printed when the active runtime differs from a skill's preferred runtime; fields active_runtime / preferred_runtime / runtime_match for the log -->

## §2 Subagent dispatch
<!-- TODO: per runtime — claude-code (Agent tool), openai-codex (codex exec), local-llm, hosted-llm -->

### §2a Independent review dispatch
<!-- TODO: Review Runtime override, same-runtime fallback, graceful degradation, background dispatch contract (prompt file, log file, exit marker, liveness), dispatch table per runtime -->

## §3 User questions
<!-- TODO: AskUserQuestion vs numbered plain-text prompt; question limits per runtime -->

## §4 MCP access
<!-- TODO: which runtimes have MCP tools; fallbacks -->
