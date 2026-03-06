---
name: code-review
description: Perform a comprehensive code review based on the project's tech stack and publish results to Confluence or as local Markdown
argument-hint: [confluence-space-key (optional)]
---

## Configuration

Before executing, read `pipeline/customer.config.md` for customer-specific values (Cloud ID, customer identity, Confluence parent page, documentation language), `pipeline/stack.config.md` for tech stack details (architecture, libraries, conventions, code quality rules), and `pipeline/customer.domain.md` for domain-specific business logic, glossary, and common pitfalls.

## Workflow: Codebase → Code Review Report

Perform a thorough code review of the project codebase, evaluating code quality, security, performance, and adherence to conventions defined in the stack and domain configs.

**Scope Guidance:** Focus on actionable findings:
- Prioritize security issues, bugs, and architectural concerns over stylistic preferences
- Group similar issues rather than listing every occurrence
- Provide concrete fix suggestions for each finding
- Skip auto-generated files, build output, and migration files (unless SQL quality is relevant)

### Step 1: Establish Review Criteria

Based on the **tech stack** from `stack.config.md`, build a review checklist covering:

1. **Stack-specific rules** — e.g., React hook rules, Cloudflare Workers constraints, D1/SQLite best practices
2. **Code quality rules** — ESLint config, naming conventions, project structure conventions
3. **Domain conventions** — Field naming pitfalls, business logic patterns from `customer.domain.md`
4. **Security baseline** — OWASP Top 10 relevant to the stack (XSS, injection, auth issues, CORS, secrets exposure)

### Step 2: Analyze Frontend Code

Scan all frontend source files (e.g., `src/` directory):

1. **Component quality**
   - Proper use of React hooks (dependency arrays, no conditional hooks)
   - Component size and responsibility (identify components that should be split)
   - Prop drilling vs. context usage
   - Missing error boundaries
2. **State management**
   - Unnecessary re-renders, missing memoization where impactful
   - State stored at wrong level (local vs. lifted vs. context)
3. **Accessibility**
   - Missing ARIA attributes on interactive elements
   - Keyboard navigation gaps
   - Missing form labels
4. **CSS / Styling**
   - Inconsistent use of CSS custom properties vs. hardcoded values
   - Theme support gaps (light/dark mode)
   - Responsive design issues

### Step 3: Analyze Backend Code

Scan all backend/API source files (e.g., `functions/` directory):

1. **API design**
   - Consistent REST conventions (HTTP methods, status codes, error responses)
   - Missing input validation or sanitization
   - Inconsistent response formats
2. **Database access**
   - SQL injection risks (parameterized queries check)
   - Missing indexes for common query patterns
   - N+1 query patterns
   - Transaction usage where needed
3. **Authentication & Authorization**
   - Auth middleware consistency
   - Token validation completeness
   - Missing auth checks on protected routes
4. **Error handling**
   - Uncaught promise rejections
   - Missing try/catch on async operations
   - Error information leakage to clients

### Step 4: Security Review

1. **Input handling** — All user inputs validated and sanitized before use
2. **Authentication** — JWT/session handling, password hashing, cookie security flags
3. **Secrets management** — No hardcoded secrets, API keys, or credentials in source
4. **CORS / Headers** — Proper CORS configuration, security headers
5. **Dependency risks** — Known vulnerabilities in dependencies (check `package-lock.json` age and known CVEs if detectable)

### Step 5: Architecture & Patterns Review

1. **Separation of concerns** — Business logic in appropriate layers
2. **Code duplication** — Repeated patterns that should be abstracted
3. **Dead code** — Unused imports, unreachable code, commented-out blocks
4. **Naming consistency** — Variables, functions, files follow project conventions
5. **Migration quality** — Schema consistency, foreign keys, indexes

### Step 6: Run Automated Checks

If available, run linting and type-checking commands from `stack.config.md`:

1. Run ESLint (`npm run lint`) and capture output
2. Note any warnings or errors
3. Include automated findings alongside manual review

