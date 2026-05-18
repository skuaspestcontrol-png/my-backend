import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BarChart3, Clock3, Package, RefreshCcw, ShoppingCart, Truck, UserRound } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import AppButton from '../../components/ui/AppButton';
import DashboardStatCard from '../../components/ui/DashboardStatCard';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import PageHeader from '../../components/ui/PageHeader';
import AppCard from '../../components/ui/AppCard';
import { apiGet, money, number, safeRows } from './stockApi';

const summaryCards = [
  { key: 'totalItems', title: 'Total Items', icon: <Package size={18} /> },
  { key: 'totalOfficeStockValue', title: 'Total Office Stock Value', icon: <BarChart3 size={18} /> },
  { key: 'lowStockItems', title: 'Low Stock Items', icon: <AlertTriangle size={18} /> },
  { key: 'outOfStockItems', title: 'Out of Stock Items', icon: <Truck size={18} /> },
  { key: 'stockWithTechnicians', title: 'Stock With Technicians', icon: <UserRound size={18} /> },
  { key: 'thisMonthPurchase', title: 'This Month Purchase', icon: <ShoppingCart size={18} /> },
  { key: 'thisMonthUsage', title: 'This Month Usage', icon: <Clock3 size={18} /> },
  { key: 'expiringSoon', title: 'Expiring Soon', icon: <AlertTriangle size={18} /> }
];

const chartWrap = { width: '100%', height: 300 };
const neutralColor = '#111827';
const successColor = '#16A34A';
const dangerColor = '#DC2626';

export default function StockDashboard() {
  const navigate = useNavigate();
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet('/api/stock/dashboard');
      setData(res);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to load stock dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const shortcutGridStyle = viewportWidth <= 480
    ? { display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
    : viewportWidth <= 768
      ? { display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
      : { display: 'flex', flexWrap: 'wrap', gap: 10 };
  const summaryGridStyle = viewportWidth <= 480
    ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
    : viewportWidth <= 768
      ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
      : { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' };
  const chartGridStyle = viewportWidth <= 768
    ? { display: 'grid', gap: 16, gridTemplateColumns: '1fr' }
    : { display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' };
  const compactButtonStyle = viewportWidth <= 480 ? { width: '100%', minWidth: 0, justifyContent: 'center' } : undefined;
  const statCardStyle = viewportWidth <= 480 ? { padding: 0 } : undefined;
  const statContentStyle = viewportWidth <= 480 ? { padding: 12, gap: 8 } : undefined;
  const statTitleStyle = viewportWidth <= 480 ? { fontSize: 11 } : undefined;
  const statValueStyle = viewportWidth <= 480 ? { fontSize: 22 } : undefined;

  const isHealthyStock = (value) => Number(value || 0) > 0;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader
        title="Stock Dashboard"
        subtitle="Monitor office stock, technician stock, purchase flow, and low stock items."
        action={(
          <AppButton variant="outline" iconLeft={<RefreshCcw size={16} />} onClick={load} loading={loading}>
            Refresh
          </AppButton>
        )}
      />

      <div style={shortcutGridStyle}>
        <AppButton variant="secondary" style={compactButtonStyle} onClick={() => navigate('/stock/items')}>Items</AppButton>
        <AppButton variant="secondary" style={compactButtonStyle} onClick={() => navigate('/stock/purchase')}>Stock In / Purchase</AppButton>
        <AppButton variant="secondary" style={compactButtonStyle} onClick={() => navigate('/stock/issue-usage')}>Issue &amp; Usage</AppButton>
        <AppButton variant="secondary" style={compactButtonStyle} onClick={() => navigate('/stock/reports')}>Reports</AppButton>
      </div>

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
          <LoadingSpinner size={26} />
        </div>
      ) : error ? (
        <AppCard>
          <EmptyState title="Unable to load stock dashboard" message={error} />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
            <AppButton onClick={load} iconLeft={<RefreshCcw size={16} />}>Try Again</AppButton>
          </div>
        </AppCard>
      ) : (
        <>
          <div style={summaryGridStyle}>
            {summaryCards.map((card) => (
              <DashboardStatCard
                key={card.key}
                title={card.title}
                value={card.key.includes('Value') || card.key.includes('Purchase') ? money(data?.summary?.[card.key] || 0) : number(data?.summary?.[card.key] || 0)}
                icon={card.icon}
                style={statCardStyle}
                contentStyle={statContentStyle}
                titleStyle={statTitleStyle}
                valueStyle={statValueStyle}
              />
            ))}
          </div>

          <div style={chartGridStyle}>
            <AppCard title="Category Wise Stock">
              {safeRows(data?.categoryWise).length ? (
                <div style={chartWrap}>
                  <ResponsiveContainer>
                    <BarChart data={safeRows(data?.categoryWise)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="currentStock" radius={[8, 8, 0, 0]}>
                        {safeRows(data?.categoryWise).map((entry) => (
                          <Cell key={entry.category} fill={neutralColor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState title="No stock yet" message="Add items or purchases to see category stock here." />}
            </AppCard>

            <AppCard title="Purchase vs Usage">
              {safeRows(data?.monthlyTrend).length ? (
                <div style={chartWrap}>
                  <ResponsiveContainer>
                    <LineChart data={safeRows(data?.monthlyTrend)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="purchase" stroke={neutralColor} strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="usage" stroke={dangerColor} strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState title="No monthly trend yet" message="Stock purchases and usage will appear here over time." />}
            </AppCard>

            <AppCard title="Low Stock Items">
              {safeRows(data?.lowStockItems).length ? (
                <div style={chartWrap}>
                  <ResponsiveContainer>
                    <BarChart data={safeRows(data?.lowStockItems)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="itemName" hide />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="currentStock" radius={[8, 8, 0, 0]}>
                        {safeRows(data?.lowStockItems).map((entry) => (
                          <Cell key={entry.itemName} fill={dangerColor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState title="No low stock items" message="Items at or below the minimum stock level will show here." />}
            </AppCard>

            <AppCard title="Technician Wise Stock">
              {safeRows(data?.technicianWise).length ? (
                <div style={chartWrap}>
                  <ResponsiveContainer>
                    <BarChart data={safeRows(data?.technicianWise)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="technicianName" hide />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="currentBalance" radius={[8, 8, 0, 0]}>
                        {safeRows(data?.technicianWise).map((entry) => (
                          <Cell key={entry.technicianName} fill={isHealthyStock(entry.currentBalance) ? successColor : dangerColor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyState title="No technician balances" message="Issued stock and usage will appear here once technicians receive stock." />}
            </AppCard>
          </div>
        </>
      )}
    </div>
  );
}
