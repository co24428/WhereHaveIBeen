// Parses whatever the user pastes: a bare link, app "share" text
// ("[카카오맵] 멘부쿠제면소 https://kko.to/…"), or a plain Korean address.

import { parseMapUrl, type LinkHints, type Source } from "./links";

export type PasteHints = {
  source: Source;
  name?: string;
  address?: string;
  link?: LinkHints;
  /** leftover text that could be a search query */
  query?: string;
};

const URL_RE = /https?:\/\/[^\s<>"'）)]+/gi;
const PREFIX_RE = /^\s*\[(카카오맵|카카오 맵|kakaomap|kakao map|네이버\s*지도|naver\s*map|google\s*maps?|구글\s*지도)\]\s*/i;

const SIDO =
  "서울특별시|서울시|서울|부산광역시|부산|대구광역시|대구|인천광역시|인천|광주광역시|광주|대전광역시|대전|울산광역시|울산|" +
  "세종특별자치시|세종|경기도|경기|강원특별자치도|강원도|강원|충청북도|충북|충청남도|충남|전북특별자치도|전라북도|전북|" +
  "전라남도|전남|경상북도|경북|경상남도|경남|제주특별자치도|제주도|제주";
const ADDRESS_RE = new RegExp(`^(?:${SIDO})(?:\\s|$)`);

/** True when a line looks like a Korean 도로명 / 지번 address. */
export function looksLikeKoreanAddress(line: string): boolean {
  const s = line.trim();
  if (!ADDRESS_RE.test(s)) return false;
  // needs a road (…로 / …길) or lot (…동 / …리 / 번지) followed by a number somewhere
  return /(로|길|동|리|가|읍|면)\s*\d/.test(s) || /\d+(-\d+)?\s*(번지)?\s*(\(|$)/.test(s);
}

/** "경기 의왕시 이미로 40 (포일동)" → "경기 의왕시 이미로 40" */
export function cleanAddress(line: string): string {
  return line
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceFromPrefix(p: string): Source {
  if (/카카오|kakao/i.test(p)) return "kakao";
  if (/네이버|naver/i.test(p)) return "naver";
  return "google";
}

export function parsePastedText(input: string): PasteHints {
  const text = input.replace(/\r/g, "").trim();
  const urls = text.match(URL_RE) ?? [];
  const link = urls.map((u) => parseMapUrl(u)).find((h) => h && h.source !== "unknown") ?? (urls[0] ? parseMapUrl(urls[0]) ?? undefined : undefined);

  let source: Source = link?.source ?? "unknown";
  const lines = text
    .split("\n")
    .map((l) => l.replace(URL_RE, "").trim())
    .map((l, i) => {
      if (i === 0 || PREFIX_RE.test(l)) {
        const m = l.match(PREFIX_RE);
        if (m) {
          source = source === "unknown" ? sourceFromPrefix(m[1]) : source;
          return l.replace(PREFIX_RE, "").trim();
        }
      }
      return l;
    })
    .filter(Boolean);

  const hints: PasteHints = { source, link };
  const addressLine = lines.find(looksLikeKoreanAddress);
  if (addressLine) hints.address = cleanAddress(addressLine);
  const others = lines.filter((l) => l !== addressLine);

  if (link?.name) hints.name = link.name;
  else if (others.length) hints.name = others[0];

  // nothing structured: treat the whole text as a search query
  if (!link && !hints.address && others.length) {
    hints.query = others.join(" ");
    hints.name = undefined;
  }
  return hints;
}
