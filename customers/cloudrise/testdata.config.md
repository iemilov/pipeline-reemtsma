# Test Data Configuration: CloudRise CRM

## Overview

This configuration defines test data records to be created in the CloudRise CRM application via its REST API (`/api/<resource>`). Records are organized by dependency order — parent records are created first.

**Target:** Cloudflare D1 database via Pages Functions API
**Auth:** Session cookie (admin user)

## Record Groups

---

### 1. Settings (Company Info)

These are key-value pairs in the `settings` table. Use `PUT /api/settings` for each key.

| Key | Value |
|-----|-------|
| `company_name` | `CloudRise Solutions GmbH` |
| `company_street` | `Musterstraße 42` |
| `company_postcode` | `70173` |
| `company_city` | `Stuttgart` |
| `company_country` | `DE` |
| `company_vat_id` | `DE123456789` |
| `company_email` | `info@cloudrise-solutions.de` |
| `company_phone` | `+49 711 1234567` |
| `company_iban` | `DE89 3704 0044 0532 0130 00` |
| `company_bic` | `COBADEFFXXX` |
| `company_bank` | `Commerzbank Stuttgart` |

---

### 2. Customers

Use `POST /api/customers`.

#### 2a. Customer: OMMAX Digital Solutions

| Field | Value |
|-------|-------|
| `name` | `OMMAX Digital Solutions GmbH` |
| `customer_number` | `K-2025-001` |
| `street` | `Maximilianstraße 35` |
| `postcode` | `80539` |
| `city` | `München` |
| `country_code` | `DE` |
| `vat_id` | `DE300111222` |
| `email` | `billing@ommax.de` |
| `phone` | `+49 89 5551234` |
| `contact_person` | `Thomas Berger` |
| referenceId | `customerOmmax` |

#### 2b. Customer: BVB Borussia Dortmund

| Field | Value |
|-------|-------|
| `name` | `BVB Borussia Dortmund GmbH & Co. KGaA` |
| `customer_number` | `K-2025-002` |
| `street` | `Rheinlanddamm 207-209` |
| `postcode` | `44137` |
| `city` | `Dortmund` |
| `country_code` | `DE` |
| `vat_id` | `DE811222333` |
| `email` | `einkauf@bvb.de` |
| `phone` | `+49 231 9020` |
| `contact_person` | `Julia Weber` |
| referenceId | `customerBvb` |

#### 2c. Customer: Stadtwerke Tübingen

| Field | Value |
|-------|-------|
| `name` | `Stadtwerke Tübingen GmbH` |
| `customer_number` | `K-2025-003` |
| `street` | `Eisenhutstraße 6` |
| `postcode` | `72072` |
| `city` | `Tübingen` |
| `country_code` | `DE` |
| `email` | `info@swtue.de` |
| `phone` | `+49 7071 1570` |
| `contact_person` | `Markus Schneider` |
| referenceId | `customerSwtue` |

---

### 3. Contacts (Company Resources)

Use `POST /api/contacts`.

#### 3a. Contact: Joachim Lintl (Senior Developer)

| Field | Value |
|-------|-------|
| `name` | `Joachim Lintl` |
| `email` | `j.lintl@cloudrise-solutions.de` |
| `role` | `Senior Developer` |
| `hourly_rate` | `125` |
| `type` | `company_resource` |
| referenceId | `contactJoachim` |

#### 3b. Contact: Sarah Müller (UX Designer)

| Field | Value |
|-------|-------|
| `name` | `Sarah Müller` |
| `email` | `s.mueller@cloudrise-solutions.de` |
| `role` | `UX Designer` |
| `hourly_rate` | `110` |
| `type` | `company_resource` |
| referenceId | `contactSarah` |

#### 3c. Contact: Max Fischer (Project Manager)

| Field | Value |
|-------|-------|
| `name` | `Max Fischer` |
| `email` | `m.fischer@cloudrise-solutions.de` |
| `role` | `Project Manager` |
| `hourly_rate` | `130` |
| `type` | `company_resource` |
| referenceId | `contactMax` |

