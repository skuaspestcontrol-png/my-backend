import React, { useState } from 'react';
import axios from 'axios';
import { Mail } from 'lucide-react';
import EmailPreviewModal from './EmailPreviewModal';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function EmailSendButton({
  moduleType,
  recipientName,
  recipientEmail,
  recipientType = 'Customer',
  contextData = {},
  templateType = '',
  suggestedAttachmentUrl = '',
  sentByUser = ''
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  const handleOpen = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await axios.post(`${API_BASE_URL}/api/email/preview`, {
        moduleType,
        templateType,
        contextData,
        suggestedAttachmentUrl
      });
      setPreviewData(res.data || null);
      setOpen(true);
    } catch (previewError) {
      setError(previewError?.response?.data?.error || 'Unable to load email preview.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={loading}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          border: '1px solid rgba(59,130,246,0.35)',
          background: '#eff6ff',
          color: '#1e40af',
          borderRadius: '10px',
          padding: '8px 12px',
          fontSize: '12px',
          fontWeight: 800,
          cursor: 'pointer'
        }}
      >
        <Mail size={14} />
        {loading ? 'Loading...' : 'Email'}
      </button>
      {error ? <div style={{ color: '#dc2626', fontSize: '11px', marginTop: '4px' }}>{error}</div> : null}
      <EmailPreviewModal
        open={open}
        onClose={() => setOpen(false)}
        previewData={previewData}
        recipientName={recipientName}
        recipientEmail={recipientEmail}
        recipientType={recipientType}
        moduleType={moduleType}
        sentByUser={sentByUser || localStorage.getItem('portal_user_name') || 'User'}
        onSent={() => window.alert('Email sent successfully.')}
      />
    </>
  );
}
