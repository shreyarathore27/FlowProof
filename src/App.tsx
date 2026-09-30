import { useEffect, type MouseEvent } from 'react';
import { ErrorBar, Narrator, Sidebar, Toasts, TopBar } from './components/Chrome';
import { boot } from './state/actions';
import { currentPage, getState, useApp } from './state/store';
import { Landing } from './pages/merchant/Landing';
import { ConsentPage } from './pages/merchant/ConsentPage';
import { SignalsPage } from './pages/merchant/SignalsPage';
import { OptionsPage } from './pages/merchant/OptionsPage';
import { OfferPage } from './pages/merchant/OfferPage';
import { AccountPage } from './pages/merchant/AccountPage';
import { ApplicantsPage } from './pages/lender/ApplicantsPage';
import { LedgerPage } from './pages/LedgerPage';

function Page() {
  const s = useApp();
  const page = currentPage(s);
  if (page === 'ledger') return <LedgerPage />;
  if (s.view === 'lender') return <ApplicantsPage />;
  if (!s.merchant) return <Landing />;
  switch (page) {
    case 'signals': return <SignalsPage />;
    case 'options': return <OptionsPage />;
    case 'offer': return <OfferPage />;
    case 'account': return <AccountPage />;
    default: return <ConsentPage />;
  }
}

/** While the demo plays, block clicks except on controls marked data-always (Stop / Close). */
function blockWhilePlaying(e: MouseEvent) {
  if (!getState().playing) return;
  const t = (e.target as HTMLElement).closest('button, a, input, select, label');
  if (t && !t.closest('[data-always]')) { e.preventDefault(); e.stopPropagation(); }
}

export default function App() {
  useEffect(() => { boot(); }, []);
  return (
    <div onClickCapture={blockWhilePlaying}>
      <TopBar />
      <div className="shell">
        <Sidebar />
        <main className="main">
          <Narrator />
          <ErrorBar />
          <div className="page" aria-live="polite"><Page /></div>
        </main>
      </div>
      <Toasts />
    </div>
  );
}