#### 3d. Contact: Lanespot Ltd (External Contractor)

| Field | Value |
|-------|-------|
| `name` | `Lanespot Ltd` |
| `email` | `billing@lanespot.io` |
| `role` | `External Development` |
| `hourly_rate` | `100` |
| `type` | `external` |
| referenceId | `contactLanespot` |

#### 3e. Contact: Thorsten Haddenhorst (External Consultant)

| Field | Value |
|-------|-------|
| `name` | `Thorsten Haddenhorst` |
| `email` | `t.haddenhorst@consulting.de` |
| `role` | `CRM Product Owner` |
| `hourly_rate` | `120` |
| `type` | `external` |
| referenceId | `contactThorsten` |

---

### 4. Projects

Use `POST /api/projects`.

#### 4a. Project: OMMAX — CRM Relaunch

| Field | Value |
|-------|-------|
| `customer_id` | `{{Ref:customerOmmax}}` |
| `name` | `CRM Relaunch` |
| `description` | `Kompletter Relaunch des CRM-Systems auf Cloudflare Workers` |
| `status` | `active` |
| `budget_cents` | `15000000` |
| `hourly_rate` | `125` |
| `start_date` | `2025-09-01` |
| `end_date` | `2026-06-30` |
| referenceId | `projectOmmaxCrm` |

#### 4b. Project: BVB — Fan Portal

| Field | Value |
|-------|-------|
| `customer_id` | `{{Ref:customerBvb}}` |
| `name` | `Fan Portal` |
| `description` | `Fan-Portal mit Ticketing und Membership-Management` |
| `status` | `active` |
| `budget_cents` | `25000000` |
| `hourly_rate` | `130` |
| `start_date` | `2025-07-01` |
| `end_date` | `2026-12-31` |
| referenceId | `projectBvbPortal` |

#### 4c. Project: Stadtwerke — Kundenportal

| Field | Value |
|-------|-------|
| `customer_id` | `{{Ref:customerSwtue}}` |
| `name` | `Kundenportal` |
| `description` | `Self-Service Kundenportal für Strom- und Gasverträge` |
| `status` | `active` |
| `budget_cents` | `8000000` |
| `hourly_rate` | `110` |
| `start_date` | `2026-01-01` |
| `end_date` | `2026-09-30` |
| referenceId | `projectSwtuePotal` |

#### 4d. Project: OMMAX — Technical Architecture (Completed)

| Field | Value |
|-------|-------|
| `customer_id` | `{{Ref:customerOmmax}}` |
| `name` | `Technical Architecture` |
| `description` | `Architekturberatung und technisches Konzept` |
| `status` | `completed` |
| `budget_cents` | `5000000` |
| `hourly_rate` | `150` |
| `start_date` | `2025-06-01` |
| `end_date` | `2025-08-31` |
| referenceId | `projectOmmaxArch` |

---

### 5. Project Contacts (Billing Rates)

Use `POST /api/projects/:id/contacts`.

#### Internal Team Assignments

| Project | Contact | Hourly Rate | referenceId |
|---------|---------|-------------|-------------|
| `{{Ref:projectOmmaxCrm}}` | `{{Ref:contactJoachim}}` | `125` | `pcOmmaxJoachim` |
| `{{Ref:projectOmmaxCrm}}` | `{{Ref:contactSarah}}` | `110` | `pcOmmaxSarah` |
| `{{Ref:projectBvbPortal}}` | `{{Ref:contactJoachim}}` | `130` | `pcBvbJoachim` |
| `{{Ref:projectBvbPortal}}` | `{{Ref:contactMax}}` | `130` | `pcBvbMax` |
| `{{Ref:projectBvbPortal}}` | `{{Ref:contactSarah}}` | `110` | `pcBvbSarah` |
| `{{Ref:projectSwtuePotal}}` | `{{Ref:contactJoachim}}` | `110` | `pcSwtueJoachim` |
| `{{Ref:projectSwtuePotal}}` | `{{Ref:contactMax}}` | `110` | `pcSwtueMax` |

