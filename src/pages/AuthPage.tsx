import { useEffect, useState, type FormEvent } from 'react';
import { Logo } from '../components/ui';

const ACCOUNTS_KEY = 'finbridge_accounts_v1';
const MOBILE_CODE = '246810';
const EMAIL_CODE = '135790';
const institutions = [
  { name: 'SBI', last4: '1234' },
  { name: 'HDFC Bank', last4: '5678' },
  { name: 'ICICI Bank', last4: '9012' },
  { name: 'Axis Bank', last4: '3456' },
  { name: 'Other authorized institution', last4: '7890' },
];

function sampleBankAccount(): DemoFinancialAccount {
  const institution = institutions[crypto.getRandomValues(new Uint8Array(1))[0] % 4];
  return { institution: institution.name, accountType: 'Savings', maskedNumber: `XXXX XXXX ${institution.last4}` };
}

export interface DemoFinancialAccount {
  institution: string;
  accountType: string;
  maskedNumber: string;
}

export interface AuthSession {
  fullName: string;
  email: string;
  mobile: string;
  city: string;
  occupation: string;
  financialGoal: string;
  finBridgeId?: string;
  demoBankPreview?: DemoFinancialAccount;
  demoProfile: 'ravi' | 'meena';
  connectedAccounts: DemoFinancialAccount[];
}

type AuthRecord = AuthSession & { salt: string; passwordHash: string };
type Stage = 'login' | 'register' | 'mobile' | 'email' | 'connect';
type RegisterForm = Omit<AuthSession, 'demoProfile' | 'connectedAccounts'> & {
  password: string;
  confirmPassword: string;
  terms: boolean;
  consentNotice: boolean;
};

const emptyForm: RegisterForm = {
  fullName: '', email: '', mobile: '', city: '', occupation: '', financialGoal: '',
  password: '', confirmPassword: '', terms: false, consentNotice: false,
};

function readAccounts(): AuthRecord[] {
  try {
    const value = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function randomSalt() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((n) => n.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 120000, hash: 'SHA-256' },
    key,
    256,
  );
  return [...new Uint8Array(bits)].map((n) => n.toString(16).padStart(2, '0')).join('');
}

