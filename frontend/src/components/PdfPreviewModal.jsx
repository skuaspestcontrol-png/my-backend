import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileText, X } from 'lucide-react';

const shell = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.50)',
    backdropFilter: 'blur(16px)',
    zIndex: 6500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '18px'
  },
  modal: {
    width: 'min(86vw, 1720px)',
    height: 'min(88vh, 960px)',
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.64)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    borderRadius: '18px',
    border: '1px solid rgba(255,255,255,0.30)',
    boxShadow: '0 28px 70px rgba(15,23,42,0.22)',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    minHeight: '60px',
    padding: '14px 18px',
    borderBottom: '1px solid transparent',
    background: 'linear-gradient(135deg, var(--color-primary-deep), var(--color-primary))',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 800,
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    lineHeight: 1.15
  },
  policyNote: {
    margin: '4px 0 0 0',
    padding: '6px 10px',
    borderRadius: '999px',
    background: 'rgba(252,231,243,0.16)',
    color: '#ffffff',
    border: '1px solid rgba(236,72,153,0.55)',
    fontSize: '12px',
    fontWeight: 600,
    lineHeight: 1.35,
    maxWidth: '100%',
    display: 'inline-block',
    boxShadow: '0 0 0 1px rgba(255,255,255,0.08) inset'
  },
  closeButton: {
    border: 'none',
    background: 'rgba(255,255,255,0.10)',
    color: '#fff',
    borderRadius: '10px',
    minWidth: '38px',
    width: '38px',
    height: '38px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  body: {
    padding: '14px 16px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflow: 'hidden',
    minHeight: 0,
    flex: 1
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    padding: '0',
    alignItems: 'center',
    position: 'relative',
    zIndex: 2
  },
  actionButton: {
    minHeight: '36px',
    height: '36px',
    borderRadius: '999px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#374151',
    padding: '0 16px',
    fontWeight: 700,
    fontSize: '13px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: 'pointer',
    width: 'auto',
    minWidth: 'max-content'
  },
  actionButtonDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed'
  },
  frameShell: {
    position: 'relative',
    zIndex: 1,
    border: '1px solid rgba(15,23,42,0.08)',
    borderRadius: '16px',
    background: '#fff',
    overflow: 'hidden',
    minHeight: 0,
    flex: 1
  },
  frame: {
    width: '100%',
    height: '100%',
    border: 'none',
    background: '#fff'
  },
  status: {
    border: '1px solid rgba(159, 23, 77, 0.18)',
    background: 'rgba(252,231,243,0.55)',
    color: 'var(--color-primary-dark)',
    borderRadius: '10px',
    padding: '10px 12px',
    fontSize: '13px',
    fontWeight: 700
  }
};

const normalizeFileName = (value) => {
  const text = String(value || 'document.pdf').trim();
  return text.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim() || 'document.pdf';
};