#### External Contractor Assignments

Use the external contacts API for these.

| Project | Contact | Hourly Rate (Cost) | referenceId |
|---------|---------|-------------------|-------------|
| `{{Ref:projectOmmaxCrm}}` | `{{Ref:contactLanespot}}` | `10000` | `epcOmmaxLanespot` |
| `{{Ref:projectBvbPortal}}` | `{{Ref:contactThorsten}}` | `12000` | `epcBvbThorsten` |

---

### 6. Invoices

Use `POST /api/invoices`.

#### 6a. Invoice: OMMAX January 2026 (Sent)

| Field | Value |
|-------|-------|
| `customer_id` | `{{Ref:customerOmmax}}` |
| `project_id` | `{{Ref:projectOmmaxCrm}}` |
| `invoice_date` | `2026-01-31` |
| `reference` | `PO-2026-OMMAX-01` |
| `performance_period` | `01.01.2026 - 31.01.2026` |
| referenceId | `invoiceOmmaxJan` |

#### 6b. Invoice: BVB December 2025 (Paid)

| Field | Value |
|-------|-------|
| `customer_id` | `{{Ref:customerBvb}}` |
| `project_id` | `{{Ref:projectBvbPortal}}` |
| `invoice_date` | `2025-12-31` |
| `reference` | `PO-2025-BVB-12` |
| `performance_period` | `01.12.2025 - 31.12.2025` |
| referenceId | `invoiceBvbDec` |

#### 6c. Invoice: OMMAX February 2026 (Draft)

| Field | Value |
|-------|-------|
| `customer_id` | `{{Ref:customerOmmax}}` |
| `project_id` | `{{Ref:projectOmmaxCrm}}` |
| `invoice_date` | `2026-02-28` |
| `reference` | `PO-2026-OMMAX-02` |
| `performance_period` | `01.02.2026 - 28.02.2026` |
| referenceId | `invoiceOmmaxFeb` |

#### 6d. Invoice: BVB January 2026 (Sent)

| Field | Value |
|-------|-------|
| `customer_id` | `{{Ref:customerBvb}}` |
| `project_id` | `{{Ref:projectBvbPortal}}` |
| `invoice_date` | `2026-01-31` |
| `reference` | `PO-2026-BVB-01` |
| `performance_period` | `01.01.2026 - 31.01.2026` |
| referenceId | `invoiceBvbJan` |

---

### 7. Invoice Line Items

Use `POST /api/invoices/:id/line-items`.

#### 7a. Line Items: OMMAX January 2026 (invoiceOmmaxJan)

| date | description | contact_id | quantity | unit | unit_price_cents | vat_percent | type |
|------|-------------|------------|----------|------|-----------------|-------------|------|
| `2026-01-06` | `Feature: Dashboard Komponenten` | `{{Ref:contactJoachim}}` | `8` | `HUR` | `12500` | `19` | `time` |
| `2026-01-07` | `Feature: Dashboard Komponenten` | `{{Ref:contactJoachim}}` | `8` | `HUR` | `12500` | `19` | `time` |
| `2026-01-08` | `UX Review Dashboard` | `{{Ref:contactSarah}}` | `4` | `HUR` | `11000` | `19` | `time` |
| `2026-01-13` | `API: Invoice Endpoints` | `{{Ref:contactJoachim}}` | `8` | `HUR` | `12500` | `19` | `time` |
| `2026-01-14` | `API: Invoice Endpoints` | `{{Ref:contactJoachim}}` | `6` | `HUR` | `12500` | `19` | `time` |
| `2026-01-15` | `UX: Invoice PDF Layout` | `{{Ref:contactSarah}}` | `6` | `HUR` | `11000` | `19` | `time` |
| `2026-01-20` | `ZUGFeRD Integration` | `{{Ref:contactJoachim}}` | `8` | `HUR` | `12500` | `19` | `time` |
| `2026-01-21` | `ZUGFeRD Integration` | `{{Ref:contactJoachim}}` | `8` | `HUR` | `12500` | `19` | `time` |
| `2026-01-27` | `Hosting & Infrastructure Setup` | | `1` | `C62` | `50000` | `19` | `manual` |

