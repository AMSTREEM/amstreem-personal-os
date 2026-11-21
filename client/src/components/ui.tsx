import type { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

const buttonVariants = cva('button', {
  variants: {
    variant: {
      primary: 'button--primary',
      secondary: 'button--secondary',
      ghost: 'button--ghost',
      danger: 'button--danger'
    },
    size: {
      default: '',
      sm: 'button--small',
      lg: 'button--large',
      icon: 'button--icon'
    }
  },
  defaultVariants: { variant: 'primary', size: 'default' }
});

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { loading?: boolean };
export function Button({ children, className, variant, size, loading = false, disabled, ...props }: ButtonProps) {
  return <motion.button whileTap={{ scale: 0.985 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} className={buttonVariants({ variant, size, className })} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading && <span className="button__spinner" aria-hidden="true" />}
    {children}
  </motion.button>;
}
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('surface-card', className)}>{children}</section>;
}
export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="page-header"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-header__action">{action}</div>}</header>;
}
export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, 'aria-invalid': invalid, ...rest } = props;
  return <input {...rest} aria-invalid={invalid} className={cn('field-input', invalid === true && 'field-input--invalid', className)} />;
}
export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, 'aria-invalid': invalid, ...rest } = props;
  return <textarea {...rest} aria-invalid={invalid} className={cn('field-input field-input--area', invalid === true && 'field-input--invalid', className)} />;
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
export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger'; className?: string }) {
  return <span className={cn('ui-badge', 'ui-badge--' + tone, className)}>{children}</span>;
}
export function Separator({ className }: { className?: string }) {
  return <div role="separator" className={cn('ui-separator', className)} />;
}
export function IconButton({ children, label, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" aria-label={label} title={label} className={cn('icon-button', className)} {...props}>{children}</button>;
}
