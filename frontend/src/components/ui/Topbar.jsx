import { Bell } from 'lucide-react';
import SearchBar from './SearchBar';
import IconButton from './IconButton';

export default function Topbar() {
  return (
    <header style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, maxWidth: 380 }}><SearchBar placeholder="Search..." /></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconButton label="Notifications"><Bell size={20} /></IconButton>
        <div style={{ padding: '0 12px', minHeight: 40, border: '1px solid #E5E7EB', borderRadius: 12, display: 'inline-flex', alignItems: 'center', fontWeight: 700 }}>Admin</div>
      </div>
    </header>
  );
}
