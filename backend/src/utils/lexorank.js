// Minimal lexorank for ordering issues inside a status column.
// Strings compared lexicographically; we insert between neighbours by
// averaging codepoints (lowercase a–z + 0–9). Uses alphabet length 36.

const ALPHA = 'abcdefghijklmnopqrstuvwxyz';
const MIN = 'a';
const MAX = 'z';

function charToInt(c) {
  const i = ALPHA.indexOf(c);
  return i === -1 ? 0 : i;
}

function intToChar(i) {
  const bounded = Math.max(0, Math.min(ALPHA.length - 1, i));
  return ALPHA[bounded];
}

export function rankBetween(a, b) {
  const left = a || '';
  const right = b || '';
  if (left && right && left >= right) {
    throw new Error(`rankBetween: left (${left}) must be < right (${right})`);
  }

  let result = '';
  const max = Math.max(left.length, right.length) + 1;

  for (let i = 0; i < max; i++) {
    const lc = i < left.length ? charToInt(left[i]) : 0;
    const rc = i < right.length ? charToInt(right[i]) : ALPHA.length;
    if (rc - lc > 1) {
      result += intToChar(Math.floor((lc + rc) / 2));
      return result;
    }
    result += intToChar(lc);
  }
  // If we exhausted without finding a gap, append a middle char.
  return result + intToChar(Math.floor(ALPHA.length / 2));
}

export function rankInitial(index) {
  // Spread initial items out: m, aa, ab, ac... unused typically because we
  // always compute via rankBetween(last, null). Kept for seeding.
  if (index === 0) return 'm';
  let n = index;
  let s = '';
  while (n > 0) {
    s = ALPHA[n % ALPHA.length] + s;
    n = Math.floor(n / ALPHA.length);
  }
  return s || 'a';
}

export { MIN as RANK_MIN, MAX as RANK_MAX };
