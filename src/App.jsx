import { useState, useRef, useCallback } from 'react';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [notices, setNotices] = useState([]);
  const [resultInfo, setResultInfo] = useState(null);
  const [emailModal, setEmailModal] = useState(null); // { filename, studentName }
  const [emailInput, setEmailInput] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // ---- Toast helper ----
  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // ---- Fetch notices list ----
  const fetchNotices = useCallback(async () => {
    try {
      const res = await fetch('/api/notices');
      const data = await res.json();
      setNotices(data.files || []);
    } catch {
      // silent — notices section just won't show
    }
  }, []);

  // ---- File selection ----
  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      const ext = selected.name.split('.').pop().toLowerCase();
      if (ext !== 'xlsx' && ext !== 'xls') {
        addToast('Please select an .xlsx or .xls file', 'error');
        return;
      }
      setFile(selected);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      const ext = dropped.name.split('.').pop().toLowerCase();
      if (ext !== 'xlsx' && ext !== 'xls') {
        addToast('Please select an .xlsx or .xls file', 'error');
        return;
      }
      setFile(dropped);
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ---- Upload ----
  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResultInfo(null);
    setNotices([]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || 'Upload failed', 'error');
        setUploading(false);
        return;
      }

      setResultInfo({
        totalStudents: data.totalStudents,
        defaulterCount: data.defaulters?.length || 0,
        generatedCount: data.generatedFiles?.length || 0,
        message: data.message,
      });

      if (data.generatedFiles?.length > 0) {
        await fetchNotices();
        addToast(`${data.generatedFiles.length} notice(s) generated successfully`);
      } else {
        addToast(data.message || 'No defaulters found');
      }

      removeFile();
    } catch (err) {
      addToast('Failed to connect to the server', 'error');
    } finally {
      setUploading(false);
    }
  };

  // ---- Download ----
  const handleDownload = (filename) => {
    const link = document.createElement('a');
    link.href = `/api/notices/${encodeURIComponent(filename)}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ---- Email ----
  const openEmailModal = (filename, studentName) => {
    setEmailModal({ filename, studentName });
    setEmailInput('');
  };

  const closeEmailModal = () => {
    setEmailModal(null);
    setEmailInput('');
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!emailInput || !emailModal) return;
    setSendingEmail(true);

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: emailModal.filename,
          email: emailInput,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || 'Failed to send email', 'error');
      } else {
        addToast(data.message || 'Email sent successfully');
        closeEmailModal();
      }
    } catch {
      addToast('Failed to connect to the server', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h1>Attendance Notice System</h1>
        <p>Upload attendance data to generate and distribute notices</p>
      </header>

      {/* Upload Section */}
      <section className="upload-section">
        <h2>Upload Attendance File</h2>
        <div
          className={`drop-zone${dragOver ? ' drag-over' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <p className="drop-zone-text">
            Click to select or drag and drop your file here
          </p>
          <p className="drop-zone-hint">Accepts .xlsx and .xls files only</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
          />
        </div>

        {file && (
          <div className="selected-file">
            <span className="selected-file-name">{file.name}</span>
            <button className="selected-file-remove" onClick={removeFile}>
              Remove
            </button>
          </div>
        )}

        <div className="upload-actions">
          <button
            className="btn-primary"
            onClick={handleUpload}
            disabled={!file || uploading}
          >
            {uploading && <span className="spinner spinner-white" />}
            {uploading ? 'Processing...' : 'Upload and Generate Notices'}
          </button>
        </div>

        {uploading && (
          <div className="processing-status" style={{ marginTop: 'var(--space-3)' }}>
            <span className="spinner" />
            <span>Parsing data and generating PDF notices...</span>
          </div>
        )}
      </section>

      {/* Results Section */}
      {resultInfo && (
        <section className="results-section">
          <h2>Results</h2>
          <p className="results-summary">
            {resultInfo.totalStudents} student(s) processed
            &mdash; {resultInfo.defaulterCount} below 75% attendance
            &mdash; {resultInfo.generatedCount} notice(s) generated
          </p>
        </section>
      )}

      {/* Notice List */}
      {notices.length > 0 && (
        <section className="results-section">
          <h2>Generated Notices</h2>
          <div className="notice-list">
            {notices.map((notice) => (
              <div className="notice-row" key={notice.filename}>
                <span className="notice-name">{notice.studentName}</span>
                <div className="notice-actions">
                  <button
                    className="btn-outline"
                    onClick={() => handleDownload(notice.filename)}
                  >
                    Download
                  </button>
                  <button
                    className="btn-send"
                    onClick={() => openEmailModal(notice.filename, notice.studentName)}
                  >
                    Send Mail
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Email Modal */}
      {emailModal && (
        <div className="modal-overlay" onClick={closeEmailModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Send Notice via Email</h3>
            <p className="modal-subtitle">
              Sending notice for {emailModal.studentName}
            </p>
            <form onSubmit={handleSendEmail}>
              <div className="modal-field">
                <label htmlFor="email-input">Recipient Email</label>
                <input
                  id="email-input"
                  type="email"
                  placeholder="recipient@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={closeEmailModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={sendingEmail || !emailInput}
                >
                  {sendingEmail && <span className="spinner spinner-white" />}
                  {sendingEmail ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.type}`}>
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
