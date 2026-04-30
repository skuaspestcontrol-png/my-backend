import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';

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
  onSent
}) {
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const initialMessage = useMemo(() => String(previewData?.previewMessage || ''), [previewData]);
  const allowManualUpload = String(previewData?.attachmentOption || '').toLowerCase() === 'manual upload';

  React.useEffect(() => {
    if (!open) return;
    setMessage(initialMessage);
    setAttachment(null);
    setAttachmentUrl(String(previewData?.suggestedAttachmentUrl || ''));
    setError('');
  }, [open, initialMessage, previewData]);

  if (!open) return null;

  const handleSend = async () => {
    try {
      setBusy(true);
      setError('');
      const payload = {
        moduleType,
        templateType: previewData?.template?.templateType,
        templateId: previewData?.template?.id,
        recipientName,
        recipientPhone,
        recipientType,
        sentByUser,
        moduleName: moduleType,
        message,
        attachmentUrl,
        contextData: previewData?.contextData || {}
      };

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

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.55)', display: 'grid', placeItems: 'center', zIndex: 5500, padding: '16px' }}>
      <div style={{ width: 'min(760px, 100%)', maxHeight: '92vh', overflow: 'hidden', background: '#fff', borderRadius: '20px', border: '1px solid rgba(159,23,77,0.2)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'var(--color-primary)', color: '#fff', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>WhatsApp Preview</h3>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer' }}><X size={22} /></button>
        </div>
        <div style={{ padding: '16px', overflowY: 'auto', display: 'grid', gap: '12px' }}>
          <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr 1fr' }}>
            <div><div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800 }}>Recipient</div><div style={{ fontSize: '14px', fontWeight: 700 }}>{recipientName || '-'}</div></div>
            <div><div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800 }}>Phone</div><div style={{ fontSize: '14px', fontWeight: 700 }}>{recipientPhone || '-'}</div></div>
          </div>

          <div style={{ display: 'grid', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: '#374151', textTransform: 'uppercase' }}>Message</label>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} style={{ minHeight: '180px', borderRadius: '12px', border: '1px solid #d1d5db', padding: '10px 12px', fontSize: '14px', resize: 'vertical' }} />
          </div>

          <div style={{ display: 'grid', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: '#374151', textTransform: 'uppercase' }}>Attachment</label>
            <input value={attachmentUrl} onChange={(event) => setAttachmentUrl(event.target.value)} placeholder="Attachment URL (optional)" style={{ minHeight: '42px', borderRadius: '10px', border: '1px solid #d1d5db', padding: '0 12px' }} />
            {allowManualUpload ? (
              <input type="file" onChange={(event) => setAttachment(event.target.files?.[0] || null)} />
            ) : null}
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Template attachment option: {previewData?.attachmentOption || 'None'}</div>
          </div>

          {error ? <div style={{ color: '#dc2626', fontSize: '12px', fontWeight: 700 }}>{error}</div> : null}
        </div>
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={onClose} style={{ minHeight: '40px', borderRadius: '12px', border: '1px solid #d1d5db', background: '#fff', color: '#334155', padding: '0 14px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={handleSend} disabled={busy || !recipientPhone || !message.trim()} style={{ minHeight: '40px', borderRadius: '12px', border: 'none', background: 'var(--color-primary)', color: '#fff', padding: '0 16px', fontWeight: 800, cursor: 'pointer' }}>{busy ? 'Sending...' : 'Send WhatsApp'}</button>
        </div>
      </div>
    </div>
  );
}
