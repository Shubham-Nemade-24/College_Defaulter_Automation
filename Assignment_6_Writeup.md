# FSDL Assignment 6 Write-up

**Title:** Create an online appointment booking application or an e-commerce portal for used item sales, **or a similar type of application using Node.js and Express**.

**Project Developed:** College Defaulter Automation System (Attendance Notice Generation System)

---

## 1. Objectives
1. To understand the fundamental concepts of backend web development using Node.js and the Express.js framework.
2. To design and implement RESTful APIs that handle client-side requests, process data, and return structured JSON responses.
3. To learn how to process complex file uploads (Excel sheets) on the server side using middleware like `multer` and data-parsing libraries like `xlsx`.
4. To explore automated document generation by programmatically creating styled PDF files (`pdf-lib`) directly from backend data.
5. To implement third-party integrations, specifically integrating a Node.js backend with an SMTP server (`nodemailer`) to automate email dispatching.
6. To seamlessly connect a distinct frontend application (React + Vite) with the Express backend, handling CORS and API proxying.

---

## 2. Software/Hardware Requirements

**Hardware Requirements:**
*   Processor: Intel Core i3 / AMD Ryzen 3 or higher
*   RAM: 4 GB or higher (8 GB recommended for running concurrent dev servers)
*   Storage: 10 GB minimum free disk space

**Software Requirements:**
*   **Operating System:** Windows 10/11, macOS, or Linux
*   **Runtime Environment:** Node.js (v16.x or higher)
*   **Package Manager:** npm (Node Package Manager) or yarn
*   **Backend Framework:** Express.js
*   **Frontend Library/Tooling:** React.js, Vite
*   **Backend Libraries:**
    *   `multer` (for handling multipart/form-data for file uploads)
    *   `xlsx` (for parsing and extracting data from Excel files)
    *   `pdf-lib` (for programmatic PDF generation)
    *   `nodemailer` (for handling SMTP email transmission)
    *   `cors` (to enable Cross-Origin Resource Sharing)
*   **Code Editor:** Visual Studio Code (or any preferred text editor)
*   **Browser:** Google Chrome, Mozilla Firefox, or any modern web browser for testing the UI

---

## 3. Theory

### 3.1 Architecture Overview
The application follows a standard Client-Server architecture utilizing a modular Full-Stack JavaScript environment (MERN stack subset, excluding MongoDB as data is handled via Excel files natively).
*   **Client (Frontend):** Built with React.js and Vite. It provides a dynamic, single-page application (SPA) interface where administrators can upload attendance sheets and view generated notices.
*   **Server (Backend):** Built using Node.js and Express.js. It securely handles the uploaded files, processes the business logic (calculating defaulters), generates PDFs in-memory, and sends emails.

### 3.2 Node.js and Express.js
**Node.js** is an open-source, cross-platform, back-end JavaScript runtime environment that executes JavaScript code outside a web browser. It uses an event-driven, non-blocking I/O model that makes it lightweight and efficient, perfect for data-intensive real-time applications.
**Express.js** is a minimal and flexible Node.js web application framework that provides a robust set of features for web and mobile applications. In this project, Express is used to define routing (`/api/upload`, `/api/notices`, `/api/send-email`) and handle HTTP requests and responses cleanly.

### 3.3 File Uploads and Data Parsing
Handling file uploads in Node.js requires specialized middleware because files are sent as multipart/form-data. The `multer` library intercepts the incoming HTTP POST request, extracts the `.xlsx` file, and temporarily saves it to the disk. 
Once uploaded, the `xlsx` module parses the Excel file. The backend logic dynamically iterates through the complex multi-header structure of the college's attendance format, identifying subjects, calculating Theory and Practical attendance, and filtering students whose overall attendance falls below the 75% threshold.

### 3.4 Automated PDF Generation
Instead of relying on external system binaries (like MS Word or LibreOffice) to convert document templates, the system uses `pdf-lib` to generate PDF notices natively within Node.js. The backend calculates coordinate math to draw college headers, construct dynamic attendance tables, and wrap warning paragraphs, saving the resulting binary stream directly as a `.pdf` file.

### 3.5 Automated Email Dispatching
The system uses the `nodemailer` module to connect to standard SMTP servers (like Gmail's SMTP). It securely reads credentials from environment variables (`.env`), drafts an HTML-formatted email, attaches the correct PDF notice from the local filesystem, and dispatches the email to the specific parent/student email address provided.

---

## 4. Conclusion
In conclusion, a full-stack "Attendance Notice Generation System" was successfully developed using Node.js and Express.js. The project successfully demonstrated how to handle complex server-side logic, including multipart file uploads, Excel parsing, dynamic PDF document generation from scratch, and automated email processing using SMTP. 

By separating the frontend (React) and the backend (Express API), the project embodies modern software architecture principles, providing a highly automated, efficient answer to solving a repetitive administrative college task. This fulfills the objective of creating a robust web application similar in complexity and foundational structure to an online booking or e-commerce platform.
