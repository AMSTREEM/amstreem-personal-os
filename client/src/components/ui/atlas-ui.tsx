import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '../../design/cn';

type Tone = 'default' | 'secondary' | 'quiet' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

export interface AtlasButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  size?: Size;
  loading?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const AtlasButton = forwardRef<HTMLButtonElement, AtlasButtonProps>(function AtlasButton(
  { className, tone = 'default', size = 'md', loading = false, disabled, leading, trailing, children, ...props }, ref
) {
  return <button ref={ref} className={cn('a-btn', `a-btn--${tone}`, `a-btn--${size}`, className)}
    disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading ? <LoaderCircle className="a-btn__spinner" size={15} aria-hidden="true" /> : leading}
    {size !== 'icon' && children}
    {size !== 'icon' && trailing}
  </button>;
});

export interface AtlasCardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}
export function AtlasCard({ className, interactive = false, padding = 'md', ...props }: AtlasCardProps) {
  return <div className={cn('a-card', `a-card--pad-${padding}`, interactive && 'a-card--interactive', className)} {...props} />;
}

export function AtlasCardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('a-card__header', className)} {...props} />;
}
export function AtlasCardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('a-card__title', className)} {...props} />;
}
export function AtlasCardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('a-card__description', className)} {...props} />;
}
export function AtlasCardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('a-card__content', className)} {...props} />;
}
export function AtlasCardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('a-card__footer', className)} {...props} />;
}

const badgeTones = ['neutral', 'accent', 'success', 'warning', 'danger', 'info'] as const;
export type AtlasBadgeTone = typeof badgeTones[number];
export function AtlasBadge({ tone = 'neutral', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: AtlasBadgeTone }) {
  return <span className={cn('a-badge', `a-badge--${tone}`, className)} {...props} />;
}

export interface AtlasInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}
export const AtlasInput = forwardRef<HTMLInputElement, AtlasInputProps>(function AtlasInput(
  { className, id, label, hint, error, ...props }, ref
) {
  const inputId = id || props.name;
  const hintId = hint && inputId ? `${inputId}-hint` : undefined;
  const errorId = error && inputId ? `${inputId}-error` : undefined;
  return <div className="a-field">
    {label && <label className="a-field__label" htmlFor={inputId}>{label}</label>}
    <input ref={ref} id={inputId} className={cn('a-input', error && 'a-input--error', className)}
      aria-invalid={!!error || undefined} aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined} {...props} />
    {hint && <span className="a-field__hint" id={hintId}>{hint}</span>}
    {error && <span className="a-field__error" id={errorId} role="alert">{error}</span>}
  </div>;
});

export function AtlasProgress({ value, label, className }: { value: number; label?: string; className?: string }) {
  const safeValue = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  return <div className={cn('a-progress', className)}>
    <div className="a-progress__track" role="progressbar" aria-label={label || 'Progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(safeValue)}>
      <span className="a-progress__value" style={{ width: safeValue + '%' }} />
    </div>
    {label && <span className="a-progress__label">{label}</span>}
  </div>;
}

export function AtlasDivider({ className, ...props }: HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn('a-divider', className)} {...props} />;
}

export function AtlasEmptyState({ title, description, action, icon, className }: {
  title: string; description?: string; action?: ReactNode; icon?: ReactNode; className?: string;
}) {
  return <div className={cn('a-empty', className)}>
    {icon && <span className="a-empty__icon" aria-hidden="true">{icon}</span>}
    <h3>{title}</h3>
    {description && <p>{description}</p>}
    {action && <div className="a-empty__action">{action}</div>}
  </div>;
}

export function AtlasSkeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn('a-skeleton', className)} {...props} />;
}

export function AtlasSectionHeading({ eyebrow, title, description, action, className }: {
  eyebrow?: string; title: string; description?: string; action?: ReactNode; className?: string;
}) {
  return <div className={cn('a-section-heading', className)}>
    <div className="a-section-heading__copy">
      {eyebrow && <span className="a-section-heading__eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
    {action && <div className="a-section-heading__action">{action}</div>}
  </div>;
}
