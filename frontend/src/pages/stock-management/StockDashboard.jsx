import '../../styles/glassContent.css';
import GlassChartCard, { GlassChartTooltip } from '../../components/ui/GlassChartCard';
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
import { SummaryCardGrid, LoadingState, ErrorState } from '../../components/ui/PortalPrimitives';
import { apiGet, money, number, safeRows, stockCategoryDisplayLabel } from './stockApi';

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
const neutralColor = 'var(--chart-target-bar)';
const successColor = 'var(--chart-achieved-positive)';
const dangerColor = 'var(--chart-achieved-negative)';

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
    <div className="crm-page crm-section stock-management-page glass-content glass-refined" style={{ display: 'grid', gap: 16 }}>
      <PageHeader
        variant="glass"
        kind="stock"
        title="Stock Dashboard"
        subtitle="Monitor office stock, technician stock, purchase flow, and low stock items."
        action={viewportWidth > 768 ? (
          <AppButton variant="outline" iconLeft={<RefreshCcw size={16} />} onClick={load} loading={loading}>
            Refresh
          </AppButton>
        ) : null}
      />

      <div style={shortcutGridStyle}>
        <AppButton variant="secondary" style={compactButtonStyle} onClick={() => navigate('/stock/items')}>Items</AppButton>
        <AppButton variant="secondary" style={compactButtonStyle} onClick={() => navigate('/stock/purchase')}>Stock In / Purchase</AppButton>
        <AppButton variant="secondary" style={compactButtonStyle} onClick={() => navigate('/stock/issue-usage')}>Issue &amp; Usage</AppButton>
        <AppButton variant="secondary" style={compactButtonStyle} onClick={() => navigate('/stock/reports')}>Reports</AppButton>
      </div>

      {loading ? (
        <LoadingState message="Loading stock dashboard…" />
      ) : error ? (
        <AppCard className="glass-surface">
          <ErrorState message={error} />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
            <AppButton onClick={load} iconLeft={<RefreshCcw size={16} />}>Try Again</AppButton>
          </div>
        </AppCard>
      ) : (
        <>
          <SummaryCardGrid className="glass-summary-grid glass-summary-grid--overview" style={summaryGridStyle}>
            {summaryCards.map((card) => (
              <DashboardStatCard
                key={card.key}
                variant="glass"
                title={card.title}
                value={card.key.includes('Value') || card.key.includes('Purchase') ? money(data?.summary?.[card.key] || 0) : number(data?.summary?.[card.key] || 0)}
                icon={card.icon}
              />
            ))}
          </SummaryCardGrid>

          <div className="glass-overview-chart-grid" style={chartGridStyle}>
            <>
              {safeRows(data?.categoryWise).length ? (
                <GlassChartCard docked={viewportWidth <= 768} title="Category Wise Stock" rows={safeRows(data?.categoryWise)} columns={[{ key: 'category', label: 'Category', format: stockCategoryDisplayLabel }, { key: 'currentStock', label: 'Current Stock', format: number }]} minWidth={Math.max(600, safeRows(data?.categoryWise).length * 110)}>
                  <ResponsiveContainer>
                    <BarChart data={safeRows(data?.categoryWise)}>
                      <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="category" tickFormatter={stockCategoryDisplayLabel} interval={0} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} angle={-18} textAnchor="end" height={66} />
                      <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                      <Tooltip trigger={viewportWidth <= 768 ? 'click' : 'hover'} isAnimationActive={false} content={<GlassChartTooltip formatValue={number} formatLabel={stockCategoryDisplayLabel} />} />
                      <Bar dataKey="currentStock" name="Current Stock" radius={0} isAnimationActive={false}>
                        {safeRows(data?.categoryWise).map((entry) => (
                          <Cell key={entry.category} fill={neutralColor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </GlassChartCard>
              ) : <AppCard title="Category Wise Stock" className="glass-surface crm-chart-card"><EmptyState title="No stock yet" message="Add items or purchases to see category stock here." /></AppCard>}
            </>

            <>
              {safeRows(data?.monthlyTrend).length ? (
                <GlassChartCard docked={viewportWidth <= 768} title="Purchase vs Usage" rows={safeRows(data?.monthlyTrend)} columns={[{ key: 'month', label: 'Month' }, { key: 'purchase', label: 'Purchase', format: number }, { key: 'usage', label: 'Usage', format: number }]} minWidth={viewportWidth <= 768 ? Math.max(600, safeRows(data?.monthlyTrend).length * 60) : 0}>
                  <ResponsiveContainer>
                    <LineChart data={safeRows(data?.monthlyTrend)} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                      <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" interval={0} tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                      <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                      <Tooltip trigger={viewportWidth <= 768 ? 'click' : 'hover'} isAnimationActive={false} content={<GlassChartTooltip formatValue={number} />} />
                      <Line isAnimationActive={false} name="Purchase" type="monotone" dataKey="purchase" stroke={neutralColor} strokeWidth={3} dot={false} />
                      <Line isAnimationActive={false} name="Usage" type="monotone" dataKey="usage" stroke={dangerColor} strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </GlassChartCard>
              ) : <AppCard title="Purchase vs Usage" className="glass-surface crm-chart-card"><EmptyState title="No monthly trend yet" message="Stock purchases and usage will appear here over time." /></AppCard>}
            </>

            <>
              {safeRows(data?.lowStockItems).length ? (
                <GlassChartCard docked={viewportWidth <= 768} title="Low Stock Items" rows={safeRows(data?.lowStockItems)} columns={[{ key: 'itemName', label: 'Item' }, { key: 'currentStock', label: 'Current Stock', format: number }]} minWidth={Math.max(480, safeRows(data?.lowStockItems).length * 72)}>
                  <ResponsiveContainer>
                    <BarChart data={safeRows(data?.lowStockItems)}>
                      <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="itemName" hide />
                      <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                      <Tooltip trigger={viewportWidth <= 768 ? 'click' : 'hover'} isAnimationActive={false} content={<GlassChartTooltip formatValue={number} />} />
                      <Bar dataKey="currentStock" name="Current Stock" radius={0} isAnimationActive={false}>
                        {safeRows(data?.lowStockItems).map((entry) => (
                          <Cell key={entry.itemName} fill={dangerColor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </GlassChartCard>
              ) : <AppCard title="Low Stock Items" className="glass-surface crm-chart-card"><EmptyState title="No low stock items" message="Items at or below the minimum stock level will show here." /></AppCard>}
            </>

            <>
              {safeRows(data?.technicianWise).length ? (
                <GlassChartCard docked={viewportWidth <= 768} title="Technician Wise Stock" rows={safeRows(data?.technicianWise)} columns={[{ key: 'technicianName', label: 'Technician' }, { key: 'currentBalance', label: 'Current Balance', format: number }]} minWidth={Math.max(480, safeRows(data?.technicianWise).length * 72)}>
                  <ResponsiveContainer>
                    <BarChart data={safeRows(data?.technicianWise)}>
                      <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="technicianName" hide />
                      <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} />
                      <Tooltip trigger={viewportWidth <= 768 ? 'click' : 'hover'} isAnimationActive={false} content={<GlassChartTooltip formatValue={number} />} />
                      <Bar dataKey="currentBalance" name="Current Balance" radius={0} isAnimationActive={false}>
                        {safeRows(data?.technicianWise).map((entry) => (
                          <Cell key={entry.technicianName} fill={isHealthyStock(entry.currentBalance) ? successColor : dangerColor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </GlassChartCard>
              ) : <AppCard title="Technician Wise Stock" className="glass-surface crm-chart-card"><EmptyState title="No technician balances" message="Issued stock and usage will appear here once technicians receive stock." /></AppCard>}
            </>
          </div>
        </>
      )}
    </div>
  );
}