### Step 7: Build Review Report

Structure the report in **Markdown** using the **documentation language** from config.

Use the title: `Code Review — <Customer Short Name> <Date>`

1. **Zusammenfassung (Executive Summary)**
   - Overall code health assessment (traffic light: green/yellow/red)
   - Total findings by severity
   - Top 3 most important recommendations

2. **Kritische Befunde (Critical Findings)** — Severity: HIGH
   - Security vulnerabilities
   - Data loss risks
   - Authentication/authorization gaps
   - Each finding: description, location (file:line), impact, fix suggestion

3. **Wichtige Befunde (Important Findings)** — Severity: MEDIUM
   - Performance issues
   - Missing error handling
   - Architectural concerns
   - Each finding: description, location, impact, fix suggestion

4. **Verbesserungsvorschläge (Improvements)** — Severity: LOW
   - Code quality improvements
   - Accessibility gaps
   - Convention inconsistencies
   - Each finding: description, location, suggestion

5. **Automatisierte Prüfungen (Automated Checks)**
   - ESLint results summary
   - Any other tool output

6. **Architektur-Bewertung (Architecture Assessment)**
   - Strengths of the current architecture
   - Areas for improvement
   - Scalability considerations

7. **Empfehlungen (Recommendations)**
   - Prioritized action items (numbered list)
   - Quick wins vs. longer-term improvements
   - Suggested next steps

### Step 8: Save & Publish

1. **Always save locally:** Determine the project directory from `stack.config.md` (e.g., `projects/crm/`). Save the generated Markdown to `<project-dir>/code-review/<YYYY-MM-DD>-code-review.md`. Create the `code-review/` directory if it does not exist.
2. **Check Atlassian connection:** If `Cloud ID` or `Confluence URL` in `customer.config.md` is empty or set to `—`, skip Confluence publishing. Inform the user that the review was saved locally only because no Atlassian connection is configured.
3. If Atlassian is configured and `Confluence Parent Page` is set:
   - Use `searchConfluenceUsingCql` to check if a page with the review title already exists
   - If it exists, update the page using `updateConfluencePage`
   - If it does not exist, create a new page using `createConfluencePage`
     - If `$ARGUMENTS` is provided, use it as the space key
     - Otherwise, ask the user which Confluence space to use
   - Add the page as a subpage of the **Confluence parent page** from config
   - Present the Confluence page URL to the user
4. If Atlassian is configured but `Confluence Parent Page` is `—`, save locally and inform the user.

### Step 9: Summary

Present:
- Link to the Confluence page (if published) or path to the local Markdown file
- Findings count by severity (Critical / Important / Improvement)
- Top 3 action items
- Overall health assessment

## Important Rules
- Follow all conventions from CLAUDE.md
- Output text in the review report uses the **documentation language** from config
- Use the Atlassian MCP tools for all Confluence operations
- Read **Cloud ID** from `customer.config.md` — do not hardcode
- ALWAYS create a log file named `<YYYY-MM-DD>-<customer-short-name>-code-review.json` in `.claude/skills/08-code-review/logs/` — use the structured JSON format from CLAUDE.md
- Focus on actionable findings — avoid nitpicking or stylistic opinions unless they violate project conventions
- Every finding MUST include: severity, file location, description, and a concrete fix suggestion
- Do not report findings in test files unless they represent security risks
- Group recurring patterns (e.g., "missing error handling in 5 API endpoints") rather than listing each individually

## Error Handling
- If the repository structure cannot be read, inform the user and abort
- If no Atlassian connection is configured (Cloud ID or Confluence URL is empty/`—`), save the review as a local Markdown file and inform the user. Do not attempt any Confluence API calls.
- If Confluence page creation or update fails, save the generated Markdown content locally in the logs folder and inform the user
- If linting commands fail or are not configured, note this in the report and continue with manual review
- If the codebase is very large, focus on the most critical areas (API endpoints, auth, data access) and summarize others at a higher level
