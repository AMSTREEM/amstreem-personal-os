import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

export function Button({ children, className, variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button className={clsx('button', 'button--' + variant, className)} {...props}>{children}</button>;
}
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx('surface-card', className)}>{children}</section>;
}
export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="page-header"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-header__action">{action}</div>}</header>;
}
export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx('field-input', props.className)} />;
}
export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx('field-input field-input--area', props.className)} />;
}
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span className="field__label">{label}</span>{children}{hint && <span className="field__hint">{hint}</span>}</label>;
}
export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span className="empty-state__mark">✳</span><h3>{title}</h3><p>{detail}</p></div>;
}
export function Stat({ label, value, note, icon }: { label: string; value: string | number; note?: string; icon?: ReactNode }) {
  return <div className="stat-card"><div className="stat-card__top"><span>{label}</span>{icon && <span className="stat-card__icon">{icon}</span>}</div><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}