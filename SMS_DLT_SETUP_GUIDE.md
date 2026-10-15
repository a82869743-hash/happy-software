# ðŸ’¬ Happy Car Wash GMS â€” SMS & DLT Setup Guide

To send transactional SMS alerts to customers in India, regulatory laws enforced by TRAI require **DLT (Distributed Ledger Technology)** registration. 

This guide details the step-by-step procedure to activate SMS notifications in the HAPPY CAR WASH GMS software once DLT registration is completed.

---

## ðŸ“‹ Table of Contents
1. [DLT Portal Registration Summary](#1-dlt-portal-registration-summary)
2. [Step-by-Step Manual Configuration Guide (After DLT Registration)](#2-step-by-step-manual-configuration-guide-after-dlt-registration)
3. [Mapping Template IDs in HAPPY CAR WASH GMS](#3-mapping-template-ids-in-happy-car-wash)
4. [DLT SMS Message Templates Registry](#4-dlt-sms-message-templates-registry)
5. [Testing the Integration](#5-testing-the-integration)

---

## 1. DLT Portal Registration Summary

Before starting configuration in MSG91 or HAPPY CAR WASH GMS, ensure you have:
1. **Entity ID**: A unique 14-digit registration number for your business from your DLT portal (e.g., Vilpower, Vodafone Idea, Jio, BSNL).
2. **Sender ID (Header)**: The approved 6-character alphabetic header matching your brand, e.g., **`HAPPY`**.
3. **Approved Content Templates**: Approved templates (Service Implicit category) with variables represented as `{#var#}`. Note the **19-digit DLT Template ID** for each.

---

## 2. Step-by-Step Manual Configuration Guide (After DLT Registration)

Follow these instructions to link DLT, MSG91, and HAPPY CAR WASH GMS together:

### Step A: Configure DLT details in MSG91
1. Log in to your **MSG91 Dashboard** (https://msg91.com).
2. Go to **SMS âž” Sender ID / Headers** and verify that your approved DLT Header (e.g., `HAPPY`) is added and active.
3. Go to **DLT Registration** and add your **DLT Entity ID** so MSG91 can attach it to outbound messages.

### Step B: Create Flows in MSG91
MSG91 sends messages via **Flows** linked to your approved DLT templates:
1. Go to **Flows** in the MSG91 dashboard and click **Create Flow**.
2. Select your approved DLT template from the list.
3. Give the flow a recognizable name (e.g. `HAPPY Job Opened`, `HAPPY WIP status`, etc.).
4. Flow variable configuration:
   - Identify placeholders in your DLT message body (e.g. `Dear {#var#}...`).
   - Map placeholders to MSG91 flow variables (e.g. `VAR1`, `VAR2`, `VAR3`, or semantic names like `name`, `reg_no`, `url`).
   - *Note: HAPPY CAR WASH GMS passes both semantic and indexed variables to the MSG91 API simultaneously, so any variable naming convention you choose in MSG91 will work automatically.*
5. Save the Flow. Copy the generated **Flow Template ID** (a unique alpha-numeric string, e.g., `60f...`).

---

## 3. Mapping Template IDs in HAPPY CAR WASH GMS

Now, link the MSG91 Flows to your HAPPY CAR WASH GMS admin panel:

1. Log in to the **HAPPY CAR WASH GMS Admin Panel**.
2. Go to **System âž” SMS Settings** in the left sidebar.
3. Under **MSG91 Credentials**, input:
   - **AUTH KEY**: Retrieve from MSG91 Dashboard âž” API Keys.
   - **SENDER ID**: Input your approved DLT header (e.g., `HAPPY`).
   - **DLT ENTITY ID**: Input your 14-digit DLT Entity ID.
4. Under **DLT Template IDs**, input the corresponding **Flow Template ID** copied from MSG91 for each active event:
   - **Job Card Opened**
   - **Invoice SMS**
   - **Status: Estimation**
   - **Status: Work in Progress (WIP)**
   - **Status: Ready for Delivery**
   - **Status: Delivered**
   - **Status: Invoiced**
   - **Status: Cancelled**
5. Under **Message Templates**, copy the exact approved DLT template text from your DLT portal and paste it into the corresponding event's template text block.
6. Under **Global Controls**, toggle **Enable SMS Notifications** (and any specific event toggles) to **ON**.
7. Click **Save All Settings**.

---

## 4. DLT SMS Message Templates Registry

Below are the default message formats registered in HAPPY CAR WASH GMS. Your DLT registered templates **MUST match these word-for-word**, including whitespace, punctuation, and placeholder indices.

### ðŸš— A. Job Card Opened Template
* **Trigger**: Normal Job Card creation (POST `/api/job-cards`) & Quick Job Card creation (POST `/api/quick-job-cards`)
* **DLT Key**: `sms_template_job_opened`
* **Format**:
  ```
  Dear {#var#}, your vehicle {#var#} has been received at Happy Car Wash. Track your service live: {#var#} - HAPPY
  ```
* **Variables**: `{#var#}` âž” `Customer Name`, `{#var#}` âž” `Reg No`, `{#var#}` âž” `Live Tracking Link`

### ðŸ§¾ B. Invoice Dispatch Template
* **Trigger**: Manual trigger by Admin after generating invoice (GST or Non-GST) in Job Card Detail page.
* **DLT Key**: `sms_template_invoice`
* **Format**:
  ```
  Dear {#var#}, your invoice {#var#} for vehicle {#var#} totalling Rs.{#var#} is ready. Thank you - Happy Car Wash, Vadodara. - HAPPY
  ```
* **Variables**: `{#var#}` âž” `Customer Name`, `{#var#}` âž” `Invoice No`, `{#var#}` âž” `Reg No`, `{#var#}` âž” `Total Amount`

### âš™ï¸ C. Pipeline Status Notifications Templates

#### 1. Estimation Prepared
* **DLT Key**: `sms_template_status_estimation`
* **Format**:
  ```
  Dear {#var#}, estimation for your vehicle {#var#} is being prepared. We will update you soon. - HAPPY
  ```
* **Variables**: `{#var#}` âž” `Customer Name`, `{#var#}` âž” `Reg No`

#### 2. WIP (Work in Progress)
* **DLT Key**: `sms_template_status_wip`
* **Format**:
  ```
  Dear {#var#}, your vehicle {#var#} is now under service at Happy Car Wash. - HAPPY
  ```
* **Variables**: `{#var#}` âž” `Customer Name`, `{#var#}` âž” `Reg No`

#### 3. Ready for Pickup
* **DLT Key**: `sms_template_status_ready`
* **Format**:
  ```
  Dear {#var#}, great news! Your vehicle {#var#} is ready for pickup at Happy Car Wash, Vadodara. - HAPPY
  ```
* **Variables**: `{#var#}` âž” `Customer Name`, `{#var#}` âž” `Reg No`

#### 4. Delivered
* **DLT Key**: `sms_template_status_delivered`
* **Format**:
  ```
  Dear {#var#}, your vehicle {#var#} has been delivered. Thank you for choosing Happy Car Wash! - HAPPY
  ```
* **Variables**: `{#var#}` âž” `Customer Name`, `{#var#}` âž” `Reg No`

#### 5. Invoiced
* **DLT Key**: `sms_template_status_invoiced`
* **Format**:
  ```
  Dear {#var#}, your invoice has been generated for vehicle {#var#}. Thank you for your business! - HAPPY
  ```
* **Variables**: `{#var#}` âž” `Customer Name`, `{#var#}` âž” `Reg No`

#### 6. Cancelled
* **DLT Key**: `sms_template_status_cancelled`
* **Format**:
  ```
  Dear {#var#}, the service request for your vehicle {#var#} has been cancelled. Please contact us for details. - HAPPY
  ```
* **Variables**: `{#var#}` âž” `Customer Name`, `{#var#}` âž” `Reg No`

---

## 5. Testing the Integration

To verify that credentials and routing setups are active:
1. Navigate to **SMS Settings** in GMS.
2. Enter your mobile number in the **Test SMS Configuration** input box and click **Send Test SMS**.
3. GMS will bypass the global `Enable SMS` toggle constraint and attempt to dispatch a test alert through the MSG91 Flow.
4. If the configuration is correct, the test flow will execute and you will receive a test message instantly on your mobile device.

