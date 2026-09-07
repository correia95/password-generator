import { useCallback, useEffect, useMemo, useState } from 'react';
import { Options, crackTime, entropyBits, generate, strengthLabel } from './gen';

const LS = 'password-generator:opts';

function read(): Options {
  const def: Options = {
    length: 20,
    lower: true,
    upper: true,
    digits: true,
    symbols: true,
    excludeAmbiguous: true,
    noRepeat: false,
  };
  try {
    const p = new URLSearchParams(window.location.search);
    if (p.has('l')) {
      return {
        length: Math.max(4, Math.min(128, Number(p.get('l')) || 20)),
        lower: p.get('lo') !== '0',
        upper: p.get('up') !== '0',
        digits: p.get('di') !== '0',
        symbols: p.get('sy') !== '0',
        excludeAmbiguous: p.get('am') !== '1',
        noRepeat: p.get('nr') === '1',
      };
    }
    const saved = localStorage.getItem(LS);
    if (saved) return { ...def, ...JSON.parse(saved) };
  } catch {
    /* ignore */
  }
  return def;
}

export default function App() {
  const [opts, setOpts] = useState<Options>(read);
  const [pw, setPw] = useState('');
  const [batch, setBatch] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const anyClass = opts.lower || opts.upper || opts.digits || opts.symbols;

  const regen = useCallback(() => {
    setPw(generate(opts));
    setBatch((b) => (b.length ? Array.from({ length: b.length }, () => generate(opts)) : []));
  }, [opts]);

  useEffect(() => {
    regen();
  }, [regen, nonce]);

  useEffect(() => {
    try {
      localStorage.setItem(LS, JSON.stringify(opts));
      const u = new URL(window.location.href);
      const q = u.searchParams;
      q.set('l', String(opts.length));
      q.set('lo', opts.lower ? '1' : '0');
      q.set('up', opts.upper ? '1' : '0');
      q.set('di', opts.digits ? '1' : '0');
      q.set('sy', opts.symbols ? '1' : '0');
      q.set('am', opts.excludeAmbiguous ? '0' : '1');
      q.set('nr', opts.noRepeat ? '1' : '0');
      window.history.replaceState(null, '', u.toString());
    } catch {
      /* ignore */
    }
  }, [opts]);

  const bits = useMemo(() => entropyBits(opts), [opts]);
  const strength = strengthLabel(bits);

  const set = <K extends keyof Options>(k: K, v: Options[K]) => setOpts((o) => ({ ...o, [k]: v }));

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="app">
      <header>
        <h1>Password Generator</h1>
        <p className="tag">
          Strong random passwords, made in your browser with the same secure random source used for
          encryption keys. Nothing is sent anywhere and nothing is stored.
        </p>
      </header>

      <div className="pwbox">
        <code className={anyClass ? '' : 'empty'}>{anyClass ? pw : 'pick at least one character type'}</code>
        <div className="pwacts">
          <button onClick={() => setNonce((n) => n + 1)} aria-label="New password">↻</button>
          <button className="primary" onClick={() => copy(pw, 'pw')} disabled={!anyClass}>{copied === 'pw' ? 'Copied' : 'Copy'}</button>
        </div>
      </div>

      {anyClass && (
        <div className="meter">
          <div className={`bar t-${strength.tone}`} style={{ width: `${Math.min(100, (bits / 100) * 100)}%` }} />
          <span className="mlabel">{strength.label} · ~{bits} bits · cracks in {crackTime(bits)}</span>
        </div>
      )}

      <div className="lenrow">
        <label>Length <b>{opts.length}</b></label>
        <input type="range" min={6} max={64} value={opts.length} onChange={(e) => set('length', Number(e.target.value))} />
      </div>

      <div className="toggles">
        {([
          ['lower', 'abc lowercase'],
          ['upper', 'ABC uppercase'],
          ['digits', '789 digits'],
          ['symbols', '!@# symbols'],
        ] as const).map(([k, label]) => (
          <label key={k} className="chk">
            <input type="checkbox" checked={opts[k]} onChange={(e) => set(k, e.target.checked)} /> {label}
          </label>
        ))}
        <label className="chk"><input type="checkbox" checked={opts.excludeAmbiguous} onChange={(e) => set('excludeAmbiguous', e.target.checked)} /> avoid look-alikes (0/O, 1/l/I)</label>
        <label className="chk"><input type="checkbox" checked={opts.noRepeat} onChange={(e) => set('noRepeat', e.target.checked)} /> no repeated character in a row</label>
      </div>

      <div className="batchrow">
        {batch.length === 0 ? (
          <button className="batchbtn" onClick={() => setBatch(Array.from({ length: 8 }, () => generate(opts)))} disabled={!anyClass}>
            Generate a batch
          </button>
        ) : (
          <>
            <button className="batchbtn" onClick={() => copy(batch.join('\n'), 'batch')}>{copied === 'batch' ? 'Copied all' : 'Copy all'}</button>
            <button className="batchbtn ghost" onClick={() => setBatch([])}>Hide</button>
          </>
        )}
      </div>
      {batch.length > 0 && (
        <div className="batchlist">
          {batch.map((b, i) => (
            <button key={i} className="brow" onClick={() => copy(b, `b${i}`)}>
              <code>{b}</code>
              <i>{copied === `b${i}` ? '✓' : 'copy'}</i>
            </button>
          ))}
        </div>
      )}

      <section className="explainer">
        <h2>What makes a password strong</h2>
        <p>
          Length and randomness — not clever substitutions. A truly random password's strength is
          roughly <code>length × log₂(alphabet size)</code> bits of entropy. Anything from about
          <strong> 70 bits</strong> is well beyond what an attacker with fast offline hardware can
          brute-force. A 20-character password from the full set here is around 130 bits.
        </p>
        <h3>The options</h3>
        <p>
          <strong>Avoid look-alikes</strong> drops characters that are easy to misread — zero and
          capital O, one and lowercase L and capital I — which matters if you'll ever type the
          password by hand. It costs a couple of bits of entropy; add length to make it back.
          <strong> No repeated character in a row</strong> is cosmetic, not a security feature. Every
          selected type is guaranteed to appear at least once.
        </p>
        <h3>Storing it</h3>
        <p>
          Use a password manager. A generated password you have to remember defeats the point — the
          right pattern is a unique random password per site, kept in a manager, protected by one
          strong passphrase you <em>do</em> memorise. This tool doesn't save anything; copy the
          password straight into your manager.
        </p>
        <h3>Is anything sent to a server?</h3>
        <p>
          No. Generation uses <code>crypto.getRandomValues</code> locally. There is no network
          request when you make a password, and nothing is written to storage except your chosen
          options.
        </p>
        <footer>Password Generator · no sign-up · nothing stored · works offline once loaded</footer>
      </section>
    </div>
  );
}
