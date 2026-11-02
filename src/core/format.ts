const SHORT_SUFFIXES = ['', 'K', 'M', 'B', 'T'];

// Suffix for the n-th thousand power beyond T: aa, ab, ..., az, ba, ...
function letterSuffix(index: number): string {
  const a = 'a'.charCodeAt(0);
  return String.fromCharCode(a + Math.floor(index / 26)) + String.fromCharCode(a + (index % 26));
}

// 1234 -> "1.23K", 5.6e15 -> "5.60aa". Values below 10 keep `smallDecimals` decimals.
export function formatNumber(value: number, smallDecimals = 1): string {
  if (!Number.isFinite(value)) return 'inf';
  if (value < 0) return `-${formatNumber(-value, smallDecimals)}`;
  if (value < 1000) {
    return value < 10 && value % 1 !== 0 ? value.toFixed(smallDecimals) : Math.floor(value).toString();
  }
  let power = Math.floor(Math.log10(value) / 3);
  let scaled = value / 1000 ** power;
  // Rounding can push 999.96 up to "1000"; move to the next suffix instead.
  if (scaled >= 999.995) {
    power++;
    scaled /= 1000;
  }
  const suffix = power < SHORT_SUFFIXES.length ? SHORT_SUFFIXES[power] : letterSuffix(power - SHORT_SUFFIXES.length);
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return scaled.toFixed(digits) + suffix;
}

// 3725 -> "1h 2m"
export function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
