// Password generation. Every random choice comes from crypto.getRandomValues
// with rejection sampling so there's no modulo bias.

export const SETS = {
  lower: 'abcdefghijkmnopqrstuvwxyz', // no l
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ', // no I, O
  digits: '23456789', // no 0, 1
  symbols: '!@#$%^&*-_=+?',
};
export const AMBIG = {
  lower: 'l',
  upper: 'IO',
  digits: '01',
  symbols: '',
};

export interface Options {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean; // when false, add the ambiguous chars back in
  noRepeat: boolean; // no character used twice in a row
}

function randInt(n: number): number {
  const max = Math.floor(0xffffffff / n) * n;
  const buf = new Uint32Array(1);
  let x = 0;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= max);
  return x % n;
}

function pick(s: string): string {
  return s[randInt(s.length)];
}

export function poolFor(o: Options): string {
  let pool = '';
  (['lower', 'upper', 'digits', 'symbols'] as const).forEach((k) => {
    if (o[k]) pool += SETS[k] + (o.excludeAmbiguous ? '' : AMBIG[k]);
  });
  return pool;
}

export function generate(o: Options): string {
  const length = Math.max(4, Math.min(128, Math.floor(o.length) || 16));
  const activeKeys = (['lower', 'upper', 'digits', 'symbols'] as const).filter((k) => o[k]);
  if (activeKeys.length === 0) return '';
  const pool = poolFor(o);

  // guarantee at least one of each selected class
  const required: string[] = activeKeys.map((k) => pick(SETS[k] + (o.excludeAmbiguous ? '' : AMBIG[k])));

  const out: string[] = [];
  const push = (c: string) => {
    if (o.noRepeat && out.length && out[out.length - 1] === c) return false;
    out.push(c);
    return true;
  };

  // place the required chars first, then fill
  let guard = 0;
  for (const c of required) {
    while (!push(c) && guard++ < 200) required.push(pick(pool)); // shouldn't loop much
    if (out.length >= length) break;
  }
  guard = 0;
  while (out.length < length && guard++ < 5000) {
    push(pick(pool));
  }

  // shuffle so the required chars aren't stuck at the front (Fisher–Yates)
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  // noRepeat can be broken by the shuffle — do a light repair pass
  if (o.noRepeat) {
    for (let i = 1; i < out.length; i++) {
      if (out[i] === out[i - 1]) {
        for (let k = 0; k < 30; k++) {
          const c = pick(pool);
          if (c !== out[i - 1] && (i + 1 >= out.length || c !== out[i + 1])) {
            out[i] = c;
            break;
          }
        }
      }
    }
  }

  return out.slice(0, length).join('');
}

// entropy in bits: length * log2(poolSize)  (the required-chars constraint lowers
// it slightly, but this is the standard estimate)
export function entropyBits(o: Options): number {
  const size = poolFor(o).length;
  if (size < 2) return 0;
  return Math.round(Math.max(4, Math.min(128, o.length)) * Math.log2(size));
}

export function strengthLabel(bits: number): { label: string; tone: 'weak' | 'ok' | 'good' | 'strong' } {
  if (bits < 40) return { label: 'Weak', tone: 'weak' };
  if (bits < 60) return { label: 'Reasonable', tone: 'ok' };
  if (bits < 80) return { label: 'Strong', tone: 'good' };
  return { label: 'Very strong', tone: 'strong' };
}

// human crack-time gloss at ~1e11 guesses/sec (offline, fast hardware)
export function crackTime(bits: number): string {
  let v = Math.pow(2, bits - 1) / 1e11; // seconds
  // [divisor to reach the NEXT unit, name of the CURRENT unit]
  const steps: [number, string][] = [
    [60, 'seconds'],
    [60, 'minutes'],
    [24, 'hours'],
    [365, 'days'],
    [100, 'years'],
  ];
  for (const [div, name] of steps) {
    if (v < div) {
      if (name === 'seconds' && v < 1) return 'instant';
      return `about ${v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString()} ${name}`;
    }
    v /= div;
  }
  // v is now in centuries
  if (v > 1e12) return 'longer than the universe has existed';
  return `about ${v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString()} centuries`;
}
