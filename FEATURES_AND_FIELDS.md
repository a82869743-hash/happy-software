# HAPPY CAR WASH GMS â€” Features & Fields Documentation

This document provides a comprehensive overview of all the modules, features, database fields, and financial workflows used in the HAPPY Garage Management System (GMS).

---

## ðŸ“‹ 1. Job Cards Module
The core module used to register vehicles, diagnose issues, assign service advisors, and manage job statuses.

### Key Features:
* **Vehicle Check-In:** Log odometer, fuel level, vehicle registration number, and make/model.
* **Estimate/Billing items:** Add Spare Parts and Labour charges to a job card with tax rates, discount, and HSN codes.
* **Separation in View/Print:** Visual separation of Spare Parts and Labour in invoice, estimate, public link, and printable layouts.
* **Finalize & Bill:** Generate GST Invoices (with CGST/SGST breakdown) or Non-GST Invoices directly from job cards.

### Fields and Schema (`job_cards` table):
* `id` (INT, Primary Key): Unique job card identifier.
* `job_no` (VARCHAR): Unique serial job card code (e.g. `SCW-J260713-002`).
* `reg_no` (VARCHAR): Vehicle registration number.
* `car_name` (VARCHAR): Brand and model name.
* `owner_name` (VARCHAR): Customer's name.
* `mobile_no` (VARCHAR): Customer's contact number.
* `customer_id` (INT): Links to the customer directory.
* `vehicle_id` (INT): Links to the vehicle directory.
* `odometer` (INT): Current odometer reading.
* `fuel_level` (VARCHAR): Current fuel (e.g. `Empty`, `1/4`, `1/2`, `3/4`, `Full`).
* `promised_date` (DATE): Target date for delivery.
* `promised_time` (TIME): Target delivery time.
* `advisor_id` (INT): Service advisor staff member.
* `status` (VARCHAR): Current progress (`draft`, `pending`, `in_progress`, `ready`, `completed`).
* `subtotal` (DECIMAL): Taxable value of all service items.
* `gst_percent` (DECIMAL): Standard GST rate applied.
* `gst_amount` (DECIMAL): Combined CGST and SGST amount.
* `grand_total` (DECIMAL): Overall total billing amount.
* `public_token` (VARCHAR): Unique secure hash used to generate public tracking links.

---

## ðŸ“ 2. Estimates Module
Used to construct repair quotes prior to job card finalization or as a standalone document.

### Key Features:
* **Estimate Billing:** Generates printable estimates with Happy Car Wash branding and logo.
* **Standalone Estimates:** Allows creating quotes for walk-in customers who do not have an active job card.

### Fields and Schema (`estimates` table):
* `id` (INT, Primary Key): Unique estimate identifier.
* `estimate_no` (VARCHAR): Unique quote serial number.
* `job_card_id` (INT, Nullable): Links to the parent job card (if any).
* `customer_name` (VARCHAR): Customer name.
* `reg_no` (VARCHAR): Registration number of the vehicle.
* `car_name` (VARCHAR): Brand/model details.
* `subtotal` (DECIMAL): Cumulative estimate quote value.
* `total_amount` (DECIMAL): Final estimated total amount.

---

## ðŸ§¾ 3. Invoices Module
Maintains the audit log of final bills generated for accounting purposes.

### Key Features:
* **GST Invoices:** Standardized tax invoice formats displaying SGST, CGST, and HSN/SAC codes.
* **Non-GST Invoices:** For billing transactions that do not require GST registration or tax collection.

### Fields and Schema (`invoices` & `invoices_non_gst` tables):
* `id` (INT, Primary Key): Unique invoice ID.
* `invoice_no` (VARCHAR): Unique tax invoice number (e.g. `SCW-I260713-002`).
* `job_card_id` (INT): Links to the parent job card.
* `subtotal` (DECIMAL): Base taxable value.
* `gst_percent` (DECIMAL): GST percentage rate.
* `gst_amount` (DECIMAL): Calculated GST tax amount.
* `total_amount` (DECIMAL): Final amount to be collected from the customer.
* `payment_mode` (VARCHAR): Mode recorded (`cash`, `upi`, `card`, `bank_transfer`).

---

## ðŸ’µ 4. Customer Payments & Outstanding
Keeps track of customer payments, advances, outstanding balances, and write-offs.

