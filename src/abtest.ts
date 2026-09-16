export interface Variant {
  visitors: number;
  conversions: number;
}

export function conversionRate(v: Variant): number | null {
  if (v.visitors <= 0) return null;
  return v.conversions / v.visitors;
}

/**
 * Error function approximation (Abramowitz & Stegun 7.1.26), max error ~1.5e-7.
 */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

export function standardNormalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

export interface ZTestResult {
  controlRate: number;
  variantRate: number;
  absoluteUplift: number;
  relativeUpliftPct: number | null;
  zScore: number | null;
  pValue: number | null;
}

export function twoProportionZTest(control: Variant, variant: Variant): ZTestResult | null {
  const controlRate = conversionRate(control);
  const variantRate = conversionRate(variant);
  if (controlRate === null || variantRate === null) return null;

  const absoluteUplift = variantRate - controlRate;
  const relativeUpliftPct = controlRate > 0 ? (absoluteUplift / controlRate) * 100 : null;

  const pooled = (control.conversions + variant.conversions) / (control.visitors + variant.visitors);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / control.visitors + 1 / variant.visitors));

  if (se === 0) {
    return { controlRate, variantRate, absoluteUplift, relativeUpliftPct, zScore: null, pValue: null };
  }

  const zScore = absoluteUplift / se;
  const pValue = 2 * (1 - standardNormalCdf(Math.abs(zScore)));

  return { controlRate, variantRate, absoluteUplift, relativeUpliftPct, zScore, pValue };
}

export function isSignificant(pValue: number | null, alpha = 0.05): boolean {
  if (pValue === null) return false;
  return pValue < alpha;
}

export interface State {
  controlVisitors: number;
  controlConversions: number;
  variantVisitors: number;
  variantConversions: number;
  alpha: number;
}

function toUint8Array(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function toBase64Url(text: string): string {
  const bytes = toUint8Array(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeState(state: State): URLSearchParams {
  const params = new URLSearchParams();
  params.set('d', toBase64Url(JSON.stringify(state)));
  return params;
}

export function decodeState(params: URLSearchParams, fallback: State): State {
  const raw = params.get('d');
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(fromBase64Url(raw));
    if (
      typeof parsed !== 'object' || parsed === null ||
      typeof parsed.controlVisitors !== 'number' ||
      typeof parsed.variantVisitors !== 'number'
    ) {
      return fallback;
    }
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}
