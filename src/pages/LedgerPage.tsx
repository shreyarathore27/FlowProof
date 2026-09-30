import { Fragment } from 'react';
import type { LedgerEvent } from '../api/types';
import { fmtTime, short } from '../lib/format';
import * as A from '../state/actions';
import { useApp } from '../state/store';
import { Empty, Org, PageHead, Pill, Stamp } from '../components/ui';

function Block({ e, fresh }: { e: LedgerEvent; fresh: boolean }) {
  const refused = e.status === 'REFUSED' || e.status === 'FAILED';
  const cls = e.fn === 'ChannelConfig' ? 'config' : refused ? 'refused' : e.status === 'ALLOWED' ? 'allowed' : '';
  return (
    <li className={`blk ${cls}${fresh ? ' fresh' : ''}`}>
      <span className="blk-n">{e.n}</span>
      <div className="blk-body">
        <div>
          <div className="blk-top">
            <span className="fn">{e.fn}</span>
            {e.status !== 'REFUSED' && <Pill tone={e.status === 'VALID' ? 'neutral' : e.status === 'ALLOWED' ? 'ok' : 'bad'}>{e.status}</Pill>}
          </div>
          <div className="blk-time num">{fmtTime(e.time)} IST</div>
          <div className="blk-orgs">{e.orgs.map((o) => <Org key={o} id={o} />)}</div>
          {e.reason && <div className="blk-reason">{e.reason}</div>}
          <div className="blk-hash">hash {short(e.hash, 10)} · prev {short(e.prev, 6)}</div>
        </div>
        <div className="blk-fields">
          {Object.entries(e.fields).map(([k, v]) => (
            <Fragment key={k}>
              <span>{k}</span>
              <span title={v}>{v.length > 44 ? short(v, 18) : v}</span>
            </Fragment>
          ))}
        </div>
        {e.status === 'REFUSED' && <Stamp small />}
      </div>
    </li>
  );
}

export function LedgerPage() {
  const s = useApp();
  const list = [...s.ledger].reverse().filter((e) => s.filter === 'all' || e.status === 'REFUSED');
  const allowed = s.ledger.filter((e) => e.status === 'ALLOWED').length;
  const refused = s.ledger.filter((e) => e.status === 'REFUSED').length;
  return (
    <>
      <PageHead eyebrow="Drunix · flowproof-channel" title="Ledger timeline"
        lead="Every consent decision, snapshot, request and repayment, in order. Only hashes, consent records, status and events are written." />
      <div className="lg-bar">
        <div className="lg-stats num">
          <span><b>{s.ledger.length}</b> blocks</span>
          <span><b>{allowed}</b> allowed</span>
          <span className="r"><b>{refused}</b> refused</span>
          <span>newest first</span>
        </div>
        <div className="filters" role="group" aria-label="Filter">
          <button onClick={() => A.setFilter('all')} aria-pressed={s.filter === 'all'}>All events</button>
          <button onClick={() => A.setFilter('refused')} aria-pressed={s.filter === 'refused'}>Refused only</button>
        </div>
      </div>
      {list.length
        ? <ol className="chain">{list.map((e) => <Block key={e.n} e={e} fresh={s.freshBlocks.includes(e.n)} />)}</ol>
        : <Empty title="No refusals yet">Revoke a consent, then request data from the Lender portal.</Empty>}
    </>
  );
}
