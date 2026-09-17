---
name: document-api
description: Use when the partner-facing API reference has to be created or brought up to date — generates it from the inbound endpoints (REST resources, web services, platform-event and webhook contracts), their request and response types and the Named Credentials/connected apps for authentication, in a consumer-facing form without internal names; on rerun, diffs against the published reference and updates only what changed
argument-hint: [--out <path>] [--format html|md|openapi] [--include "<pattern>"] [--exclude "<pattern>"] [--diff-only] [--publish]
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

## Purpose

An API reference that is built once from a text collection and then maintained by hand is out of date the day after the next deployment. This skill generates the reference **from the code** — endpoints, methods, parameters, request and response bodies, error codes, authentication — in a form an external consumer can use, and on every rerun updates only what changed, keeping the hand-written parts (introductions, examples the partner supplied, change notes) intact.

## When to Use / When NOT to Use

- Use to create the reference for a new integration partner, and after every change to an inbound endpoint.
- Use with `--diff-only` in CI or before a release to see which documented contracts changed.
- Do NOT use for internal architecture documentation — `/document --type architecture`.
- Do NOT use to document outbound integrations for internal readers; only the parts a consumer needs are included.

## Configuration

Read `pipeline/customer.config.md` (Short Name, documentation language, Platform, the **API Reference** section if present: output path or repository, title, logo, base URLs per environment, which endpoints are obsolete or internal-only, the public names of authentication flows), `pipeline/stack.config.md` (source path, API version, naming prefixes, the endpoint catalogue if maintained there), `pipeline/customer.domain.md` (business names for objects and codes that appear in payloads).

Inputs: `--out` overrides the output path (default from config, else `apiReference/index.html`), `--format` (default `html`; `openapi` writes an additional `openapi.yaml`), `--include`/`--exclude` glob patterns on endpoint paths or class names, `--diff-only` reports changes without writing, `--publish` commits and pushes to the configured reference repository **after** the user has confirmed the diff.

> **Platform Adaptation:** Salesforce extraction is described below; on other platforms, extract from the router/controller layer and the schema definitions named in `stack.config.md` (e.g. route files, OpenAPI annotations, validators).

## Consumer-facing rules

- **No internal names.** No Apex class names, no story keys, no sharing keywords, no internal user or credential names, no environment secrets. Endpoints are described by path, method and purpose.
- **Obsolete endpoints are omitted**, not marked — the config lists them; anything under a `deprecated`/`legacy` marker in code is omitted as well and listed in the run summary for the user.
- **Every write endpoint has an example request body**; every endpoint has an example response and the error responses it actually returns.
- **Credentials and tenant-specific values are placeholders** (`<client-id>`, `<tenant>`), never real values, even from sandboxes.
- **Hand-written blocks are preserved.** Sections between `<!-- manual:start -->` and `<!-- manual:end -->` (or `<!-- manual:<name> -->` markers) in the existing reference are carried over verbatim.

## Workflow

### Step 1: Extract the inbound surface

```bash
grep -rln '@RestResource' <source-path>/classes/ --include='*.cls'
grep -rn 'urlMapping' <source-path>/classes/ --include='*.cls'
grep -rn '@HttpGet\|@HttpPost\|@HttpPut\|@HttpPatch\|@HttpDelete' <source-path>/classes/ --include='*.cls'
grep -rln 'webservice ' <source-path>/classes/ --include='*.cls'
find <source-path> -name '*.platformEvent-meta.xml' -o -path '*objects/*__e/*' 2>/dev/null
find <source-path> -name '*.connectedApp-meta.xml' -o -name '*.namedCredential-meta.xml' -o -name '*.externalCredential-meta.xml' 2>/dev/null
find <source-path>/sites <source-path>/networks -name '*.xml' 2>/dev/null   # guest-accessible surfaces
```

For each REST class: path (`urlMapping`), methods, parameters (URL params, `RestRequest.params`, path segments parsed from `requestURI`), request body type (the class deserialised from `requestBody`), response type (the returned wrapper), status codes set on `RestContext.response`, and thrown/handled errors. Read the wrapper classes recursively to produce field tables: name, type, required (from validation code, not guessed), description (from comments and `customer.domain.md`), example.

Also extract **webhooks the org exposes** to partners (inbound platform events or REST endpoints that partners call) and **outbound webhooks** partners must implement (payload contract of what the org sends) — the latter from the callout classes and the event definitions.

Authentication: from connected apps and sites — flow name (client credentials, JWT, authorization code), scopes, token endpoint per environment (base URLs from config), header format. Never the client secret.

### Step 2: Business descriptions

For each endpoint, write the purpose in one or two sentences in business terms, using `customer.domain.md` for object and code names (e.g. status codes with their meaning). Where a code comment is the only source, rephrase it; do not paste internal wording.

### Step 3: Diff against the published reference

If the output file exists, parse its endpoint index (the `data-endpoint` attributes or headings the generator writes) and compare with the extraction: **new**, **changed** (parameters, fields, methods, errors), **removed** (no longer in code), **manual blocks** to carry over. Print the diff; with `--diff-only`, stop here and write the diff to `apiReference/CHANGES-<YYYY-MM-DD>.md`.

### Step 4: Render

Generate the reference with the configured title and logo: overview and environments, authentication, one section per domain grouping (from config or by URL prefix), each endpoint with method, path, purpose, parameters table, request example, response example, errors; a catalogue section for shared enumerations (from `customer.domain.md` and the picklists the payloads use); a change log section listing the changes from Step 3 with the date.

`html`: a single self-contained file, print-friendly, with a sidebar index; `md`: one file, same order; `openapi`: `openapi.yaml` 3.0 with schemas derived from the wrapper classes.

Reinsert the manual blocks at their marker positions; if a marker's endpoint was removed, keep the block under "Unassigned manual content" and tell the user.

### Step 5: Validate

Check: no internal names (grep the output for class names found in Step 1, story-key patterns, sharing keywords, `__c` API names unless config allows them, secrets patterns), every write endpoint has an example body, all base URLs are placeholders or config values, the HTML opens without external resources.

### Step 6: Deliver

Write the output; show the change summary (new / changed / removed / omitted as obsolete / manual blocks carried). With `--publish`, show the git diff of the reference repository and commit and push only after the user confirms, with a commit message listing the endpoint changes and the CI skip pattern from config if applicable.

Create `<YYYY-MM-DD>-<customer-short-name>-api-reference-document-api.json` in `.claude/skills/35-document-api/logs/` per the CLAUDE.md schema; summary starts with `[endpoints=<n>] [new=<n>] [changed=<n>] [removed=<n>]`.

## Important Rules

- **Generated from code, every time.** Never edit the reference by hand for a contract change; change the code or the config and rerun.
- **Consumer-facing rules are mandatory** — Step 5 must pass before writing.
- **Required/optional comes from validation code**, not from field names or assumptions; when unclear, mark as "optional (not validated)".
- **Manual blocks survive reruns.**
- **Nothing real in examples:** IDs, emails, names, tokens are synthetic.
- Read paths, titles, base URLs, obsolete lists from config. No AI attribution.

## Error Handling

- **No inbound endpoints found:** say so and stop; do not generate an empty reference.
- **Wrapper type cannot be resolved** (dynamic `Map<String,Object>` bodies): document the fields actually read from the map in code, and mark the schema as "open".
- **Existing reference has no endpoint index** (hand-built): treat the whole file as a manual block set, generate alongside as `<out>.generated.<ext>`, and present the diff for the user to merge once; subsequent runs use the generated file.
- **`--publish` without a configured repository:** write locally and say where publishing would need configuration.
