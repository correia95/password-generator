# password-generator

Strong random passwords generated locally with `crypto.getRandomValues` +
rejection sampling. Length slider, lower / upper / digits / symbols toggles,
"avoid look-alikes" (0/O, 1/l/I), "no repeated character in a row", a live
entropy meter with a crack-time gloss, and a batch mode. Guarantees at least one
of each selected class. Nothing is sent anywhere; only the chosen options are
saved.

**Live:** https://password-generator.correia95.workers.dev/

## Stack

- React 18 + TypeScript + Vite, no runtime deps beyond React
- Static-assets Cloudflare Worker

## Engine

[`src/gen.ts`](src/gen.ts): `generate(options)` places one required char per
selected class then fills from the pool, Fisher-Yates shuffles, and does a
no-repeat repair pass. `entropyBits` = `length * log2(poolSize)`; `crackTime`
glosses `2^(bits-1) / 1e11 guesses/sec`.

Verified in Node: 16-char full set contains all four classes, ~98 bits;
no-repeat produces no adjacent duplicates; digits-only works; no class selected
-> ""; 2000 generations all unique; crack-time is monotonic across 10-128 bits.

## Develop / deploy

```bash
npm install
npm run dev
npm run deploy
```
