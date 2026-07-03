# {{ARCHITECTURE_PAGE_TITLE}}

> {{DOCUMENTATION_LANGUAGE}} — Generated {{DATE}}

## Introduction

{{INTRO}}

## Architecture Overview

### Component Statistics

| Type | Count |
|------|-------|
| Apex Classes | {{COUNT_APEX}} |
| Lightning Web Components | {{COUNT_LWC}} |
| Aura Components | {{COUNT_AURA}} |
| Flows | {{COUNT_FLOWS}} |
| Triggers | {{COUNT_TRIGGERS}} |
| Custom Objects | {{COUNT_OBJECTS}} |
| Custom Metadata Types | {{COUNT_CMT}} |
| Validation Rules | {{COUNT_VR}} |
| Permission Sets | {{COUNT_PS}} |
| Custom Labels | {{COUNT_LABELS}} |
| Page Layouts | {{COUNT_LAYOUTS}} |
| Profiles | {{COUNT_PROFILES}} |

### Naming Conventions

| Prefix | Domain | Description |
|--------|--------|-------------|
{{PREFIX_TABLE}}

### Platform & API

| Key | Value |
|-----|-------|
| Platform | Salesforce |
| API Version | {{API_VERSION}} |
| Source Path | `force-app/main/default/` |
| Trigger Framework | Trigger Action Framework |

## Functional Domains

{{#EACH DOMAIN}}
### {{DOMAIN_NAME}}

**Purpose:** {{DOMAIN_PURPOSE}}

#### Apex Classes

| Class | Type | Description |
|-------|------|-------------|
{{DOMAIN_APEX_TABLE}}

#### Lightning Web Components

| Component | Description |
|-----------|-------------|
{{DOMAIN_LWC_TABLE}}

#### Flows

| Flow | Type | Object | Description |
|------|------|--------|-------------|
{{DOMAIN_FLOW_TABLE}}

{{/EACH}}

### Cross-Cutting Components

#### Trigger Actions

| Object | Event | Class | Order |
|--------|-------|-------|-------|
{{TRIGGER_ACTION_TABLE}}

#### Batch & Scheduled Jobs

| Class | Type | Schedule | Description |
|-------|------|----------|-------------|
{{BATCH_TABLE}}

#### Utility Classes

| Class | Description |
|-------|-------------|
{{UTILITY_TABLE}}

## Data Model

### Custom Objects

| Object | Label | Description | Fields | Record Types |
|--------|-------|-------------|--------|--------------|
{{OBJECT_TABLE}}

### Key Relationships

{{RELATIONSHIP_DIAGRAM}}

### Custom Metadata Types

| Metadata Type | Description | Records |
|---------------|-------------|---------|
{{CMT_TABLE}}

## Integrations

### External Systems

| System | Type | Named Credential | Description |
|--------|------|-------------------|-------------|
{{INTEGRATION_TABLE}}

### Callout Classes

| Class | Endpoint | Method | Description |
|-------|----------|--------|-------------|
{{CALLOUT_TABLE}}

## Automations

### Flows

| Flow | Type | Object | Trigger | Description |
|------|------|--------|---------|-------------|
{{FLOW_TABLE}}

### Trigger Actions

| Object | Before/After | Event | Class | Order | Description |
|--------|--------------|-------|-------|-------|-------------|
{{TRIGGER_ACTION_DETAIL_TABLE}}

### Validation Rules

| Object | Rule | Description |
|--------|------|-------------|
{{VR_TABLE}}

## Security & Permissions

### Permission Sets

| Permission Set | Description | Assigned Permissions |
|----------------|-------------|----------------------|
{{PS_TABLE}}

### Sharing Model

{{SHARING_MODEL}}

## CI/CD & Deployment

### Branch Strategy

```
{{BRANCH_DIAGRAM}}
```

### Pipeline Stages

| Branch Pattern | Target Environment | Description |
|----------------|--------------------|-------------|
{{PIPELINE_TABLE}}

### Delta Deployment

{{DELTA_DEPLOYMENT}}

### Releases

| Version | Date | Description |
|---------|------|-------------|
{{RELEASE_TABLE}}

## Code Quality

### PMD Rules

| Rule | Priority | Description |
|------|----------|-------------|
{{PMD_TABLE}}

### ESLint (LWC)

{{ESLINT_CONFIG}}

### Test Conventions

{{TEST_CONVENTIONS}}
