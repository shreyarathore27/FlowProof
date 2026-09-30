import * as A from '../../state/actions';
import { Empty, PageHead, Pill } from '../../components/ui';
import { useMerchant } from './useMerchant';

export function OptionsPage() {
  const { s, u } = useMerchant();
  const head = <PageHead eyebrow="Step 3 · Options" title="Your options" lead={u.matches ? 'Matches come from fixed rules. The explanation only restates them.' : undefined} />;

  if (!u.matches) {
    const msg = u.dataDeleted ? 'Your data was deleted after you revoked consent.'
      : u.summary ? 'Anchor your snapshot on the Signals page to see which products match you.'
      : 'Grant consent to see which products match you.';
    return <>{head}<Empty title="No options yet">{msg}</Empty></>;
  }

  const { matches, explanation, rulesVersion } = u.matches;
  const matched = matches.filter((m) => m.matched), near = matches.filter((m) => !m.matched);
  return (
    <>
      {head}
      <div className="explain">
        <div className="row between">
          <span className="eyebrow" style={{ color: 'var(--accent)' }}>In plain words</span>
          <span className="lang" role="group" aria-label="Language">
            <button onClick={() => A.setLang('en')} aria-pressed={s.lang === 'en'}>EN</button>
            <button onClick={() => A.setLang('hi')} aria-pressed={s.lang === 'hi'}>हिंदी</button>
          </span>
        </div>
        <p lang={s.lang}>{explanation[s.lang]}</p>
        <small>
          {explanation.source === 'llm' ? 'Written by AI from the structured results · numbers checked against the input' : 'Template explanation (AI output unavailable or failed the number check)'}
        </small>
      </div>

      <span className="section-label">Matched · {matched.length}</span>
      <div className="grid3">
        {matched.map((m) => (
          <div key={m.productId} className="card prod match">
            <div className="row between"><h2>{m.name}</h2><Pill tone="ok">Matched</Pill></div>
            <p className="blurb">{m.blurb}</p>
            <span className="eyebrow">Why you matched</span>
            <ul>{m.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        ))}
      </div>

      {near.length > 0 && (
        <>
          <span className="section-label">Almost there · {near.length}</span>
          <div className="grid2">
            {near.map((m) => (
              <div key={m.productId} className="card prod">
                <div className="row between"><h2>{m.name}</h2><Pill tone="warn">{m.gaps.length} gap{m.gaps.length > 1 ? 's' : ''}</Pill></div>
                <p className="blurb">{m.blurb}</p>
                {m.gaps.map((g) => (
                  <div key={g.criterion} className="gap">
                    <div className="gh">{g.criterion}<span className="num">{g.current} → {g.needed}</span></div>
                    <p><b>How to fix:</b> {g.howToFix}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
      <p className="muted" style={{ margin: 0, fontSize: '.88rem' }}>Thresholds are illustrative ({rulesVersion}). A match is not an approval.</p>
    </>
  );
}
