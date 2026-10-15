# Happy Car Wash GMS — Client Installer Kit

## Overview
This installer kit allows a non-technical user to deploy, run, and update **Happy Car Wash Garage Management System** on a Windows laptop with zero technical configuration.

---

## Prerequisites on Client Laptop
1. **Windows 10 / 11 (64-bit)**
2. **Node.js LTS**:
   - Download and run the Windows Installer (x64) from [nodejs.org](https://nodejs.org).
   - Use standard default options during installation.
3. **Microsoft Visual C++ 2015–2022 Redistributable (x64)** (standard on most Windows PCs):
   - If not already installed, download from [aka.ms/vs/17/release/vc_redist.x64.exe](https://aka.ms/vs/17/release/vc_redist.x64.exe).

---

## Bundled MySQL 8.4 LTS
- **No manual MySQL installation is needed**: MySQL is completely bundled inside `client_kit` (ships with `mysql-8.4.11-winx64.zip` or newer).
- **Why MySQL 8.4 LTS?**: MySQL 8.0 reached **End-Of-Life (EOL) in April 2026**. This kit ships with MySQL 8.4 Long Term Support (LTS), ensuring official security patches, stability, and modern Windows support.
- During installation, the kit extracts MySQL to `C:\HappyCarWash\mysql`, writes a clean `my.ini`, initializes the database, configures the Windows Service `HappyCarWashMySQL` to start automatically on Windows boot, sets a randomized secure root password, creates a dedicated application user (`happy_app`), and imports initial data.

---

## Installation Steps (Client Laptop)
1. Copy the entire `happy` project folder to the client's laptop (e.g., to Desktop or `C:\`).
2. Open the `client_kit` folder.
3. Right-click **`INSTALL.bat`** and select **Run as administrator** (or simply double-click; it will prompt for administrative permission).
4. The installer automatically handles:
   - Verification of Node.js.
   - Extraction and configuration of MySQL 8.4 LTS Windows Service (`HappyCarWashMySQL`).
   - Database creation and initial import from `data/happy_gms_latest.sql` (only if 0 tables exist; existing databases are never overwritten).
   - Creation of dedicated MySQL user `happy_app` with a random password.
   - Generation of `backend\.env` (UTF-8 without BOM) with dedicated user credentials and random `JWT_SECRET`.
   - Creation of a boot startup task in Windows Task Scheduler (`HappyCarWashServer`) that runs at every system startup as SYSTEM, waits for MySQL port 3306 (up to 3 min), starts `node src/server.js`, and restarts automatically if it exits.
   - Configuration of twice-daily automated backups (2:00 PM and 9:30 PM) via Task Scheduler with `StartWhenAvailable` enabled.
   - Creation of the desktop shortcut with custom icon (`happy.ico`) that launches silently without black command windows.

---

## Update Mode (Re-running INSTALL.bat)
When `INSTALL.bat` is re-run on a PC that already has Happy Car Wash installed:
- **Safety Backup**: A safety database backup is taken automatically before updating.
- **Environment Preserved**: Existing `backend\.env` (including credentials and secrets) is untouched.
- **Database Preserved**: The database is never overwritten or dropped.
- **Media Preserved**: The `backend\uploads` folder is preserved and never overwritten.

---

## Daily Operation
- **Automatic Startup**: The backend server starts automatically at boot in the background via Task Scheduler.
- **Desktop Shortcut**: Double-click the **Happy Car Wash GMS** icon on your Desktop.
  - The launcher verifies server health at `http://127.0.0.1:5000/api/health` (waiting up to 90 seconds).
  - Opens your default browser at `http://127.0.0.1:5000`.
  - If the server does not respond within 90s, displays an actionable error message box.
- **Data Persistence**: All records, jobs, customers, and payments are stored in `C:\HappyCarWash\mysql-data` and persist across closing the browser, logging off, and system reboots.
- **Twice-Daily Backups**: Automated backups run twice daily (at 2:00 PM and 9:30 PM), keeping a 30-day history and mirroring `backend\uploads`.
  - Secondary backup: You can place an external drive path or OneDrive folder path in `C:\HappyCarWash\second_backup_path.txt` to automatically duplicate backups to an external drive or cloud folder.
