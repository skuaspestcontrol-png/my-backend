import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';
import { isValidIndianMobileNumber, normalizeIndianMobileNumber } from '../../utils/phone';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function WhatsAppPreviewModal({
  open,
  onClose,
  previewData,
  recipientName,
  recipientPhone,
  recipientType,
  moduleType,
  sentByUser,
  onSent,
  onSend,
  sendButtonLabel = 'Send WhatsApp',
  showAttachmentFields = true,
  attachmentNote = '',
  allowRecipientEdit = false,
  diagnostic = null,
  settingsData = null
}) {
  const [message, setMessage] = useState('');
  const [phoneValue, setPhoneValue] = useState(String(recipientPhone || ''));
  const [attachment, setAttachment] = useState(null);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [showRawSettings, setShowRawSettings] = useState(false);
  const copyStatusTimerRef = React.useRef(null);

  const initialMessage = useMemo(() => String(previewData?.previewMessage || ''), [previewData]);
  const allowManualUpload = String(previewData?.attachmentOption || '').toLowerCase() === 'manual upload';
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
  const diagnosticRows = useMemo(() => {
    if (!diagnostic || typeof diagnostic !== 'object') return [];
    return [
      { label: 'API Base URL', ok: Boolean(diagnostic.baseUrlPresent), value: diagnostic.baseUrlPresent ? 'Configured' : 'Missing' },
      { label: 'Instance ID', ok: Boolean(diagnostic.instanceIdPresent), value: diagnostic.instanceIdPresent ? 'Configured' : 'Missing' },
      { label: 'Access Token', ok: Boolean(diagnostic.accessTokenPresent), value: diagnostic.accessTokenPresent ? 'Configured' : 'Missing' },
      { label: 'Provider Type', ok: Boolean(diagnostic.providerType), value: diagnostic.providerType || 'Unknown' },
      { label: 'Active', ok: Boolean(diagnostic.active), value: diagnostic.active ? 'Enabled' : 'Disabled' }
    ];
  }, [diagnostic]);

  const diagnosticText = useMemo(() => {
    if (!diagnosticRows.length) return '';
    return [
      diagnostic?.text || 'WhatsApp diagnostic',
      ...diagnosticRows.map((row) => `${row.label}: ${row.value}`)
    ].join('\n');
  }, [diagnostic?.text, diagnosticRows]);

  React.useEffect(() => {
    if (!open) return;
    setMessage(initialMessage);
    setPhoneValue(String(recipientPhone || '').trim());
    setAttachment(null);
    setAttachmentUrl(String(previewData?.suggestedAttachmentUrl || previewData?.attachmentUrl || ''));
    setError('');
    setCopyStatus('');
    setShowRawSettings(false);
    if (copyStatusTimerRef.current) {
      window.clearTimeout(copyStatusTimerRef.current);
      copyStatusTimerRef.current = null;
    }
  }, [open, initialMessage, previewData, recipientPhone]);

  if (!open) return null;

  const handleSend = async () => {
    try {
      setBusy(true);
      setError('');
      const normalizedPhone = normalizeIndianMobileNumber(phoneValue);
      if (!isValidIndianMobileNumber(phoneValue)) {
        throw new Error('Please enter a valid Indian mobile number.');
      }
      const payload = {
        moduleType,
        templateType: previewData?.template?.templateType,
        templateId: previewData?.template?.id,
        recipientName,
        recipientPhone: String(phoneValue || '').trim(),
        normalizedRecipientPhone: normalizedPhone,
        recipientType,
        sentByUser,
        moduleName: moduleType,
        message,
        attachmentUrl,
        contextData: previewData?.contextData || {}
      };

      if (typeof onSend === 'function') {
        await onSend({
          ...payload,
          attachment,
          attachmentUrl,
          message
        });
        if (typeof onSent === 'function') onSent();
        onClose();
        return;
      }

      if (attachment) {
        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (key === 'contextData') {
            formData.append('contextData', JSON.stringify(value || {}));
          } else {
            formData.append(key, value ?? '');
          }
        });
        formData.append('attachment', attachment);
        await axios.post(`${API_BASE_URL}/api/whatsapp/send-with-attachment`, formData);
      } else {
        await axios.post(`${API_BASE_URL}/api/whatsapp/send`, payload);
      }

      if (typeof onSent === 'function') onSent();
      onClose();
    } catch (sendError) {
      setError(sendError?.response?.data?.error || 'Failed to send WhatsApp message.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyDiagnostics = async () => {
    if (!diagnosticText) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(diagnosticText);
      } else {
        const fallbackTextarea = document.createElement('textarea');
        fallbackTextarea.value = diagnosticText;
        fallbackTextarea.setAttribute('readonly', 'true');
        fallbackTextarea.style.position = 'absolute';
        fallbackTextarea.style.left = '-9999px';
        document.body.appendChild(fallbackTextarea);
        fallbackTextarea.select();
        document.execCommand('copy');
        document.body.removeChild(fallbackTextarea);
      }
      setCopyStatus('Copied');
      if (copyStatusTimerRef.current) window.clearTimeout(copyStatusTimerRef.current);
      copyStatusTimerRef.current = window.setTimeout(() => {
        setCopyStatus('');
        copyStatusTimerRef.current = null;
      }, 1800);
    } catch (_error) {
      setError('Could not copy diagnostics. Please select and copy the text manually.');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.50)', backdropFilter: 'blur(16px)', display: 'grid', placeItems: 'center', zIndex: 7100, padding: '16px' }}>
      <div style={{ width: 'min(760px, 100%)', maxHeight: '92vh', overflow: 'hidden', background: 'rgba(255,255,255,0.64)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.30)', boxShadow: '0 28px 70px rgba(15,23,42,0.22)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'linear-gradient(135deg, var(--color-primary-deep), var(--color-primary))', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '-0.01em' }}>WhatsApp Preview</h3>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer' }}><X size={22} /></button>
        </div>
        <div style={{ padding: '14px 16px 16px', overflowY: 'auto', display: 'grid', gap: '12px' }}>
          {diagnostic?.text ? (
            <div style={{
              border: `1px solid ${diagnostic.tone === 'success' ? 'rgba(22,163,74,0.18)' : diagnostic.tone === 'danger' ? 'rgba(220,38,38,0.22)' : 'rgba(245,158,11,0.22)'}`,
              background: diagnostic.tone === 'success' ? 'rgba(240,253,244,0.95)' : diagnostic.tone === 'danger' ? 'rgba(254,242,242,0.96)' : 'rgba(255,251,235,0.96)',
              color: diagnostic.tone === 'success' ? '#166534' : diagnostic.tone === 'danger' ? '#b91c1c' : '#92400e',
              borderRadius: '12px',
              padding: '10px 12px',
              fontSize: '12px',
              fontWeight: 700,
              lineHeight: 1.45,
              display: 'grid',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div>{diagnostic.text}</div>
                <button
                  type="button"
                  onClick={handleCopyDiagnostics}
                  style={{
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
                  {copyStatus || 'Copy diagnostics'}
                </button>
              </div>
              {diagnosticRows.length ? (
                <div style={{ display: 'grid', gap: '6px' }}>
                  {diagnosticRows.map((row) => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', padding: '6px 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.52)' }}>
                      <span style={{ fontWeight: 800 }}>{row.label}</span>
                      <span style={{ fontWeight: 800, color: row.ok ? '#166534' : '#b91c1c' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              ) : null}
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
          <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr 1fr' }}>
            <div><div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800 }}>Recipient</div><div style={{ fontSize: '14px', fontWeight: 700 }}>{recipientName || '-'}</div></div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800 }}>Phone</div>
              {allowRecipientEdit ? (
                <input
                  value={phoneValue}
                  onChange={(event) => setPhoneValue(event.target.value)}
                  placeholder="Enter WhatsApp number (10 digits or +91...)"
                  inputMode="tel"
                  style={{ minHeight: '40px', width: '100%', borderRadius: '10px', border: '1px solid #d1d5db', padding: '0 12px', fontSize: '14px' }}
                />
              ) : (
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{recipientPhone || '-'}</div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: '#374151', textTransform: 'uppercase' }}>Message</label>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} style={{ minHeight: '180px', borderRadius: '12px', border: '1px solid #d1d5db', padding: '10px 12px', fontSize: '14px', resize: 'vertical' }} />
          </div>

          <div style={{ display: 'grid', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: '#374151', textTransform: 'uppercase' }}>Attachment</label>
            {showAttachmentFields ? (
              <>
                <input value={attachmentUrl} onChange={(event) => setAttachmentUrl(event.target.value)} placeholder="Attachment URL (optional)" style={{ minHeight: '42px', borderRadius: '10px', border: '1px solid #d1d5db', padding: '0 12px' }} />
                {allowManualUpload ? (
                  <input type="file" onChange={(event) => setAttachment(event.target.files?.[0] || null)} />
                ) : null}
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Template attachment option: {previewData?.attachmentOption || 'None'}</div>
              </>
            ) : (
              <div style={{ border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '10px 12px', background: '#f8fafc', color: '#475569', fontSize: '12px', fontWeight: 600, lineHeight: 1.45 }}>
                {attachmentNote || 'A PDF attachment will be added automatically when you send this message.'}
              </div>
            )}
          </div>

          {error ? <div style={{ color: '#dc2626', fontSize: '12px', fontWeight: 700 }}>{error}</div> : null}
        </div>
        <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.18)', padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.97), rgba(248, 250, 252, 0.99))', backdropFilter: 'blur(10px)' }}>
          <button type="button" onClick={onClose} style={{ minHeight: '40px', borderRadius: '12px', border: '1px solid #d1d5db', background: '#fff', color: '#334155', padding: '0 14px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={handleSend} disabled={busy || !isValidIndianMobileNumber(phoneValue) || !message.trim()} style={{ minHeight: '40px', borderRadius: '12px', border: 'none', background: 'var(--color-primary)', color: '#fff', padding: '0 16px', fontWeight: 800, cursor: 'pointer' }}>{busy ? 'Sending...' : sendButtonLabel}</button>
        </div>
      </div>
    </div>
  );
}
