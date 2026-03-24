# Attendance Notice Generation System

This project is a full-stack web application designed to automate the process of generating and emailing attendance notices for students with low attendance (< 75%). It takes an Excel report as input, parses the complex PCCOE-format attendance sheets, generates professional PDF notices, and emails them directly to recipients.

## Tech Stack
-   **Frontend:** React, Vite, CSS (built from scratch, no UI libraries)
-   **Backend:** Node.js, Express.js
-   **File Processing:** `multer` (file uploads), `xlsx` (Excel parsing)
-   **PDF Generation:** `pdf-lib` (direct PDF creation)
-   **Emailing:** `nodemailer` (SMTP integration)

---

## How It Works: The Flow

1.  **Frontend Upload:** The user drags and drops the `Attendance_Report_37.xlsx` file into the React UI and clicks upload.
2.  **API Request:** A `FormData` object containing the file is sent via `POST /api/upload` to the Express backend.
3.  **File Parsing:** The backend uses `xlsx` to parse the highly specific Excel structure.
4.  **Attendance Validation:** It calculates and checks the overall attendance percentage. If a student is marked below 75%, they are added to a "defaulters" list.
5.  **PDF Generation:** For every defaulter, a customized PDF is drawn directly using `pdf-lib`, matching the official college format.
6.  **Response:** The backend returns a JSON payload detailing the processed students, the defaulters, and the filenames of the generated PDFs.
7.  **Frontend Display:** The React UI dynamically renders the list of defaulters, providing "Download" and "Send Mail" buttons for each notice.
8.  **Email Sending:** Clicking "Send Mail" opens a modal. The user enters an email address, which triggers `POST /api/send-email`. The server attaches the PDF and sends it via Nodemailer.

---

## Deep Dive: Backend Implementation Logic

### 1. Excel Parsing Logic (`routes/upload.js`)
The `xlsx` library is used to read the uploaded file. The hardest part of this project is dealing with the complex, multi-header structure of the provided PCCOE Excel sheet.

**Structuring the Data:**
-   **Metadata extraction:** Rows 3, 4, and 5 hold the Department, Academic Year, Semester, Class/Division, and Date Range. The script manually extracts these strings.
-   **Header detection:** Row 6 contains the actual column headers. The script scans this row to find where the subjects are defined.
-   **Subject grouping:** In the Excel sheet, every subject takes up exactly 3 columns (e.g., column 3 is the subject name/type, column 4 is blank, column 5 is the percentage). The script iterates through the header row in steps of three (`c += 3`) to map out all the "Theory (TH)" and "Practical (PR)" subjects dynamically.
-   **Overall Attendance:** The script searches the end of Row 6 to find the exact column indices for `Overall TH Att.`, `Overall PR Att.`, and `Overall Att.`.
-   **Defaulter filtering:** It parses the `Overall Att.` cell as a float. If the number is `< 75`, the student is flagged as a defaulter.

### 2. Direct PDF Generation (`routes/upload.js`)
Initially, the plan was to use a Word template (`Format.docx`) and convert it to a PDF using LibreOffice. However, depending on external system binaries (like `soffice`) makes a Node app brittle and hard to deploy.

Instead, the system uses **`pdf-lib`** to draw the PDF completely from scratch using pure JavaScript.

**The Drawing Logic (`generateNoticePdf` function):**
-   It creates a blank A4 page (`[595.28, 841.89]`).
-   It embeds standard Times Roman fonts.
-   It uses X/Y coordinates to manually draw the college header, date, salutation, and student details.
-   **Dynamic Table Rendering:** It calculates column widths and draws a precise grid layout for the `Subject | Theory % | Practical %` table, mapping the student's scraped subject data directly into the rows.
-   It wraps long warning text paragraphs algorithmically using the font's measured text width.
-   Finally, it saves the generated binary and writes it to the `generated_notices/` folder.

### 3. Email Module (`routes/email.js`)
Emailing is handled cleanly using `nodemailer`.

-   The route expects a JSON body: `{ filename, email }`.
-   It reads the sender configuration from the `.env` file (`EMAIL_USER` and `EMAIL_PASS`).
-   It verifies that the requested `filename` actually exists in the `generated_notices` folder to prevent directory traversal attacks.
-   It configures a Gmail SMTP transporter.
-   It attaches the PDF file as an email attachment and sends a professionally formatted HTML email body to the recipient.

---

## Setup & Running the Project

### Prerequisites
- Node.js (v18+)
- A Gmail account with 2-Step Verification enabled and an App Password generated.

### Installation
1.  Navigate into the main folder: `cd College_Automation`
2.  Install frontend dependencies: `npm install`
3.  Navigate into the server folder: `cd server`
4.  Install backend dependencies: `npm install`

### Environment Variables
1. Create a `.env` file inside the `server/` directory:
```env
EMAIL_USER=your.actual.email@gmail.com
EMAIL_PASS=your16charAppPassword
```

### Running the Servers
You need two terminal windows running concurrently.

**Terminal 1 (Backend):**
```bash
cd College_Automation/server
npm run dev
```
*(Runs on http://localhost:5001)*

**Terminal 2 (Frontend):**
```bash
cd College_Automation
npm run dev
```
*(Runs on http://localhost:5173)*

Open `http://localhost:5173` in your browser to use the app.
