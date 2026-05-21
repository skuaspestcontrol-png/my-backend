import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileText, X } from 'lucide-react';

const shell = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.45)',
    zIndex: 6500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '14px'
  },
  modal: {
    width: 'min(1120px, 100%)',
    maxHeight: '90vh',
    overflow: 'hidden',
    background: '#fff',
    borderRadius: '14px',
    border: '1px solid rgba(159, 23, 77, 0.2)',
    boxShadow: '0 22px 54px rgba(15,23,42,0.2)',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    padding: '10px 14px',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    flexWrap: 'wrap'
  },
  title: {
    margin: 0,
    fontSize: '17px',
    fontWeight: 600,
    color: '#0f172a',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    lineHeight: 1.15
  },
  closeButton: {
    border: '1px solid #D1D5DB',
    background: '#fff',
    color: '#475569',
    borderRadius: '8px',
    minWidth: '26px',
    height: '26px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  body: {
    padding: '9px 12px 12px',
    display: 'grid',
    gap: '5px',
    overflowY: 'auto'
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '5px'
  },
  actionButton: {
    minHeight: '32px',
    borderRadius: '9px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#334155',
    padding: '0 9px',
    fontWeight: 600,
    fontSize: '12px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: 'pointer'
  },
  actionButtonDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed'
  },
  frameShell: {
    border: '1px solid #D1D5DB',
    borderRadius: '10px',
    background: '#fff',
    overflow: 'hidden',
    minHeight: 0
  },
  frame: {
    width: '100%',
    height: '66vh',
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
  return text.replace(/[^\w.-]+/g, '_') || 'document.pdf';
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
  publicShareUrl
}) {
  const [screenWidth, setScreenWidth] = useState(() => window.innerWidth);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sourceUrl = useMemo(() => String(pdfUrl || '').trim(), [pdfUrl]);
  const resolvedShareUrl = useMemo(() => String(publicShareUrl || sourceUrl || '').trim(), [publicShareUrl, sourceUrl]);
  const canShareEmail = typeof onShareEmail === 'function';
  const hasWhatsAppAction = typeof onShareWhatsApp === 'function' || Boolean(resolvedShareUrl);
  const iframeSrc = previewUrl;

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
      const response = await fetch(sourceUrl, { credentials: 'include' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('application/pdf')) {
        throw new Error(`Unexpected content type: ${contentType || 'unknown'}`);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
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
    if (typeof onShareWhatsApp === 'function') {
      try {
        await onShareWhatsApp();
      } catch (shareError) {
        console.error('PDF WhatsApp share failed', shareError);
      }
      return;
    }
    if (!resolvedShareUrl) return;
    const shareText = `${String(title || 'PDF').trim()}\n${resolvedShareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
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
          <h3 style={shell.title}><FileText size={16} /> {title || 'PDF Preview'}</h3>
          <button type="button" onClick={handleClose} style={shell.closeButton} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div style={shell.body}>
          {error ? <div style={shell.status}>{error}</div> : null}
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

          <div style={{
            ...shell.frameShell,
            height: screenWidth < 640 ? '58vh' : '66vh'
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
