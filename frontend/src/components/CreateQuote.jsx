import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function CreateQuote() {
  const location = useLocation();
  const navigate = useNavigate();
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  
  // Get the lead data passed from the dashboard
  const lead = location.state?.lead;

  const [quoteData, setQuoteData] = useState({
    serviceDescription: lead?.pestIssue || '',
    serviceAmount: '',
    taxRate: 18, // Defaulting to 18% GST
  });

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!lead) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Please select a lead from the Dashboard first.</div>;
  }

  const handleChange = (e) => {
    setQuoteData({ ...quoteData, [e.target.name]: e.target.value });
  };

  // Calculate totals
  const subtotal = parseFloat(quoteData.serviceAmount) || 0;
  const taxAmount = (subtotal * quoteData.taxRate) / 100;
  const grandTotal = subtotal + taxAmount;

  const handleSaveQuote = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        leadId: lead._id,
        customerName: lead.customerName,
        mobileNumber: lead.mobileNumber,
        address: lead.address,
        serviceDescription: quoteData.serviceDescription,
        subtotal: subtotal,
        taxAmount: taxAmount,
        grandTotal: grandTotal,
        status: 'Draft'
      };

      await axios.post('/api/quotations', payload);
      alert('Quotation Generated Successfully!');
      navigate('/dashboard'); // Go back to dashboard
    } catch (error) {
      console.error('Error saving quote', error);
      alert('Failed to save quote.');
    }
  };

  // Standard browser print function for quick PDF generation
  const handlePrint = () => {
    window.print();
  };
  const isMobile = viewportWidth <= 900;

  return (
    <div style={{ width: '100%', maxWidth: '100%', margin: isMobile ? '16px auto' : '40px auto', fontFamily: 'sans-serif', padding: isMobile ? '0 10px' : '0 20px' }}>
      
      {/* Quotation Document UI */}
      <div id="print-area" style={{ backgroundColor: 'white', padding: isMobile ? '16px' : '40px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '10px', borderBottom: '2px solid #27272a', paddingBottom: '20px', marginBottom: '20px' }}>
          <div>
            <h1 style={{ margin: 0, color: '#27272a' }}>QUOTATION</h1>
            <p style={{ margin: '5px 0 0 0', color: '#71717a' }}>Draft Mode</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong>Billed To:</strong><br />
            {lead.customerName}<br />
            {lead.address || 'Address not provided'}<br />
            {lead.mobileNumber}
          </div>
        </div>

        <form onSubmit={handleSaveQuote}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Service Description</label>
            <input type="text" name="serviceDescription" value={quoteData.serviceDescription} onChange={handleChange} required style={inputStyle} />
          </div>

          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Service Amount (₹)</label>
              <input type="number" name="serviceAmount" value={quoteData.serviceAmount} onChange={handleChange} required style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Tax Rate (%)</label>
              <input type="number" name="taxRate" value={quoteData.taxRate} onChange={handleChange} style={inputStyle} />
            </div>
          </div>

          <div style={{ backgroundColor: '#f4f4f5', padding: '20px', borderRadius: '4px', textAlign: 'right' }}>
            <p>Subtotal: <strong>₹ {subtotal.toFixed(2)}</strong></p>
            <p>GST ({quoteData.taxRate}%): <strong>₹ {taxAmount.toFixed(2)}</strong></p>
            <h3 style={{ borderTop: '1px solid #ccc', paddingTop: '10px', marginTop: '10px' }}>Grand Total: ₹ {grandTotal.toFixed(2)}</h3>
          </div>

          {/* Action Buttons - These will be hidden when printing using standard CSS, but we'll keep it simple for now */}
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px', marginTop: '30px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={handlePrint} style={{ padding: '10px 20px', backgroundColor: '#52525b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              🖨️ Print / Save PDF
            </button>
            <button type="button" onClick={() => alert('WhatsApp API will trigger here')} style={{ padding: '10px 20px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              💬 WhatsApp
            </button>
            <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#27272a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              💾 Save Quotation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px', border: '1px solid #d4d4d8', borderRadius: '4px', boxSizing: 'border-box' };
