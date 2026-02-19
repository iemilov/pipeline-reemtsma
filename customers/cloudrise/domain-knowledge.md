# Domain Knowledge: CloudRise Solutions

## Glossary

Common abbreviations used throughout the codebase and documentation:

| Abbreviation | Full Term | English |
|-------------|-----------|---------|
| **CRM** | Customer Relationship Management | Customer Relationship Management |
| **D1** | Cloudflare D1 | Cloudflare's serverless SQLite database |
| **ZUGFeRD** | Zentraler User Guide des Forums elektronische Rechnung Deutschland | German e-invoicing standard (XML embedded in PDF) |
| **Factur-X** | — | French/EU equivalent of ZUGFeRD (same format) |
| **HUR** | Hour (UN/CECE unit code) | Unit code for hours in invoice line items |
| **DnD** | Drag and Drop | @dnd-kit library for Kanban board |

## Business Processes

### Invoice Lifecycle

Invoices follow a Kanban-style status workflow:

1. **Draft** — Invoice created, line items can be added/edited
2. **Sent** — Invoice finalized and sent to customer (PDF generated with ZUGFeRD XML)
3. **Paid** — Payment received

Finalization (`/api/invoices/:id/finalize`) locks the invoice, calculates totals from line items, and generates a PDF with embedded ZUGFeRD/Factur-X XML for e-invoicing compliance.

### External Invoices (Contractor Costs)

Tracks invoices **received from** external contractors/freelancers:
- Linked to a project and a contact (contractor)
- Statuses: `received` → `paid`
- Used for profitability analysis (revenue vs. external costs)
- Known contractors: Lanespot (development), Haddenhorst (consulting)

### Kanban Board

General-purpose task management board with:
- Columns: Backlog, To Do, In Progress, Done
- Cards with priority levels (low, medium, high)
- Tags, subtasks, and project linking
- Drag-and-drop reordering within and across columns

### Dashboard Metrics

The dashboard provides key financial and operational metrics:

- **Revenue** (`revenue_cents`) — Sum of `hours * project_contacts.hourly_rate` for billable time entries on **paid** invoices
- **Outstanding** (`outstanding_cents`) — Sum of `invoices.total_cents` for all invoices in **draft** or **sent** status. Uses the baked-in invoice totals which include all line item types (time + manual) with billing rates applied at finalization.
- **Unbilled** (`unbilled_cents`) — Sum of `hours * project_contacts.hourly_rate` for billable time entries **not yet assigned** to any invoice
- **Utilization** — Based on timecards (billable vs total hours)
- **Profitability** — Revenue minus external costs per project

**Important distinction — billing rates vs cost rates:**
- `project_contacts.hourly_rate` = **billing rate** (what we charge the client) → used for revenue, outstanding, unbilled
- `external_project_contacts.hourly_rate` = **cost rate** (what we pay the contractor) → used only for profitability/cost calculations
- These must never be mixed: outstanding/revenue metrics use billing rates only, profitability uses both

### Contacts & Projects

- **Customers** — Companies/organizations (invoice recipients)
- **Contacts** — Individual people, linked to projects in two ways:
  - **Project contacts** — Internal team members with billing rates (what we charge)
  - **External project contacts** — Contractors with cost rates (what we pay)
- **Projects** — Client engagements with status (`active`/`completed`), linked to a customer

### Timecards

Track hours worked by contacts on projects. Used for utilization metrics and as basis for invoice line items.

## Settings Keys

Settings are stored as key-value pairs in the `settings` table. All company-related keys use the `company_` prefix:

| Key | Purpose |
|-----|---------|
| `company_name` | Legal company name (used in PDF header) |
| `company_street` | Street address |
| `company_postcode` | Postal code |
| `company_city` | City |
| `company_country` | ISO country code (default: `DE`) |
| `company_vat_id` | VAT identification number |
| `company_email` | Contact email |
| `company_phone` | Contact phone |
| `company_iban` | Bank account IBAN |
| `company_bic` | Bank BIC/SWIFT code |
| `company_bank` | Bank name |

## Common Pitfalls

| Correct | Common Mistake | Notes |
|---------|---------------|-------|
| `company_street` | ~~street~~ | All settings keys use `company_` prefix |
| `company_postcode` | ~~postcode~~, ~~zip~~ | Not `zip` or bare `postcode` |
| `total_cents` | ~~total~~ | All monetary values stored in cents (integer) |
| `unit_price_cents` | ~~unit_price~~, ~~price~~ | Cents, not decimal euros |
| `hourly_rate` | ~~rate~~ | In `external_project_contacts`, also in cents |
| `column_id` | ~~status~~ | Kanban cards use `column_id`, not `status` |
| `contact_id` | ~~resource_id~~ | Renamed from `resources` to `contacts` in migration 0009 |

## Database Tables

| Table | Purpose |
|-------|---------|
| `customers` | Companies / invoice recipients |
| `contacts` | People (team members, contractors) |
| `projects` | Client engagements |
| `project_contacts` | Internal team member ↔ project link (with billing rate) |
| `external_project_contacts` | Contractor ↔ project link (with cost rate) |
| `invoices` | Outgoing invoice headers |
| `invoice_line_items` | Invoice line items (hours, amounts) |
| `external_invoices` | Incoming contractor invoices |
| `timecards` | Hours worked per contact per project |
| `cards` | Kanban board cards |
| `tags` | Card tags |
| `card_tags` | Card ↔ tag junction table |
| `subtasks` | Card subtasks with completion status |
| `settings` | Key-value store for app configuration |
