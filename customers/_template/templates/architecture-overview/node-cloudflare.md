# {{ARCHITECTURE_PAGE_TITLE}}

> {{DOCUMENTATION_LANGUAGE}} — Generated {{DATE}}

## Introduction

{{INTRO}}

## Architecture Overview

### Component Statistics

| Type | Count |
|------|-------|
| Frontend Pages/Components | {{COUNT_PAGES}} |
| API Routes (Functions) | {{COUNT_API_ROUTES}} |
| Shared Libraries | {{COUNT_LIBS}} |
| Database Migrations | {{COUNT_MIGRATIONS}} |
| Workers / Sub-Projects | {{COUNT_WORKERS}} |
| Static Assets | {{COUNT_ASSETS}} |

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | {{FRONTEND}} |
| Backend | {{BACKEND}} |
| Database | {{DATABASE}} |
| Build Tool | {{BUILD_TOOL}} |
| Hosting | {{HOSTING}} |

### Key Libraries

| Library | Purpose |
|---------|---------|
{{LIBRARY_TABLE}}

## Project Structure

### Overview

```
{{PROJECT_TREE}}
```

### Sub-Projects / Workers

{{#EACH PROJECT}}
#### {{PROJECT_NAME}}

**Purpose:** {{PROJECT_PURPOSE}}

| Key | Value |
|-----|-------|
| Path | `{{PROJECT_PATH}}` |
| Worker Name | {{WORKER_NAME}} |
| Custom Domain | {{CUSTOM_DOMAIN}} |
| D1 Database | {{D1_DB}} |

{{/EACH}}

## Frontend Architecture

### Pages & Routing

| Route | Page/Component | Description |
|-------|----------------|-------------|
{{ROUTE_TABLE}}

### Key Components

| Component | Path | Description |
|-----------|------|-------------|
{{COMPONENT_TABLE}}

### State Management & Hooks

| Hook/Context | Description |
|--------------|-------------|
{{HOOKS_TABLE}}

## API & Backend

### API Endpoints

{{#EACH API_GROUP}}
#### {{API_GROUP_NAME}}

| Method | Route | Description |
|--------|-------|-------------|
{{API_ROUTE_TABLE}}

{{/EACH}}

### Middleware

| Middleware | Description |
|------------|-------------|
{{MIDDLEWARE_TABLE}}

### Shared Libraries

| Module | Path | Description |
|--------|------|-------------|
{{LIB_TABLE}}

## Data Model

### D1 Schema

{{#EACH DB}}
#### {{DB_NAME}}

| Table | Description | Columns |
|-------|-------------|---------|
{{DB_TABLE}}

{{/EACH}}

### Key Relationships

{{RELATIONSHIP_DIAGRAM}}

### Migrations

| No. | File | Description |
|-----|------|-------------|
{{MIGRATION_TABLE}}

## Integrations

### External Services

| Service | Type | Description |
|---------|------|-------------|
{{INTEGRATION_TABLE}}

### Cloudflare Bindings

| Binding | Type | Resource |
|---------|------|----------|
{{BINDING_TABLE}}

### Background Jobs & Cron Triggers

| Job | Schedule | Description |
|-----|----------|-------------|
{{CRON_TABLE}}

## Authentication & Security

### Auth Mechanism

{{AUTH_MECHANISM}}

### Middleware & Access Control

| Path/Pattern | Protection | Description |
|--------------|------------|-------------|
{{ACCESS_TABLE}}

### Secrets & Environment Variables

| Variable | Source | Description |
|----------|--------|-------------|
{{SECRETS_TABLE}}

## CI/CD & Deployment

### Branch Strategy

```
{{BRANCH_DIAGRAM}}
```

### GitHub Actions Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
{{WORKFLOW_TABLE}}

### Deployment

| Project | Command | Target |
|---------|---------|--------|
{{DEPLOY_TABLE}}

### Releases

| Version | Date | Description |
|---------|------|-------------|
{{RELEASE_TABLE}}

## Code Quality

### ESLint

{{ESLINT_CONFIG}}

### Test Conventions

{{TEST_CONVENTIONS}}

### Build & Bundle

| Project | Build Command | Output |
|---------|---------------|--------|
{{BUILD_TABLE}}
