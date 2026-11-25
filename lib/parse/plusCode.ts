// Decoder for full Open Location Codes ("Plus Codes"), e.g. "8Q98CX2H+2P3".
// Spec: https://github.com/google/open-location-code/blob/main/docs/specification.md

const ALPHABET = "23456789CFGHJMPQRVWX";
const PAIR_RESOLUTIONS = [20, 1, 0.05, 0.0025, 0.000125];
const GRID_ROWS = 5;
const GRID_COLS = 4;

/** Returns true for a *full* plus code (8 digits before "+"). Short codes need a reference location. */
export function isFullPlusCode(code: string): boolean {
  const c = code.toUpperCase().trim();
  return /^[23456789C][23456789CFGHJMPQRV][23456789CFGHJMPQRVWX]{6}\+[23456789CFGHJMPQRVWX]{0,7}$/.test(c);
}

/** Decodes a full plus code to the centre of its area. Returns null if invalid. */
export function decodePlusCode(code: string): { lat: number; lng: number } | null {
  if (!isFullPlusCode(code)) return null;
  const digits = code.toUpperCase().replace("+", "");
  if (digits.length < 8) return null;

  let lat = 0;
  let lng = 0;
  let latRes = 0;
  let lngRes = 0;
  const pairDigits = Math.min(digits.length, 10);
  for (let i = 0; i < pairDigits; i += 2) {
    const res = PAIR_RESOLUTIONS[i / 2];
    lat += ALPHABET.indexOf(digits[i]) * res;
    lng += ALPHABET.indexOf(digits[i + 1]) * res;
    latRes = lngRes = res;
  }
  for (let i = 10; i < digits.length; i++) {
    const d = ALPHABET.indexOf(digits[i]);
    latRes /= GRID_ROWS;
    lngRes /= GRID_COLS;
    lat += Math.floor(d / GRID_COLS) * latRes;
    lng += (d % GRID_COLS) * lngRes;
  }
  return { lat: lat - 90 + latRes / 2, lng: lng - 180 + lngRes / 2 };
}
