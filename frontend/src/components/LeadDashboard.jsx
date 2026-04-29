import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function LeadDashboard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
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

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Helper function to format the date neatly
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
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

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading leads...</div>;
  const isMobile = viewportWidth <= 900;

  return (
    <div style={{ width: '100%', maxWidth: '100%', margin: isMobile ? '14px auto' : '28px auto', fontFamily: 'sans-serif', padding: isMobile ? '0 8px' : '0 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <h2>Sales Lead Dashboard</h2>
        <span style={{ backgroundColor: '#27272a', color: 'white', padding: '5px 15px', borderRadius: '20px', fontSize: '14px' }}>
          Total Leads: {leads.length}
        </span>
      </div>

      <div style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
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
                    <td style={tdStyle}>{formatDate(lead.createdAt)}</td>
                    <td style={{ ...tdStyle, fontWeight: 'bold', color: '#18181b' }}>{lead.customerName}</td>
                    <td style={tdStyle}>
                      <div>{lead.mobileNumber}</div>
                      <div style={{ fontSize: '12px', color: '#71717a' }}>{lead.areaName}</div>
                    </td>
                    <td style={tdStyle}>{lead.pestIssue || '-'}</td>
                    <td style={tdStyle}>{lead.leadSource === 'Other' ? lead.customLeadSource : lead.leadSource}</td>
                    <td style={tdStyle}>{lead.assignedTo || 'Unassigned'}</td>
                    <td style={tdStyle}>
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
                    <td style={tdStyle}>
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
    </div>
  );
}

const thStyle = { padding: '15px', color: '#52525b', fontSize: '14px', fontWeight: 'bold' };
const tdStyle = { padding: '15px', color: '#3f3f46', fontSize: '14px' };
