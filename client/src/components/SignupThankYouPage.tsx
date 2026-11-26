import { useState } from 'react';
import { ArrowRight, BadgeCheck, ShieldCheck } from 'lucide-react';

export function SignupThankYouPage({ onContinue }: { onContinue: () => void }) {
  const [later, setLater] = useState(false);

  return <main className="auth-screen signup-confirmation-screen">
    <section className="auth-visual">
      <div className="auth-brand">
        <img className="brand-symbol" src="/assets/brand/amstreem-symbol.svg" alt="" />
        <span>AMSTREEM <b>ATLAS</b></span>
      </div>
      <div className="auth-message-block">
        <span className="eyebrow">EMAIL CONFIRMED</span>
        <h1>Thank you for<br /><em>joining us.</em></h1>
        <p>Your email address is verified. Your private Atlas residence is ready whenever you are.</p>
        <div className="auth-principle">
          <span className="auth-principle__icon" aria-hidden="true"><BadgeCheck size={17} /></span>
          <span>Your account is confirmed and secure.</span>
        </div>
      </div>
      <div className="auth-footnote">YOUR SPACE. YOUR PACE. YOUR DIRECTION.</div>
    </section>
    <section className="auth-panel signup-confirmation-panel">
      <div className="auth-panel__inner">
        <div className="auth-panel__top">
          <span className="eyebrow">YOUR NEXT STEP</span>
          <span className="secure-label"><ShieldCheck size={13} /> PRIVATE WORKSPACE</span>
        </div>
        <h2>Would you like to continue?</h2>
        <p className="auth-subtitle">Your confirmation is complete. You can enter Amstreem Atlas now, or come back whenever you're ready.</p>
        <button type="button" className="button button--primary" onClick={onContinue}>
          Continue to Atlas <ArrowRight size={16} />
        </button>
        <button type="button" className="text-action" onClick={() => setLater(true)}>Not right now</button>
        {later && <div className="signup-confirmation-status" role="status">
          <BadgeCheck size={17} />
          <span>No problem. Your email is confirmed. You can close this page and return to Atlas whenever you're ready.</span>
        </div>}
      </div>
    </section>
  </main>;
}
