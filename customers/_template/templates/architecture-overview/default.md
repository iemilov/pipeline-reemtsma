# {{ARCHITECTURE_PAGE_TITLE}}

> {{DOCUMENTATION_LANGUAGE}} — Generated {{DATE}}

## Introduction

{{INTRO}}

## Architecture Overview

### Component Statistics

| Type | Count |
|------|-------|
{{COMPONENT_STATS_TABLE}}

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

```
{{PROJECT_TREE}}
```

{{#EACH PROJECT}}
### {{PROJECT_NAME}}

**Purpose:** {{PROJECT_PURPOSE}}

{{/EACH}}

## Frontend Architecture

### Pages & Routing

| Route | Page/Component | Description |
|-------|----------------|-------------|
{{ROUTE_TABLE}}

### Key Components

| Component | Description |
|-----------|-------------|
{{COMPONENT_TABLE}}

## API & Backend

### API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
{{API_ROUTE_TABLE}}

### Shared Libraries

| Module | Description |
|--------|-------------|
{{LIB_TABLE}}

## Data Model

### Schema

| Table/Object | Description | Fields |
|--------------|-------------|--------|
{{SCHEMA_TABLE}}

### Key Relationships

{{RELATIONSHIP_DIAGRAM}}

## Integrations

| Service | Type | Description |
|---------|------|-------------|
{{INTEGRATION_TABLE}}

## Authentication & Security

{{AUTH_MECHANISM}}

## CI/CD & Deployment

### Branch Strategy

```
{{BRANCH_DIAGRAM}}
```

### Pipelines / Workflows

| Pipeline | Trigger | Description |
|----------|---------|-------------|
{{WORKFLOW_TABLE}}

### Deployment

| Project | Command | Target |
|---------|---------|--------|
{{DEPLOY_TABLE}}

## Code Quality

### Linting & Static Analysis

{{LINTING_CONFIG}}

### Test Conventions

{{TEST_CONVENTIONS}}
