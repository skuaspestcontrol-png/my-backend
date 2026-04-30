import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function EmailPreviewModal({
  open,
  onClose,
  previewData,
  recipientName,
  recipientEmail,
  recipientType,
  moduleType,
  sentByUser,
  onSent
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const initialSubject = useMemo(() => String(previewData?.previewSubject || ''), [previewData]);
  const initialBody = useMemo(() => String(previewData?.previewBody || ''), [previewData]);
  const allowManualUpload = String(previewData?.attachmentOption || '').toLowerCase() === 'manual upload';

  React.useEffect(() => {
    if (!open) return;
    setSubject(initialSubject);
    setBody(initialBody);
    setAttachment(null);
    setAttachmentUrl(String(previewData?.suggestedAttachmentUrl || ''));
    setError('');
  }, [open, initialSubject, initialBody, previewData]);

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
        recipientEmail,
        recipientType,
        sentByUser,
        moduleName: moduleType,
        subject,
        body,
        attachmentUrl,
        contextData: previewData?.contextData || {}
      };

      if (attachment) {
        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (key === 'contextData') formData.append('contextData', JSON.stringify(value || {}));
          else formData.append(key, value ?? '');
        });
        formData.append('attachment', attachment);
        await axios.post(`${API_BASE_URL}/api/email/send-with-attachment`, formData);
      } else {
        await axios.post(`${API_BASE_URL}/api/email/send`, payload);
      }

      if (typeof onSent === 'function') onSent();
      onClose();
    } catch (sendError) {
      setError(sendError?.response?.data?.error || 'Failed to send email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.55)', display: 'grid', placeItems: 'center', zIndex: 5600, padding: '16px' }}>
      <div style={{ width: 'min(820px, 100%)', maxHeight: '92vh', overflow: 'hidden', background: '#fff', borderRadius: '20px', border: '1px solid rgba(59,130,246,0.28)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#1d4ed8', color: '#fff', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Email Preview</h3>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <div style={{ padding: '14px', overflowY: 'auto', display: 'grid', gap: '10px' }}>
          <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr 1fr' }}>
            <div><div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800 }}>Recipient</div><div style={{ fontSize: '13px', fontWeight: 700 }}>{recipientName || '-'}</div></div>
            <div><div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800 }}>Email</div><div style={{ fontSize: '13px', fontWeight: 700 }}>{recipientEmail || '-'}</div></div>
          </div>
          <div style={{ display: 'grid', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, color: '#374151', textTransform: 'uppercase' }}>Subject</label>
            <input value={subject} onChange={(event) => setSubject(event.target.value)} style={{ minHeight: '40px', borderRadius: '10px', border: '1px solid #d1d5db', padding: '0 12px' }} />
          </div>
          <div style={{ display: 'grid', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, color: '#374151', textTransform: 'uppercase' }}>Body (HTML supported)</label>
            <textarea value={body} onChange={(event) => setBody(event.target.value)} style={{ minHeight: '220px', borderRadius: '10px', border: '1px solid #d1d5db', padding: '10px 12px', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'grid', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, color: '#374151', textTransform: 'uppercase' }}>Attachment URL</label>
            <input value={attachmentUrl} onChange={(event) => setAttachmentUrl(event.target.value)} placeholder="Attachment URL (optional)" style={{ minHeight: '40px', borderRadius: '10px', border: '1px solid #d1d5db', padding: '0 12px' }} />
            {allowManualUpload ? <input type="file" onChange={(event) => setAttachment(event.target.files?.[0] || null)} /> : null}
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Template attachment option: {previewData?.attachmentOption || 'None'}</div>
          </div>
          {error ? <div style={{ color: '#dc2626', fontSize: '12px', fontWeight: 700 }}>{error}</div> : null}
        </div>
        <div style={{ borderTop: '1px solid #e5e7eb', padding: '10px 14px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" onClick={onClose} style={{ minHeight: '36px', borderRadius: '10px', border: '1px solid #d1d5db', background: '#fff', color: '#334155', padding: '0 12px', fontWeight: 700, fontSize: '13px' }}>Cancel</button>
          <button type="button" onClick={handleSend} disabled={busy || !recipientEmail || !subject.trim() || !body.trim()} style={{ minHeight: '36px', borderRadius: '10px', border: 'none', background: '#1d4ed8', color: '#fff', padding: '0 14px', fontWeight: 800, fontSize: '13px' }}>{busy ? 'Sending...' : 'Send Email'}</button>
        </div>
      </div>
    </div>
  );
}