#### 7b. Line Items: BVB December 2025 (invoiceBvbDec)

| date | description | contact_id | quantity | unit | unit_price_cents | vat_percent | type |
|------|-------------|------------|----------|------|-----------------|-------------|------|
| `2025-12-01` | `Sprint Planning & Kickoff` | `{{Ref:contactMax}}` | `4` | `HUR` | `13000` | `19` | `time` |
| `2025-12-02` | `Backend: User Auth` | `{{Ref:contactJoachim}}` | `8` | `HUR` | `13000` | `19` | `time` |
| `2025-12-03` | `Backend: User Auth` | `{{Ref:contactJoachim}}` | `8` | `HUR` | `13000` | `19` | `time` |
| `2025-12-09` | `Frontend: Login Flow` | `{{Ref:contactJoachim}}` | `8` | `HUR` | `13000` | `19` | `time` |
| `2025-12-10` | `UX: Fan Portal Wireframes` | `{{Ref:contactSarah}}` | `8` | `HUR` | `11000` | `19` | `time` |
| `2025-12-15` | `Projektleitung Dezember` | `{{Ref:contactMax}}` | `6` | `HUR` | `13000` | `19` | `time` |

#### 7c. Line Items: OMMAX February 2026 (invoiceOmmaxFeb — Draft)

| date | description | contact_id | quantity | unit | unit_price_cents | vat_percent | type |
|------|-------------|------------|----------|------|-----------------|-------------|------|
| `2026-02-03` | `CSV Export Feature` | `{{Ref:contactJoachim}}` | `6` | `HUR` | `12500` | `19` | `time` |
| `2026-02-04` | `CSV Export Feature` | `{{Ref:contactJoachim}}` | `4` | `HUR` | `12500` | `19` | `time` |
| `2026-02-10` | `Dashboard Profitability Fix` | `{{Ref:contactJoachim}}` | `3` | `HUR` | `12500` | `19` | `time` |
| `2026-02-11` | `Portal Timesheet Bugfix` | `{{Ref:contactJoachim}}` | `2` | `HUR` | `12500` | `19` | `time` |

#### 7d. Line Items: BVB January 2026 (invoiceBvbJan)

| date | description | contact_id | quantity | unit | unit_price_cents | vat_percent | type |
|------|-------------|------------|----------|------|-----------------|-------------|------|
| `2026-01-06` | `API: Ticketing Module` | `{{Ref:contactJoachim}}` | `8` | `HUR` | `13000` | `19` | `time` |
| `2026-01-07` | `API: Ticketing Module` | `{{Ref:contactJoachim}}` | `8` | `HUR` | `13000` | `19` | `time` |
| `2026-01-08` | `UX: Ticket Purchase Flow` | `{{Ref:contactSarah}}` | `6` | `HUR` | `11000` | `19` | `time` |
| `2026-01-13` | `Sprint Review & Planning` | `{{Ref:contactMax}}` | `4` | `HUR` | `13000` | `19` | `time` |
| `2026-01-14` | `Frontend: Membership Dashboard` | `{{Ref:contactJoachim}}` | `8` | `HUR` | `13000` | `19` | `time` |
| `2026-01-20` | `Reisekosten Januar` | | `1` | `C62` | `35000` | `19` | `manual` |

---

### 8. External Invoices (Contractor Costs)

Use `POST /api/projects/:id/external-invoices`.

#### 8a. Lanespot — OMMAX CRM Relaunch

