import AppCard from './AppCard';

export default function FormSection({ title, children, action }) {
  return <AppCard title={title} action={action}>{children}</AppCard>;
}