const downloadBlob = (blobUrl, fileName) => {
  if (!blobUrl) return;
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = normalizeFileName(fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function PdfPreviewModal({
  open,
  title,
  pdfUrl,
  downloadFileName,
  onClose,
  onShareEmail,
  onShareWhatsApp,
  publicShareUrl,
  policyNote,
  diagnostic = null,
  settingsData = null
}) {
  const [screenWidth, setScreenWidth] = useState(() => window.innerWidth);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRawSettings, setShowRawSettings] = useState(false);

  const sourceUrl = useMemo(() => String(pdfUrl || '').trim(), [pdfUrl]);
  const canShareEmail = typeof onShareEmail === 'function';
  const hasWhatsAppAction = typeof onShareWhatsApp === 'function';
  const iframeSrc = previewUrl;
  const redactedSettingsData = useMemo(() => {
    if (!settingsData || typeof settingsData !== 'object') return null;

    const redact = (value) => {
      if (Array.isArray(value)) return value.map(redact);
      if (!value || typeof value !== 'object') return value;

      return Object.entries(value).reduce((acc, [key, entry]) => {
        if (/^(access[_-]?token|token|secret|password|api[_-]?key)$/i.test(key)) {
          acc[key] = String(entry || '').trim() ? '[redacted]' : entry;
          return acc;
        }
        acc[key] = redact(entry);
        return acc;
      }, {});
    };

    return redact(settingsData);
  }, [settingsData]);

  useEffect(() => {
    const onResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!open) {
      setPreviewUrl('');
      setLoading(false);
      setError('');
      setShowRawSettings(false);
      return undefined;
    }

    if (!sourceUrl) {
      setPreviewUrl('');
      setLoading(false);
      setError('Could not load PDF preview. Please try Download PDF.');
      return undefined;
    }

    let active = true;
    let objectUrl = '';

    const loadPreview = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await fetch(sourceUrl, { credentials: 'include' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (!contentType.includes('application/pdf')) {
          throw new Error(`Unexpected content type: ${contentType || 'unknown'}`);
        }
        const blob = await response.blob();
        if (!blob || blob.size === 0) throw new Error('Empty PDF');
        objectUrl = URL.createObjectURL(blob);
        if (active) setPreviewUrl(objectUrl);
      } catch (loadError) {
        if (active) {
          console.warn('PDF preview blob load failed.', loadError);
          setPreviewUrl('');
          setError('Could not load PDF preview. Please try Download PDF.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPreview();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, sourceUrl]);

  if (!open) return null;

  const handleClose = () => {
    if (typeof onClose === 'function') onClose();
  };

  const handleDownload = async () => {
    if (!sourceUrl) return;
    if (previewUrl) {
      downloadBlob(previewUrl, downloadFileName || title || 'document.pdf');
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(sourceUrl, { credentials: 'include' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('application/pdf')) {
        throw new Error(`Unexpected content type: ${contentType || 'unknown'}`);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      downloadBlob(blobUrl, downloadFileName || title || 'document.pdf');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
    } catch {
      setError('Could not load PDF preview. Please try Download PDF.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNewTab = () => {
    const openBlobTab = async () => {
      if (previewUrl) {
        window.open(previewUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      if (!sourceUrl) return;
      window.open(sourceUrl, '_blank', 'noopener,noreferrer');
    };
    openBlobTab().catch(() => setError('Could not load PDF preview. Please try Download PDF.'));
  };

  const handleShareEmail = async () => {
    if (!canShareEmail) return;
    try {
      await onShareEmail();
    } catch (shareError) {
      console.error('PDF email share failed', shareError);
    }
  };

  const handleShareWhatsApp = async () => {
    if (typeof onShareWhatsApp !== 'function') return;
    try {
      await onShareWhatsApp();
    } catch (shareError) {
      console.error('PDF WhatsApp share failed', shareError);
    }
  };

  const actionButtonStyle = (active = true) => ({
    ...shell.actionButton,
    ...(active ? {} : shell.actionButtonDisabled),
    width: screenWidth < 640 ? 'calc(50% - 2.5px)' : 'auto',
    flex: screenWidth < 640 ? '1 1 calc(50% - 2.5px)' : '0 0 auto'
  });

  return createPortal(
    <div style={shell.overlay} onClick={handleClose}>
      <div
        style={shell.modal}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'PDF preview'}
      >
        <div style={shell.header}>
          <div style={{ minWidth: 0 }}>
            <h3 style={shell.title}><FileText size={16} /> {title || 'PDF Preview'}</h3>
            {policyNote ? <p style={shell.policyNote}>{policyNote}</p> : null}
          </div>
          <button type="button" onClick={handleClose} style={shell.closeButton} aria-label="Close">
            <X size={22} />
          </button>
        </div>
        <div style={shell.body}>
          <div style={{ ...shell.actions, flexDirection: 'row' }}>
            <button type="button" style={actionButtonStyle(Boolean(sourceUrl))} onClick={handleDownload} disabled={!sourceUrl}>
              <Download size={14} /> Download PDF
            </button>
            <button type="button" style={actionButtonStyle(Boolean(sourceUrl))} onClick={handleOpenNewTab} disabled={!sourceUrl}>
              Open in New Tab
            </button>
            <button
              type="button"
              style={actionButtonStyle(canShareEmail)}
              onClick={handleShareEmail}
              disabled={!canShareEmail}
            >
              {canShareEmail ? 'Share Email' : 'Coming soon'}
            </button>
            <button
              type="button"
              style={actionButtonStyle(hasWhatsAppAction)}
              onClick={handleShareWhatsApp}
              disabled={!hasWhatsAppAction}
            >
              {hasWhatsAppAction ? 'Share WhatsApp' : 'Coming soon'}
            </button>
            <button type="button" style={actionButtonStyle(true)} onClick={handleClose}>
              Close
            </button>
          </div>
          {diagnostic?.text || redactedSettingsData ? (
            <div style={{
              border: `1px solid ${diagnostic?.tone === 'success' ? 'rgba(22,163,74,0.18)' : diagnostic?.tone === 'danger' ? 'rgba(220,38,38,0.22)' : 'rgba(245,158,11,0.22)'}`,
              background: diagnostic?.tone === 'success' ? 'rgba(240,253,244,0.95)' : diagnostic?.tone === 'danger' ? 'rgba(254,242,242,0.96)' : 'rgba(255,251,235,0.96)',
              color: diagnostic?.tone === 'success' ? '#166534' : diagnostic?.tone === 'danger' ? '#b91c1c' : '#92400e',
              borderRadius: '12px',
              padding: '10px 12px',
              fontSize: '12px',
              fontWeight: 700,
              lineHeight: 1.45,
              display: 'grid',
              gap: '8px'
            }}>
              {diagnostic?.text ? <div>{diagnostic.text}</div> : null}
              {redactedSettingsData ? (
                <div style={{ display: 'grid', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowRawSettings((prev) => !prev)}
                    style={{
                      justifySelf: 'start',
                      minHeight: '30px',
                      borderRadius: '999px',
                      border: '1px solid rgba(15,23,42,0.10)',
                      background: 'rgba(255,255,255,0.72)',
                      color: '#0f172a',
                      padding: '0 10px',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {showRawSettings ? 'Hide raw settings JSON' : 'Show raw settings JSON'}
                  </button>
                  {showRawSettings ? (
                    <pre style={{
                      margin: 0,
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'rgba(15,23,42,0.08)',
                      color: '#0f172a',
                      fontSize: '11px',
                      lineHeight: 1.5,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: '260px'
                    }}>
                      {JSON.stringify(redactedSettingsData, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {error ? <div style={shell.status}>{error}</div> : null}

          <div style={{
            ...shell.frameShell,
            height: screenWidth < 640 ? '58vh' : '100%'
          }}>
            {loading ? (
              <div style={{ ...shell.status, margin: '12px' }}>Loading PDF preview...</div>
            ) : null}
            {!loading && iframeSrc && !error ? (
              <iframe
                title={title || 'PDF Preview'}
                src={iframeSrc}
                style={{
                  ...shell.frame,
                  height: '100%'
                }}
              />
            ) : null}
            {!loading && error ? (
              <div style={{ ...shell.status, margin: '12px' }}>{error}</div>
            ) : null}
            {!loading && !error && !iframeSrc ? (
              <div style={{ ...shell.status, margin: '12px' }}>Could not load PDF preview. Please try Download PDF.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
