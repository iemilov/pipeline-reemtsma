# Atlassian Adapter

> Resolves every Jira/Confluence operation to the concrete mechanism for the customer's `Deployment Type` (`cloud` via the Atlassian MCP tools, `datacenter` via curl + PAT). Skills reference the sections below by number — keep the numbering stable.

## §1 Connection resolution
<!-- TODO: how to read Deployment Type, Cloud ID, Jira URL, Confluence URL, PAT env var name from customer.config.md; when to treat the connection as "not configured" -->

## §2 Authentication
<!-- TODO: cloud (MCP auth) vs datacenter (PAT header); session expiry and re-auth -->

## §3 Jira operations
<!-- TODO: getJiraIssue, searchJiraIssuesUsingJql (epic-link JQL: cloud `parent = <EPIC>`, datacenter `"Epic Link" = <EPIC>`), createJiraIssue, editJiraIssue, addCommentToJiraIssue, transitionJiraIssue — MCP tool name and curl recipe per operation -->

## §4 Confluence operations
<!-- TODO: getConfluencePage, searchConfluenceUsingCql, createConfluencePage, updateConfluencePage (datacenter: XHTML storage format, version.number + 1) -->

## §5 Field mapping
<!-- TODO: custom field ids per site (story points, epic link), view presets -->

## §6 Error handling
<!-- TODO: retry rules, version conflicts, unreachable server -->
