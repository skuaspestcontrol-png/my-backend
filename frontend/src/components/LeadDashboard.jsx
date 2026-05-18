import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, Clock3, XCircle, Users } from 'lucide-react';
import AppCard from '../components/ui/AppCard';
import DashboardStatCard from '../components/ui/DashboardStatCard';
import PageHeader from '../components/ui/PageHeader';
import { pestIssueShort } from '../utils/pestIssueCodes';

export default function LeadDashboard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch leads when the page loads
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const response = await axios.get('/api/leads');
        setLeads(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching leads:', error);
        setLoading(false);
      }
    };
    fetchLeads();
  }, []);

  // Helper function to format the date neatly
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const raw = String(dateString).trim();
    const plain = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (plain) return `${plain[3]}/${plain[2]}/${plain[1]}`;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '-';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Status badge colors
  const getStatusColor = (status) => {
    switch (status) {
      case 'Interested': return { bg: 'var(--color-primary-light)', color: 'var(--color-primary-dark)' }; // Blue
      case 'Followup': return { bg: '#fef08a', color: '#854d0e' };   // Yellow
      case 'Converted': return { bg: '#dcfce7', color: '#15803d' };  // Green
      case 'Rejected': return { bg: '#fee2e2', color: '#b91c1c' };   // Red
      default: return { bg: '#f4f4f5', color: '#3f3f46' };           // Gray
    }
  };

  const leadSummary = React.useMemo(() => {
    const getStatus = (lead) => String(lead?.leadStatus || lead?.status || '').trim().toLowerCase();
    return {
      total: leads.length,
      interested: leads.filter((lead) => getStatus(lead) === 'interested').length,
      followup: leads.filter((lead) => getStatus(lead) === 'followup' || getStatus(lead) === 'follow-up').length,
      converted: leads.filter((lead) => getStatus(lead) === 'converted' || getStatus(lead) === 'booked').length,
      rejected: leads.filter((lead) => getStatus(lead) === 'rejected').length
    };
  }, [leads]);

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading leads...</div>;

  return (
    <div className="crm-page crm-section" style={{ width: '100%', maxWidth: '100%', margin: 0, fontFamily: 'var(--font-sans)' }}>
      <PageHeader
        title="Sales Lead Dashboard"
        subtitle="Track new leads, follow-ups, and conversions in a clean operational view."
        action={(
          <div className="crm-badge" style={{ background: '#111827', color: '#fff', minHeight: 34, padding: '0 14px' }}>
            Total Leads: {leads.length}
          </div>
        )}
      />

      <section className="crm-grid crm-grid-4">
        <DashboardStatCard title="Total Leads" value={String(leadSummary.total)} icon={<Users size={18} />} />
        <DashboardStatCard title="Follow-up" value={String(leadSummary.followup)} icon={<Clock3 size={18} />} />
        <DashboardStatCard title="Converted" value={String(leadSummary.converted)} icon={<CheckCircle2 size={18} />} />
        <DashboardStatCard title="Rejected" value={String(leadSummary.rejected)} icon={<XCircle size={18} />} />
      </section>

      <AppCard title="Lead Register" className="crm-table-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }} className="crm-table-shell crm-scroll-table">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed' }} className="crm-compact-table crm-stack-mobile">
          <thead>
            <tr style={{ backgroundColor: '#f4f4f5', borderBottom: '2px solid #e4e4e7' }}>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Customer Name</th>
              <th style={thStyle}>Contact</th>
              <th style={thStyle}>Pest Issue</th>
              <th style={thStyle}>Source</th>
              <th style={thStyle}>Assigned To</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Action</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#71717a' }}>No leads captured yet.</td>
              </tr>
            ) : (
              leads.map((lead) => {
                const statusStyle = getStatusColor(lead.leadStatus);
                return (
                  <tr key={lead._id || lead.customerName} style={{ borderBottom: '1px solid #e4e4e7', transition: 'background-color 0.2s' }}>
                    <td style={tdStyle} data-label="Date">{formatDate(lead.createdAt)}</td>
                    <td style={{ ...tdStyle, fontWeight: 'bold', color: '#18181b' }} data-label="Customer Name"><span className="crm-table-primary crm-cell-wrap">{lead.customerName}</span></td>
                    <td style={tdStyle} data-label="Contact">
                      <div className="crm-cell-wrap">{lead.mobileNumber}</div>
                      <div className="crm-table-muted">{lead.areaName}</div>
                    </td>
                    <td style={tdStyle} data-label="Pest Issue" title={lead.pestIssue || ''}>{pestIssueShort(lead.pestIssue)}</td>
                    <td style={tdStyle} data-label="Source">{lead.leadSource === 'Other' ? lead.customLeadSource : lead.leadSource}</td>
                    <td style={tdStyle} data-label="Assigned To">{lead.assignedTo || 'Unassigned'}</td>
                    <td style={tdStyle} data-label="Status">
                      <span style={{ 
                        backgroundColor: statusStyle.bg, 
                        color: statusStyle.color, 
                        padding: '4px 8px', 
                        borderRadius: '12px', 
                        fontSize: '12px', 
                        fontWeight: 'bold' 
                      }}>
                        {lead.leadStatus}
                      </span>
                    </td>
                    <td style={tdStyle} data-label="Action">
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button 
                          onClick={() => navigate('/create-quote', { state: { lead: lead } })}
                          style={{ padding: '6px 10px', backgroundColor: '#27272a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Quote
                        </button>
                        <button 
                          onClick={() => navigate('/schedule-job', { state: { lead: lead } })}
                          style={{ padding: '6px 10px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Schedule
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          </table>
        </div>
      </AppCard>
    </div>
  );
}

const thStyle = { padding: '15px', color: '#52525b', fontSize: '14px', fontWeight: 'bold' };
const tdStyle = { padding: '15px', color: '#3f3f46', fontSize: '14px' };