function validPassword(password: string) {
  return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function strength(password: string) {
  return [password.length >= 8, /[A-Z]/.test(password), /[a-z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
}

export function AuthPage({
  onAuthenticated,
  mode = 'auth',
  existingSession,
  onBack,
  initialError = '',
}: {
  onAuthenticated: (session: AuthSession) => void;
  mode?: 'auth' | 'connect';
  existingSession?: AuthSession;
  onBack?: () => void;
  initialError?: string;
}) {
  const [stage, setStage] = useState<Stage>(mode === 'connect' ? 'connect' : 'login');
  const [form, setForm] = useState<RegisterForm>(emptyForm);
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [mobileCode, setMobileCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [seconds, setSeconds] = useState(60);
  const [resends, setResends] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const [pendingAccount, setPendingAccount] = useState<AuthRecord | null>(null);
  const [institution, setInstitution] = useState(() => institutions[crypto.getRandomValues(new Uint8Array(1))[0] % 4].name);
  const [accountType, setAccountType] = useState('Savings');
  const [financialConsent, setFinancialConsent] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState<DemoFinancialAccount[]>(existingSession?.connectedAccounts ?? []);

  useEffect(() => {
    if ((stage !== 'mobile' && stage !== 'email') || seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [stage, seconds]);

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  const updateForm = (key: keyof RegisterForm, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const beginOtp = (next: 'mobile' | 'email') => {
    setAttempts(0);
    setResends(0);
    setSeconds(60);
    setError('');
    setStage(next);
  };

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const identifier = loginIdentifier.trim().toLowerCase();
      const mobileIdentifier = identifier.replace(/\D/g, '');
      const registered = readAccounts().find((item) => item.email.toLowerCase() === identifier
        || item.finBridgeId?.toLowerCase() === identifier
        || item.mobile.replace(/\D/g, '') === mobileIdentifier);
      if (registered) {
        if (await hashPassword(loginPassword, registered.salt) !== registered.passwordHash) {
          setError('ID or password is incorrect.');
          return;
        }
        const { salt: _salt, passwordHash: _hash, ...session } = registered;
        onAuthenticated(session);
        return;
      }
      const demoProfiles = [
        { email: 'ravi@finbridge.demo', password: 'FinBridge@123', fullName: 'Ravi Kumar', mobile: '9876543210', finBridgeId: 'FB-USER-8A72K91', demoProfile: 'ravi' as const },
        { email: 'meena@finbridge.demo', password: 'FinBridge@123', fullName: 'Meena Sharma', mobile: '9876543211', finBridgeId: 'FB-USER-4C19M26', demoProfile: 'meena' as const },
      ];
      const demo = demoProfiles.find((item) => [item.email, item.mobile, item.finBridgeId.toLowerCase()].includes(identifier) && item.password === loginPassword);
      if (!demo) {
        setError('ID or password is incorrect.');
        return;
      }
      const demoConnectedAccounts = demo.demoProfile === 'ravi' ? [sampleBankAccount()] : [];
      onAuthenticated({ ...demo, city: '', occupation: '', financialGoal: '', demoBankPreview: sampleBankAccount(), connectedAccounts: demoConnectedAccounts });
    } catch {
      setError('Sign in could not be completed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    setError('');
    const email = form.email.trim().toLowerCase();
    const mobile = form.mobile.replace(/\D/g, '');
    if (!form.fullName.trim() || !/^\S+@\S+\.\S+$/.test(email) || mobile.length !== 10) {
      setError('Enter your name, a valid email address and a 10-digit mobile number.');
      return;
    }
    if (!validPassword(form.password)) {
      setError('Your password does not meet all the requirements.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!form.terms || !form.consentNotice) {
      setError('Please accept both account terms and the separate financial-data consent notice.');
      return;
    }
    if (readAccounts().some((account) => account.email.toLowerCase() === email)) {
      setError('An account with this email already exists. Sign in instead.');
      return;
    }
    setForm((current) => ({ ...current, email, mobile }));
    beginOtp('mobile');
  }

  async function verifyCode(event: FormEvent, kind: 'mobile' | 'email') {
    event.preventDefault();
    const code = kind === 'mobile' ? mobileCode : emailCode;
    const expected = kind === 'mobile' ? MOBILE_CODE : EMAIL_CODE;
    if (attempts >= 5) {
      setError('Too many attempts. Please restart registration.');
      return;
    }
    if (code !== expected) {
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      setError(nextAttempts >= 5 ? 'Too many attempts. Please restart registration.' : 'That code is not correct. Try again.');
      return;
    }
    setError('');
    if (kind === 'mobile') {
      setMobileCode('');
      beginOtp('email');
      return;
    }
    setBusy(true);
    try {
      const salt = randomSalt();
      const passwordHash = await hashPassword(form.password, salt);
      setPendingAccount({
        fullName: form.fullName.trim(), email: form.email.trim().toLowerCase(), mobile: form.mobile,
        city: form.city.trim(), occupation: form.occupation, financialGoal: form.financialGoal,
        finBridgeId: `FB-USER-${[...crypto.getRandomValues(new Uint8Array(5))].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`,
        demoBankPreview: sampleBankAccount(),
        demoProfile: crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? 'ravi' : 'meena', connectedAccounts: [], salt, passwordHash,
      });
      setEmailCode('');
      setFinancialConsent(false);
      setStage('connect');
    } catch {
      setError('Could not prepare your local demo account. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function resendCode() {
    if (seconds > 0 || resends >= 3) return;
    setResends((count) => count + 1);
    setSeconds(60);
    setAttempts(0);
    setError('A new demo code has been generated.');
  }

  function completeConnection(connectSelected: boolean) {
    let nextAccounts = connectedAccounts;
    if (connectSelected) {
      if (!financialConsent) {
        setError('Give separate financial-data consent before connecting this demo account.');
        return;
      }
      const selected = institutions.find((item) => item.name === institution)!;
      const account = {
        institution: selected.name,
        accountType,
        maskedNumber: `XXXX XXXX ${selected.last4}`,
      };
      if (!connectedAccounts.some((item) => item.institution === account.institution && item.accountType === account.accountType)) {
        nextAccounts = [...connectedAccounts, account];
      }
      setConnectedAccounts(nextAccounts);
    }
    if (!pendingAccount && !existingSession) return;
    let completed: AuthSession;
    if (pendingAccount) {
      const { salt: _salt, passwordHash: _hash, ...session } = pendingAccount;
      completed = { ...session, connectedAccounts: nextAccounts };
    } else {
      completed = { ...existingSession!, connectedAccounts: nextAccounts };
    }
    const stored = readAccounts();
    if (pendingAccount) {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...stored.filter((item) => item.email !== pendingAccount.email), { ...pendingAccount, connectedAccounts: nextAccounts }]));
    } else {
      const record = stored.find((item) => item.email === completed.email);
      if (record) localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(stored.map((item) => item.email === completed.email ? { ...record, connectedAccounts: nextAccounts } : item)));
    }
    onAuthenticated(completed);
  }

  if (stage === 'connect') {
    return (
      <main className="auth-portal">
        <header className="auth-top"><a className="brand" href="#home"><Logo /><span>FinBridge</span></a><span className="auth-demo-label">DEMO ENVIRONMENT</span></header>
        <div className="connect-wrap">
          <button className="auth-back" type="button" onClick={onBack ?? (() => setStage('register'))}>← Back</button>
          <div className="connect-head"><span className="eyebrow">{pendingAccount ? 'Registration complete · next step' : 'Account settings'}</span>{pendingAccount && <div className="verified-summary"><span>✓ Mobile number verified</span><span>✓ Email address verified</span></div>}<h1>Connect a Financial Account</h1><p>Connect authorized accounts for a unified financial view. No bank password, PIN, CVV or OTP is collected here.</p></div>
          <div className="connect-grid">
            <section className="auth-form-panel">
              <h2>Choose an institution</h2>
              <div className="institution-grid">
                {institutions.map((item, index) => (
                  <button className={`institution-option${institution === item.name ? ' selected' : ''}`} key={item.name} type="button" onClick={() => setInstitution(item.name)} aria-pressed={institution === item.name}>
                    <span className={`bank-mark bank-${index}`}>{item.name === 'Other authorized institution' ? '＋' : item.name.slice(0, 1)}</span><span>{item.name}</span>
                  </button>
                ))}
              </div>
              <label className="auth-field">Account type<select value={accountType} onChange={(event) => setAccountType(event.target.value)}><option>Savings</option><option>Current</option><option>Other</option></select></label>
              <div className="auth-consent-copy"><b>Purpose</b><p>Financial analysis, insights and personalized recommendations.</p><b>Data requested</b><p>Demo transaction history and permitted account information.</p></div>
              <label className="auth-check"><input type="checkbox" checked={financialConsent} onChange={(event) => setFinancialConsent(event.target.checked)} /><span>I authorize access to the selected financial information for the stated purpose. This is separate from creating my FinBridge account.</span></label>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <div className="auth-actions"><button className="btn btn-primary btn-lg" type="button" onClick={() => completeConnection(true)}>Use Demo Account</button><button className="btn" type="button" onClick={() => completeConnection(false)}>Continue to dashboard</button></div>
              <p className="auth-note">Demo connections use masked sample account details only. No live institution is contacted.</p>
            </section>
            <aside className="connect-aside"><span className="aside-number">01 / 02</span><h2>Your choice stays yours.</h2><p>Account registration does not authorize access to financial information. You can skip this step and connect an account later.</p><div className="security-list"><span>Separate, explicit authorization</span><span>Masked demo account number</span><span>Add multiple demo accounts</span></div>
              {connectedAccounts.length > 0 && <div className="connected-preview"><b>Connected in this demo</b>{connectedAccounts.map((account) => <span key={`${account.institution}-${account.accountType}`}>{account.institution} · {account.accountType} · {account.maskedNumber}</span>)}</div>}
            </aside>
          </div>
        </div>
      </main>
    );
  }

  const codeStep = stage === 'mobile' || stage === 'email';
  const passwordScore = strength(form.password);

  return (
    <main className="auth-portal">
      <header className="auth-top"><a className="brand" href="#home"><Logo /><span>FinBridge</span></a><span className="auth-demo-label">DEMO ENVIRONMENT</span></header>
      <div className="auth-layout">
        <aside className="auth-story">
          <div className="auth-story-copy"><span className="auth-kicker">FINANCIAL CLARITY, ON YOUR TERMS</span><h1>One identity.<br />A clearer view.</h1><p>Understand your finances across authorized accounts, with your consent in control.</p></div>
          <div className="story-visual" aria-hidden="true"><div className="story-label"><i /> PRIVATE BY DESIGN</div><div className="story-bars"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><div className="story-legend"><span>Income</span><b>Consent-led insights</b><span>Expenses</span></div></div>
          <div className="auth-story-foot"><span>01</span><span>Connect only what you choose</span><span className="story-line" /></div>
        </aside>
        <section className="auth-panel">
          {codeStep ? (
            <>
              <button className="auth-back" type="button" onClick={() => { setError(''); setStage('register'); setMobileCode(''); setEmailCode(''); setAttempts(0); }}>← {stage === 'mobile' ? 'Edit registration' : 'Change mobile number'}</button>
              <span className="eyebrow">Verification {stage === 'mobile' ? '1 of 2' : '2 of 2'}</span>
              <h2>{stage === 'mobile' ? 'Verify your mobile number' : 'Verify your email address'}</h2>
              {stage === 'email' && <div className="verified-summary"><span>✓ Mobile number verified</span></div>}
              <p className="auth-subtitle">{stage === 'mobile' ? `Enter the 6-digit demo code for +91 ${form.mobile}.` : `Enter the 6-digit demo code for ${form.email}.`}</p>
              <form className="auth-form" onSubmit={(event) => verifyCode(event, stage)}>
                <label className="auth-field">6-digit code<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={stage === 'mobile' ? mobileCode : emailCode} onChange={(event) => stage === 'mobile' ? setMobileCode(event.target.value.replace(/\D/g, '')) : setEmailCode(event.target.value.replace(/\D/g, ''))} placeholder="000000" /></label>
                <div className="otp-demo">Demo verification code <b>{stage === 'mobile' ? MOBILE_CODE : EMAIL_CODE}</b></div>
                <div className="otp-resend"><span>{seconds > 0 ? `Resend in 00:${String(seconds).padStart(2, '0')}` : resends < 3 ? 'Didn’t receive a code?' : 'Resend limit reached'}</span><button type="button" disabled={seconds > 0 || resends >= 3} onClick={resendCode}>Resend code</button></div>
                {error && <p className="auth-error" role="alert">{error}</p>}
                <button className="btn btn-primary btn-lg auth-submit" disabled={busy || attempts >= 5}>{busy ? 'Verifying…' : 'Verify and continue'}</button>
              </form>
              <p className="auth-note">Verification is simulated for this demo. No SMS or email is sent.</p>
            </>
          ) : stage === 'register' ? (
            <>
              <button className="auth-back" type="button" onClick={() => { setError(''); setStage('login'); }}>← Back to sign in</button>
              <span className="eyebrow">Create account · 1 minute</span><h2>Create Your FinBridge Account</h2>
              <p className="auth-subtitle">Create one secure identity to manage and understand your financial information across authorized financial accounts.</p>
              <form className="auth-form register-form" onSubmit={handleRegister}>
                <div className="register-fields">
                  <label className="auth-field">Full name <em>Required</em><input autoComplete="name" required value={form.fullName} onChange={(event) => updateForm('fullName', event.target.value)} placeholder="Your full name" /></label>
                  <label className="auth-field">Email address <em>Required</em><input type="email" autoComplete="email" required value={form.email} onChange={(event) => updateForm('email', event.target.value)} placeholder="you@example.com" /></label>
                  <label className="auth-field">Mobile number <em>Required</em><span className="phone-input"><b>+91</b><input inputMode="numeric" autoComplete="tel-national" maxLength={10} required value={form.mobile} onChange={(event) => updateForm('mobile', event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" /></span></label>
                  <label className="auth-field">City <small>Optional</small><input autoComplete="address-level2" value={form.city} onChange={(event) => updateForm('city', event.target.value)} placeholder="e.g. Jaipur" /></label>
                  <label className="auth-field">Occupation <small>Optional</small><select value={form.occupation} onChange={(event) => updateForm('occupation', event.target.value)}><option value="">Choose occupation</option><option>Small business owner</option><option>Self-employed</option><option>Salaried</option><option>Other</option></select></label>
                  <label className="auth-field">Financial goal <small>Optional</small><select value={form.financialGoal} onChange={(event) => updateForm('financialGoal', event.target.value)}><option value="">Choose a goal</option><option>Working capital</option><option>Build savings</option><option>Protect my business</option><option>Understand my cash flow</option></select></label>
                  <label className="auth-field">Password <em>Required</em><span className="password-input"><input type={showPasswords ? 'text' : 'password'} autoComplete="new-password" required value={form.password} onChange={(event) => updateForm('password', event.target.value)} placeholder="Create a password" /><button type="button" onClick={() => setShowPasswords((value) => !value)} aria-label={showPasswords ? 'Hide password' : 'Show password'}>{showPasswords ? 'Hide' : 'Show'}</button></span></label>
                  <label className="auth-field">Confirm password <em>Required</em><input type={showPasswords ? 'text' : 'password'} autoComplete="new-password" required value={form.confirmPassword} onChange={(event) => updateForm('confirmPassword', event.target.value)} placeholder="Enter it again" /></label>
                </div>
                {form.confirmPassword && <span className={`password-match${form.confirmPassword === form.password ? ' matched' : ''}`} role="status">{form.confirmPassword === form.password ? 'Passwords match' : 'Passwords do not match'}</span>}
                <div className="password-rules"><div className="strength-row"><b>Password strength</b><span>{passwordScore < 3 ? 'Add more variety' : passwordScore < 5 ? 'Getting stronger' : 'Strong'}</span></div><div className="strength-meter" aria-label={`Password strength ${passwordScore} of 5`}>{[1, 2, 3, 4, 5].map((n) => <i key={n} className={passwordScore >= n ? 'filled' : ''} />)}</div><ul><li className={form.password.length >= 8 ? 'valid' : ''}>Minimum 8 characters</li><li className={/[A-Z]/.test(form.password) ? 'valid' : ''}>At least 1 uppercase letter</li><li className={/[a-z]/.test(form.password) ? 'valid' : ''}>At least 1 lowercase letter</li><li className={/\d/.test(form.password) ? 'valid' : ''}>At least 1 number</li><li className={/[^A-Za-z0-9]/.test(form.password) ? 'valid' : ''}>At least 1 special character</li></ul><span className="auth-example">Example: FinBridge@123</span></div>
                <div className="register-consents">
                  <label className="auth-check"><input type="checkbox" checked={form.terms} onChange={(event) => updateForm('terms', event.target.checked)} /><span>I agree to FinBridge’s <b>Terms &amp; Conditions</b> and <b>Privacy Policy</b>.</span></label>
                  <label className="auth-check"><input type="checkbox" checked={form.consentNotice} onChange={(event) => updateForm('consentNotice', event.target.checked)} /><span>I understand that financial information is accessed only after my explicit, separate consent.</span></label>
                </div>
                {error && <p className="auth-error" role="alert">{error}</p>}
                <button className="btn btn-primary btn-lg auth-submit" type="submit">Send OTP and continue</button>
              </form>
              <p className="auth-switch">Already have an account? <button type="button" onClick={() => setStage('login')}>Sign in</button></p>
            </>
          ) : (
            <>
              <span className="eyebrow">Your financial home</span><h2>Welcome back</h2><p className="auth-subtitle">Sign in to continue to your FinBridge dashboard.</p>
              <form className="auth-form" onSubmit={handleLogin}>
                <label className="auth-field">Email, mobile or FinBridge ID<input type="text" autoComplete="username" required value={loginIdentifier} onChange={(event) => setLoginIdentifier(event.target.value)} placeholder="Email, +91 number or FB-USER-ID" /></label>
                <label className="auth-field">Password<span className="password-input"><input type={showPasswords ? 'text' : 'password'} autoComplete="current-password" required value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} placeholder="Your password" /><button type="button" onClick={() => setShowPasswords((value) => !value)} aria-label={showPasswords ? 'Hide password' : 'Show password'}>{showPasswords ? 'Hide' : 'Show'}</button></span></label>
                {error && <p className="auth-error" role="alert">{error}</p>}
                <button className="btn btn-primary btn-lg auth-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
              </form>
              <div className="demo-login"><b>Try the demo</b><span>Ravi or Meena · synthetic data only · password: FinBridge@123</span><div><button type="button" onClick={() => { setLoginIdentifier('ravi@finbridge.demo'); setLoginPassword('FinBridge@123'); }}>Use Ravi demo</button><button type="button" onClick={() => { setLoginIdentifier('meena@finbridge.demo'); setLoginPassword('FinBridge@123'); }}>Use Meena demo</button></div></div>
              <p className="auth-switch">New to FinBridge? <button type="button" onClick={() => { setError(''); setStage('register'); }}>Create an account</button></p>
            </>
          )}
        </section>
      </div>
      <footer className="auth-footer"><span>FinBridge · Private financial insights</span><span>Registration is separate from financial-data consent.</span></footer>
    </main>
  );
}
