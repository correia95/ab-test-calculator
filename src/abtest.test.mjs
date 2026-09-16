import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  conversionRate, standardNormalCdf, twoProportionZTest, isSignificant, encodeState, decodeState,
} from './abtest.ts';

test('conversionRate divides conversions by visitors', () => {
  assert.equal(conversionRate({ visitors: 1000, conversions: 100 }), 0.1);
});

test('conversionRate returns null for zero or negative visitors', () => {
  assert.equal(conversionRate({ visitors: 0, conversions: 0 }), null);
});

test('standardNormalCdf matches well-known published z-table values', () => {
  assert.ok(Math.abs(standardNormalCdf(0) - 0.5) < 1e-4);
  assert.ok(Math.abs(standardNormalCdf(1.96) - 0.9750) < 1e-3);
  assert.ok(Math.abs(standardNormalCdf(1.64) - 0.9495) < 1e-3);
  assert.ok(Math.abs(standardNormalCdf(2.58) - 0.9951) < 1e-3);
  assert.ok(Math.abs(standardNormalCdf(-1.96) - 0.0250) < 1e-3);
});

test('twoProportionZTest: control and variant conversion rates and uplift', () => {
  const control = { visitors: 1000, conversions: 100 };
  const variant = { visitors: 1000, conversions: 120 };
  const result = twoProportionZTest(control, variant);
  assert.equal(result.controlRate, 0.1);
  assert.equal(result.variantRate, 0.12);
  assert.ok(Math.abs(result.absoluteUplift - 0.02) < 1e-9);
  assert.ok(Math.abs(result.relativeUpliftPct - 20) < 1e-9); // 0.02 / 0.10 * 100
});

test('twoProportionZTest: z-score and p-value match hand computation for a classic example', () => {
  const control = { visitors: 1000, conversions: 100 };
  const variant = { visitors: 1000, conversions: 120 };
  const result = twoProportionZTest(control, variant);
  // pooled = 220/2000 = 0.11; SE = sqrt(0.11*0.89*(1/1000+1/1000)) ~= 0.013993
  // z = 0.02 / 0.013993 ~= 1.4293
  assert.ok(Math.abs(result.zScore - 1.4293) < 0.001, `expected z~1.4293, got ${result.zScore}`);
  // Not significant at the conventional 5% level for this sample size
  assert.ok(result.pValue > 0.05);
});

test('twoProportionZTest: an obviously large, well-powered difference is significant', () => {
  const control = { visitors: 10000, conversions: 1000 }; // 10%
  const variant = { visitors: 10000, conversions: 1300 }; // 13%
  const result = twoProportionZTest(control, variant);
  assert.ok(result.pValue < 0.001);
  assert.ok(isSignificant(result.pValue));
});

test('twoProportionZTest: identical rates produce a z-score of exactly zero', () => {
  const control = { visitors: 1000, conversions: 100 };
  const variant = { visitors: 500, conversions: 50 };
  const result = twoProportionZTest(control, variant);
  assert.equal(result.zScore, 0);
  assert.ok(Math.abs(result.pValue - 1) < 1e-6, `expected ~1, got ${result.pValue}`);
});

test('twoProportionZTest returns null when either variant has zero visitors', () => {
  assert.equal(twoProportionZTest({ visitors: 0, conversions: 0 }, { visitors: 100, conversions: 10 }), null);
});

test('isSignificant compares p-value against alpha', () => {
  assert.equal(isSignificant(0.03, 0.05), true);
  assert.equal(isSignificant(0.08, 0.05), false);
  assert.equal(isSignificant(null), false);
});

test('encodeState / decodeState round-trips a full scenario', () => {
  const state = { controlVisitors: 1000, controlConversions: 100, variantVisitors: 1000, variantConversions: 120, alpha: 0.05 };
  const params = encodeState(state);
  const fallback = { controlVisitors: 0, controlConversions: 0, variantVisitors: 0, variantConversions: 0, alpha: 0.1 };
  const decoded = decodeState(params, fallback);
  assert.deepEqual(decoded, state);
});

test('decodeState falls back safely on missing or corrupted data', () => {
  const fallback = { controlVisitors: 1, controlConversions: 2, variantVisitors: 3, variantConversions: 4, alpha: 0.05 };
  assert.deepEqual(decodeState(new URLSearchParams(), fallback), fallback);
  assert.deepEqual(decodeState(new URLSearchParams('d=not-valid-base64url!!!'), fallback), fallback);
});
