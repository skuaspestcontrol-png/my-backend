import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pause, Play, RotateCcw, Square } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const formatDate = (value) => value ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-';
const styles = {
  page: { display: 'grid', gap: 12, width: '100%', minWidth: 0 },
  panel: { border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: 16, background: '#fff', padding: 16, overflow: 'hidden' },
  button: { minHeight: 36, borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 800, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 },
  muted: { color: '#64748b', fontSize: 12 }
};

export default function WhatsAppCampaignDetails() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    try { const response = await axios.get(`${API_BASE_URL}/api/whatsapp-marketing/campaigns/${encodeURIComponent(id)}`); setCampaign(response.data); } catch (error) { setMessage(error?.response?.data?.error || 'Could not load campaign.'); }
  };
  useEffect(() => { load(); const timer = setInterval(load, 5000); return () => clearInterval(timer); }, [id]);
  const action = async (name) => {
    if (name === 'cancel' && !window.confirm('Cancel all pending recipients?')) return;
    if (name === 'retry_failed' && !window.confirm(`Retry ${campaign?.failed || 0} failed recipients?`)) return;
    try { await axios.post(`${API_BASE_URL}/api/whatsapp-marketing/campaigns/${encodeURIComponent(id)}/action`, { action: name }); setMessage(name === 'retry_failed' ? 'Failed recipients queued for retry.' : `Campaign ${name} requested.`); await load(); } catch (error) { setMessage(error?.response?.data?.error || 'Could not update campaign.'); }
  };
  if (!campaign) return <div style={styles.page}><PageHeader title="Campaign Details" subtitle={message || 'Loading campaign...'} /></div>;
  const recipients = (campaign.recipients || []).filter((recipient) => (filter === 'all' || recipient.status === filter) && (!search || `${recipient.name} ${recipient.phone}`.toLowerCase().includes(search.toLowerCase())));
  return <div style={styles.page}>
    <PageHeader title={campaign.campaignName || 'Campaign Details'} subtitle={`${campaign.campaignType || 'Campaign'} | Asia/Kolkata`} action={<Link to="/sales/whatsapp-marketing" style={{ ...styles.button, textDecoration: 'none' }}><ArrowLeft size={14} />Back</Link>} />
    {message ? <div style={styles.panel}>{message}</div> : null}
    <div style={styles.panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><div style={{ fontWeight: 900, fontSize: 18 }}>{campaign.audienceLabel || 'Smart Audience'}</div><div style={styles.muted}>Created by {campaign.createdBy || '-'} on {formatDate(campaign.createdAt)}</div></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {campaign.status === 'running' ? <button type="button" style={styles.button} onClick={() => action('pause')}><Pause size={14} />Pause</button> : null}
        {campaign.status === 'paused' ? <button type="button" style={styles.button} onClick={() => action('resume')}><Play size={14} />Resume</button> : null}
        {['scheduled', 'running', 'paused'].includes(campaign.status) ? <button type="button" style={styles.button} onClick={() => action('cancel')}><Square size={14} />Cancel</button> : null}
        {campaign.failed > 0 ? <button type="button" style={styles.button} onClick={() => action('retry_failed')}><RotateCcw size={14} />Retry Failed</button> : null}
      </div></div>
      <div style={{ ...styles.grid, marginTop: 16 }}>{[['Total', campaign.total], ['Sent', campaign.sent], ['Failed', campaign.failed], ['Skipped', campaign.skipped + campaign.cancelled], ['Remaining', campaign.remaining]].map(([label, value]) => <div key={label}><div style={styles.muted}>{label}</div><div style={{ fontSize: 24, fontWeight: 900 }}>{value || 0}</div></div>)}</div>
      <div style={{ ...styles.muted, marginTop: 14 }}>Progress: {campaign.processed || 0} / {campaign.total || 0} | Scheduled: {formatDate(campaign.scheduleAt)} | Started: {formatDate(campaign.startedAt)} | Completed: {formatDate(campaign.completedAt)}</div>
    </div>
    <div style={styles.panel}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}><select value={filter} onChange={(event) => setFilter(event.target.value)} style={styles.button}><option value="all">All</option><option value="sent">Sent</option><option value="failed">Failed</option><option value="skipped">Skipped</option><option value="pending">Pending</option></select><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer or phone" style={{ ...styles.button, minWidth: 240 }} /></div>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: 12 }}><thead><tr>{['Customer', 'Phone', 'Status', 'Service', 'Area', 'Renewal Date', 'Sent At', 'Provider Status', 'Error'].map((heading) => <th key={heading} style={{ textAlign: 'left', padding: 9, borderBottom: '1px solid #e5e7eb', color: '#64748b' }}>{heading}</th>)}</tr></thead><tbody>{recipients.map((recipient) => <tr key={recipient.id}><td style={{ padding: 9, borderBottom: '1px solid #f1f5f9' }}>{recipient.name}</td><td style={{ padding: 9, borderBottom: '1px solid #f1f5f9' }}>{recipient.phone}</td><td style={{ padding: 9, borderBottom: '1px solid #f1f5f9' }}>{recipient.status}</td><td style={{ padding: 9, borderBottom: '1px solid #f1f5f9' }}>{recipient.service || '-'}</td><td style={{ padding: 9, borderBottom: '1px solid #f1f5f9' }}>{recipient.area || '-'}</td><td style={{ padding: 9, borderBottom: '1px solid #f1f5f9' }}>{recipient.renewalDate ? formatDate(recipient.renewalDate) : '-'}</td><td style={{ padding: 9, borderBottom: '1px solid #f1f5f9' }}>{formatDate(recipient.sentAt)}</td><td style={{ padding: 9, borderBottom: '1px solid #f1f5f9' }}>{recipient.providerHttpStatus || '-'}</td><td style={{ padding: 9, borderBottom: '1px solid #f1f5f9', color: '#b91c1c' }}>{recipient.errorMessage || recipient.skippedReason || '-'}</td></tr>)}</tbody></table></div>
    </div>
  </div>;
}
