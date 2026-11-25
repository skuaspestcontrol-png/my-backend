import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, Sparkles } from 'lucide-react';
import PageHeader from './PageHeader';
import AppCard from './AppCard';
import { SummaryCardGrid } from './PortalPrimitives';
import '../../styles/glassContent.css';

// Opt-in presentation for existing workspace copy and links; no new live data or metrics.
export default function GlassWorkspace({ badge, title, description, stats, queueTitle, queueItems, actionTitle, actions, sideTitle, sideText }) {
  return <div className="glass-content glass-refined glass-workspace">
    <PageHeader variant="glass" title={title} subtitle={description} icon={Sparkles} action={<span className="glass-workspace-badge">{badge}</span>} />
    <div><p className="glass-section-label">Workspace focus</p><SummaryCardGrid className="glass-workspace-focus-grid">
      {stats.map(stat => <AppCard key={stat.label} className="glass-surface glass-workspace-focus"><span>{stat.label}</span><strong>{stat.value}</strong></AppCard>)}
    </SummaryCardGrid></div>
    <div className="glass-workspace-columns">
      <AppCard className="glass-surface" title={queueTitle}><div className="glass-workspace-priorities">
        {queueItems.map(item => <div key={item.title} className="glass-workspace-priority"><div><h4>{item.title}</h4><p>{item.description}</p></div><span className="glass-workspace-meta">{item.meta}</span></div>)}
      </div></AppCard>
      <AppCard className="glass-surface" title={actionTitle}><nav className="glass-workspace-actions" aria-label={actionTitle}>
        {actions.map(action => <Link key={action.label} to={action.href || '/dashboard'}><span>{action.label}</span><ArrowRight size={17} aria-hidden="true" /></Link>)}
      </nav></AppCard>
    </div>
    <AppCard className="glass-surface glass-workspace-note" title={<span className="glass-panel-title"><Clock3 size={18} aria-hidden="true" />Operational Focus</span>}>
      <h4>{sideTitle}</h4><p>{sideText}</p><p className="glass-workspace-guidance">Keep this module focused on the handful of actions that unblock the team fastest.</p>
    </AppCard>
  </div>;
}