### Key Features:
* **Advance Payments:** Log deposits paid by customers when the vehicle is checked in (deducted from final balance).
* **Outstanding Separation:** Tabbed view separates GST Invoice outstanding balances (Job Cards) from Estimate outstanding balances.
* **Settlement Discounts (Write-offs):** Settle bills for a lower amount (e.g., settling a â‚¹22,243 bill for â‚¹22,000 cash) by recording the difference (â‚¹243) as a `'discount'` payment mode. This brings the outstanding balance to `0` and closes the bill without inflating cash inflows.

### Fields and Schema (`customer_payments` table):
* `id` (INT, Primary Key): Unique payment transaction ID.
* `job_card_id` (INT, Nullable): Links payment to job card.
* `estimate_id` (INT, Nullable): Links payment to standalone estimate.
* `amount` (DECIMAL): Amount recorded in this transaction.
* `payment_mode` (VARCHAR): Mode used (`cash`, `upi`, `card`, `bank_transfer`, `discount`).
* `transaction_id` (VARCHAR): Reference code (UPI ref or Card last 4).
* `payment_date` (DATE): Date payment was received.
* `remarks` (TEXT): Remarks/description (e.g., `Settlement Discount`).

---

## ðŸ’¼ 5. Staff, Attendance & Salaries
Used to manage mechanics, service advisors, daily attendance logs, and salary payments.

### Key Features:
* **Attendance System:** Check-in staff and mark status (`present`, `absent`, `half_day`).
* **Salary Calculator:** Calculates monthly pay based on days present and logs paid salary payouts automatically.

### Fields and Schema:
* **Attendance (`attendance` table):**
  * `id` (INT, Primary Key)
  * `staff_id` (INT): Links to employee.
  * `attendance_date` (DATE): Date of log.
  * `status` (VARCHAR): Status (`present`, `absent`, `half_day`).
* **Staff Payments (`staff_payments` table):**
  * `id` (INT, Primary Key)
  * `staff_id` (INT): Links to employee.
  * `payment_date` (DATE): Date payout was completed.
  * `payment_month` (VARCHAR): Month (e.g., `July 2026`).
  * `days_present` (DECIMAL): Total present days.
  * `calculated_salary` (DECIMAL): Base calculated wages.
  * `paid_amount` (DECIMAL): Actual money paid out.
  * `payment_mode` (VARCHAR): Payout mode (`cash`, `upi`, `bank_transfer`).

---

## ðŸ““ 6. Cash Ledger Module
The daily cash book displaying actual cash flow running through the workshop.

### Key Features:
* **Inflows/Outflows Ledger:** Manually or automatically logs inflows (customer cash payments, counter sales) and outflows (salary cash payments, parts restocking).
* **Double-Counting Prevention:** Inflow and outflow lists automatically filter out automated system logging when viewing "Other Cash" details.

### Fields and Schema (`cash_ledger` table):
* `id` (INT, Primary Key)
* `entry_type` (ENUM): Cash flow direction (`in`, `out`).
* `amount` (DECIMAL): Money value.
* `category` (VARCHAR): Group name (`Customer Payment`, `Product Sale`, `Spare Parts Sale`, `Staff Salary`, `Spare Parts Purchase`, `Other`).
* `description` (VARCHAR): Narrative text describing transaction.
* `entry_date` (DATETIME): Date and time of ledger post.

---

## ðŸ“ˆ 7. Accounts & Daily Closing Reports
Aggregates daily, weekly, or monthly logs into unified dashboards and printable daily summaries.

### Key Features:
* **Accounts Page:** Displays Accrual Profit (Billed Revenue - Expenses), Cash Flow (Cash Received - Expenses), and cumulative accounts receivable.
* **Side-by-Side Excel Closing:** Generates a structured closing workbook:
  * **Today Credit Cash (Left):** Cash received today from all operations.
  * **Card Swipe/GPAY (Left):** Card/UPI collections today.
  * **Expenses (Middle):** Payouts made in cash.
  * **Online Payouts (Middle):** Payouts made online.
  * **Denominations Table (Right):** Count of cash notes in hand (500, 200, 100, 50, 20, 10, 5) with Excel calculations.
  * **Closing Summary (Right):** Formulas calculating: `Today Total Cash = Opening Balance + Credit Cash - Expenses`.

