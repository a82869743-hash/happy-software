# Happy Car Wash GMS - Features & Working Guide

HAPPY CAR WASH GMS is a localized Garage Management System (GMS) custom-built for Happy Car Wash, functioning as an ERP tool designed to manage operational pipelines, finances, personnel, and customer relations.

## Core Features & Modules

### 1. Operations & Job Card Pipeline
- **Job Card Management:** Core operational workflow with a strict status pipeline (`rfe` â†’ `estimation` â†’ `spares_pending` â†’ `wip` â†’ `ready` â†’ `delivered` â†’ `invoiced`).
- **Quick Job Cards:** Express creation of job cards for fast billing presets.
- **Service Bookings & Calendar:** Manages advance and service bookings with an interactive kanban board for technicians.
- **Estimates:** Standalone/GST estimate management. Converts estimates to job cards and manages estimation history.
- **Inspections & Quality Control:** Pre and post-service inspection checklists, customer concern tracking.

### 2. Customer Relationship Management (CRM)
- **Customer Directory:** Manage individual, fleet, or corporate profiles.
- **Vehicle Registry:** Manages a directory of vehicles tied to customers. Auto-populates make, model, and variants using a master dataset.
- **Public Tracking System:** Customers receive a live tracking link via SMS/WhatsApp to monitor vehicle progress and view service media timelines.

### 3. Finance & Accounting
- **Invoicing:** Generates physical GST (`INV-`) and Non-GST (`NGST-`) invoices.
- **Cash Ledger:** Tracks office cash drawers, physical safe deposits, and cash flow entries.
- **Customer Payments:** Manages ledger accounts, tracking billed, paid, and outstanding receivable balances.
- **Retail Sales:** Dedicated panels for Accessory/Merchandise sales and Spare Parts retail billing.

### 4. Inventory & Parts Management
- **Parts Catalog:** Real-time spare parts stock catalog and adjustments.
- **Low Stock Alerts:** Automatic notifications for parts running below minimum stock thresholds.

### 5. People & HR
- **Staff Registry:** Employee directory and roster management.
- **Attendance & Punch Logs:** Tracks check-in, check-out, entry/exit times, and overtime hours.
- **Salary & Payroll:** Calculates monthly metrics, disburses salary payouts, logs them to the ledger, and generates vouchers.

### 6. System & Automations
- **Messaging Integration (MSG91):** Automatically dispatches structured WhatsApp/SMS templates to customers detailing invoice figures and tracking links when job cards update.
- **Notifications Engine:** Aggregates real-time alerts for low stock, upcoming bookings, and job card status changes.
- **Data Imports/Exports:** Excel-based data dumps for accounts, parts, job cards, and staff attendance. Supports bulk Excel catalog imports.

---

## Technical Stack & Working Architecture

### Backend (Node.js + Express)
- **Database:** MySQL via `mysql2/promise` with connection pooling.
- **Authentication:** Protected endpoints use JSON Web Tokens (JWT). A fallback token query param enables standalone authentications for printable reports.
- **Data Processing:** Parameterized SQL queries ensure security against injection. Migrations manage incremental database schemas.

### Frontend (React 19 + TypeScript + Vite)
- **UI Design:** Styled with Tailwind CSS and CSS modules. Utilizes Framer Motion for animations. Dark mode support integrated via HSL theme tokens.
- **State Management:** Relies on local component states and React Context (`AuthContext`, `ThemeContext`) over heavy state stores. React Hook Form & Zod ensure validation.
- **Demo Mode:** Fully static built mock mode (`VITE_DEMO_MODE=true`). Custom interceptors bypass the backend and simulate network requests using mock datasets (`demoData.ts`), allowing offline previews.

### Deployment & Flow
1. **Login & Session:** User logs in, receives a JWT stored in local storage, which is auto-attached to all Axios API requests.
2. **Operations Flow:** When a vehicle enters, an RFE (Request for Estimation) is created. 
3. **Pipeline Control:** As the vehicle moves through the workshop, its job card status is updated. MSG91 integrations automatically notify customers at key stages.
4. **Conclusion:** After final inspections, the card moves to `ready` and `delivered`. Generating an invoice locks the job card as `invoiced`, stopping further edits and adjusting stock/cash ledgers.

