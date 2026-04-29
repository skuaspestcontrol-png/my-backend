import { Search } from 'lucide-react';
import AppInput from './AppInput';

export default function SearchBar(props) {
  return (
    <div style={{ position: 'relative' }}>
      <Search size={18} style={{ position: 'absolute', left: 12, top: 11, color: '#6B7280' }} />
      <AppInput {...props} style={{ paddingLeft: 36, ...(props.style || {}) }} />
    </div>
  );
}
