# A/B Test Significance Calculator

Is your variant's lift real, or just noise? Enter visitor and
conversion counts for a control and a variant to run a
two-proportion z-test.

- Conversion rates, absolute and relative uplift, z-score, and
  two-tailed p-value
- Adjustable significance threshold (α = 0.01 / 0.05 / 0.10)
- Own from-scratch standard normal CDF (Abramowitz & Stegun erf
  approximation), cross-verified against published z-table values
- Shareable link (base64url-encoded)

## Develop

```
npm install
npm run dev
npm run build      # tsc --noEmit && vite build
node --experimental-strip-types --test src/abtest.test.mjs
```

The engine (`twoProportionZTest`, `standardNormalCdf`,
`isSignificant`) is in `src/abtest.ts`. 11 Node tests in
`src/abtest.test.mjs`, including cross-checks against well-known
published z-table values and a hand-computed classic A/B scenario.

## Deploy

Static assets on Cloudflare Workers (`wrangler.jsonc`). Live at
<https://ab-test-calculator.correia95.workers.dev/>.
