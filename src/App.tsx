import { useMemo, useState } from 'react';
import { State, twoProportionZTest, isSignificant, encodeState, decodeState } from './abtest';

function defaultState(): State {
  return {
    controlVisitors: 1000,
    controlConversions: 100,
    variantVisitors: 1000,
    variantConversions: 120,
    alpha: 0.05,
  };
}

function readInitialState(): State {
  const params = new URLSearchParams(window.location.search);
  if ([...params.keys()].length === 0) return defaultState();
  return decodeState(params, defaultState());
}

export default function App() {
  const [state, setState] = useState<State>(readInitialState);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => twoProportionZTest(
    { visitors: state.controlVisitors, conversions: state.controlConversions },
    { visitors: state.variantVisitors, conversions: state.variantConversions },
  ), [state]);

  const significant = useMemo(() => isSignificant(result?.pValue ?? null, state.alpha), [result, state.alpha]);

  function update<K extends keyof State>(key: K, value: State[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  async function shareLink() {
    const params = encodeState(state);
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', `?${params.toString()}`);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <main className="page">
      <h1>A/B Test Significance Calculator</h1>
      <p className="lede">
        Is your variant's lift real, or just noise? Enter visitor and conversion counts for a
        control and a variant to run a two-proportion z-test.
      </p>

      <section className="panel">
        <h2>Control</h2>
        <div className="field-grid">
          <label className="field">
            <span>Visitors</span>
            <input type="number" step={10} value={state.controlVisitors} onChange={(e) => update('controlVisitors', e.target.valueAsNumber || 0)} />
          </label>
          <label className="field">
            <span>Conversions</span>
            <input type="number" step={1} value={state.controlConversions} onChange={(e) => update('controlConversions', e.target.valueAsNumber || 0)} />
          </label>
        </div>
      </section>

      <section className="panel">
        <h2>Variant</h2>
        <div className="field-grid">
          <label className="field">
            <span>Visitors</span>
            <input type="number" step={10} value={state.variantVisitors} onChange={(e) => update('variantVisitors', e.target.valueAsNumber || 0)} />
          </label>
          <label className="field">
            <span>Conversions</span>
            <input type="number" step={1} value={state.variantConversions} onChange={(e) => update('variantConversions', e.target.valueAsNumber || 0)} />
          </label>
        </div>
      </section>

      <section className="panel">
        <h2>Significance threshold</h2>
        <div className="preset-buttons">
          {[0.01, 0.05, 0.1].map((a) => (
            <button key={a} className={state.alpha === a ? 'active' : ''} onClick={() => update('alpha', a)}>α = {a}</button>
          ))}
        </div>
      </section>

      {!result ? (
        <section className="result warning">
          <p className="verdict">Both control and variant need at least 1 visitor.</p>
        </section>
      ) : (
        <section className={`result ${significant ? 'positive' : 'neutral'}`}>
          <div className="result-row">
            <div><div className="small-label">Control rate</div><div className="big-num">{(result.controlRate * 100).toFixed(2)}%</div></div>
            <div><div className="small-label">Variant rate</div><div className="big-num">{(result.variantRate * 100).toFixed(2)}%</div></div>
          </div>
          <div className="result-row secondary">
            <div><div className="small-label">Relative uplift</div><div className="mid-num">{result.relativeUpliftPct !== null ? `${result.relativeUpliftPct >= 0 ? '+' : ''}${result.relativeUpliftPct.toFixed(1)}%` : '—'}</div></div>
            <div><div className="small-label">p-value</div><div className="mid-num">{result.pValue !== null ? result.pValue.toFixed(4) : '—'}</div></div>
          </div>
          <p className="verdict-label">{significant ? '✅ Statistically significant' : '⚠️ Not statistically significant'}</p>
          <p className="verdict">
            {significant
              ? `At α = ${state.alpha}, the difference between control and variant is unlikely to be due to chance alone.`
              : `At α = ${state.alpha}, this result could plausibly be due to random chance — consider collecting more data before deciding.`}
          </p>
        </section>
      )}

      <div className="actions">
        <button className="share-btn" onClick={shareLink}>{copied ? 'Copied!' : 'Copy share link'}</button>
      </div>

      <section className="explainer">
        <h2>How this works</h2>
        <p>
          A two-proportion z-test compares the two conversion rates against a "pooled" rate assuming
          there's actually no difference between them, then measures how many standard errors apart
          the observed rates are (the z-score). The p-value is the probability of seeing a
          difference this large (or larger) purely by chance if there truly were no real effect —
          a small p-value means the observed lift is unlikely to be a fluke.
        </p>
        <h2>Frequently asked questions</h2>
        <h3>What significance level should I use?</h3>
        <p>
          α = 0.05 (a 5% chance of a false positive) is a common default, but α = 0.01 is more
          conservative for high-stakes decisions, and α = 0.10 is sometimes used for quick,
          lower-stakes experiments.
        </p>
        <h3>My result isn't significant — does that mean the variant doesn't work?</h3>
        <p>
          Not necessarily — it may mean you don't have enough data yet to detect a real but smaller
          effect. Consider running the test longer or on more visitors rather than concluding there's
          no effect at all.
        </p>
        <h3>Does this account for multiple testing or peeking at results early?</h3>
        <p>No — this is a single, one-time significance test. Checking results repeatedly as data comes in (rather than at a pre-planned sample size) inflates your real false-positive rate beyond the stated α.</p>
      </section>
    </main>
  );
}