| invoice_number | contact_id | invoice_date | hours | total_cents | note |
|---------------|------------|-------------|-------|-------------|------|
| `LS-2026-001` | `{{Ref:contactLanespot}}` | `2026-01-31` | `80` | `800000` | `Development Support Januar 2026` |
| `LS-2026-002` | `{{Ref:contactLanespot}}` | `2026-02-15` | `40` | `400000` | `Development Support Februar 2026 (1. Hälfte)` |

#### 8b. Haddenhorst — BVB Fan Portal

| invoice_number | contact_id | invoice_date | hours | total_cents | note |
|---------------|------------|-------------|-------|-------------|------|
| `TH-2026-001` | `{{Ref:contactThorsten}}` | `2026-01-31` | `32` | `384000` | `Product Owner Consulting Januar 2026` |

---

### 9. Kanban Cards

Use `POST /api/cards`.

| title | description | column_id | priority | project_id |
|-------|-------------|-----------|----------|------------|
| `CSV Export testen` | `CSV Export mit Spaltenauswahl in verschiedenen Browsern testen` | `todo` | `high` | `{{Ref:projectOmmaxCrm}}` |
| `Angebotssystem Dokumentation` | `Confluence-Seite für Offer-Feature erstellen` | `backlog` | `medium` | `{{Ref:projectOmmaxCrm}}` |
| `Fan Portal: Push Notifications` | `Push-Benachrichtigungen für Spieltag-Updates` | `in_progress` | `high` | `{{Ref:projectBvbPortal}}` |
| `Kundenportal Mockups` | `Erste Wireframes für Strom/Gas Self-Service` | `todo` | `medium` | `{{Ref:projectSwtuePotal}}` |
| `CI/CD Pipeline optimieren` | `Build-Zeiten reduzieren, Caching verbessern` | `backlog` | `low` | |

---

## Invoice Status Transitions

After creating invoices and their line items, transition statuses:

| Invoice | Target Status | Method |
|---------|--------------|--------|
| `{{Ref:invoiceOmmaxJan}}` | `sent` | `POST /api/invoices/:id/finalize` |
| `{{Ref:invoiceBvbDec}}` | `paid` | Finalize first, then `PUT /api/invoices/:id` with `status: 'paid', paid_date: '2026-01-15'` |
| `{{Ref:invoiceBvbJan}}` | `sent` | `POST /api/invoices/:id/finalize` |
| `{{Ref:invoiceOmmaxFeb}}` | `draft` | No action needed (default) |

---

## Dependency Order

1. **Settings** — Company info (no dependencies)
2. **Customers** — Invoice recipients (no dependencies)
3. **Contacts** — Team members and contractors (no dependencies)
4. **Projects** — Need Customer IDs from step 2
5. **Project Contacts** — Need Project IDs from step 4 and Contact IDs from step 3
6. **Invoices** — Need Customer IDs from step 2 and Project IDs from step 4
7. **Invoice Line Items** — Need Invoice IDs from step 6 and Contact IDs from step 3
8. **Invoice Status Transitions** — Need Invoice IDs from step 6 (after line items added)
9. **External Invoices** — Need Project IDs from step 4 and Contact IDs from step 3
10. **Kanban Cards** — Need Project IDs from step 4 (optional)

## Notes

- All `{{Ref:<referenceId>}}` tokens are replaced with the ID of the referenced record created earlier
- All monetary values in `_cents` fields are integers (e.g., `12500` = 125,00 EUR)
- `hourly_rate` in project_contacts is in cents; in contacts table it's in euros (display rate)
- Invoice line items with `type: 'time'` have `hours` equal to `quantity`
- Line items with `type: 'manual'` are flat-fee items (no contact, unit = `C62`)
- Invoices must be finalized (`POST /api/invoices/:id/finalize`) before transitioning to `sent` — this locks the invoice and recalculates totals
- External invoice `total_cents` = `hours * external_project_contacts.hourly_rate`
