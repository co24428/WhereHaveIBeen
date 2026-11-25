import { describe, expect, it } from "vitest";
import { decodePlusCode, isFullPlusCode } from "./plusCode";
import { parseMapUrl } from "./links";
import { cleanAddress, looksLikeKoreanAddress, parsePastedText } from "./shareText";

// Real link shared by the user (인덕원비빔국수 안양본점)
const GOOGLE_PLUSCODE =
  "https://www.google.com/maps/place/%EC%9D%B8%EB%8D%95%EC%9B%90%EB%B9%84%EB%B9%94%EA%B5%AD%EC%88%98+%EC%95%88%EC%96%91%EB%B3%B8%EC%A0%90/data=!4m4!3m3!1s0x357b5e489c2e2d51:0x4759f0a4975dd4c1!16s%2Fg%2F1tdy2d4b!20s8Q98CX2H%2B2P3?entry=ttu&g_ep=EgoyMDI2MTEyMi4wIKXMDSoASAFQAw%3D%3D";

describe("plus codes", () => {
  it("decodes the sample code", () => {
    const r = decodePlusCode("8Q98CX2H+2P3")!;
    expect(r.lat).toBeCloseTo(37.40001, 4);
    expect(r.lng).toBeCloseTo(126.9793, 4);
  });
  it("decodes the grid origin per the spec", () => {
    // "22222222+" is the 0.0025° cell at the south-west corner of the world
    const r = decodePlusCode("22222222+")!;
    expect(r.lat).toBeCloseTo(-90 + 0.00125, 9);
    expect(r.lng).toBeCloseTo(-180 + 0.00125, 9);
  });
  it("rejects short codes", () => {
    expect(isFullPlusCode("CX2H+2P")).toBe(false);
    expect(decodePlusCode("CX2H+2P")).toBeNull();
  });
});

describe("Google Maps links", () => {
  it("reads name + plus code from the user's sample", () => {
    const h = parseMapUrl(GOOGLE_PLUSCODE)!;
    expect(h.source).toBe("google");
    expect(h.name).toBe("인덕원비빔국수 안양본점");
    expect(h.precision).toBe("exact");
    expect(h.lat).toBeCloseTo(37.40001, 4);
    expect(h.lng).toBeCloseTo(126.9793, 4);
  });
  it("prefers the !3d!4d pin over the @ viewport", () => {
    const h = parseMapUrl(
      "https://www.google.com/maps/place/Blue+Bottle/@37.5440,127.0500,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d37.5446!4d127.0581!16s%2Fg%2F11"
    )!;
    expect(h.name).toBe("Blue Bottle");
    expect(h).toMatchObject({ lat: 37.5446, lng: 127.0581, precision: "exact" });
  });
  it("falls back to @ viewport", () => {
    const h = parseMapUrl("https://www.google.com/maps/place/Foo/@37.1,127.2,15z")!;
    expect(h).toMatchObject({ lat: 37.1, lng: 127.2, precision: "approx" });
  });
  it("reads ?q=lat,lng and ?q=text", () => {
    expect(parseMapUrl("https://maps.google.com/?q=37.5,127.01")).toMatchObject({ lat: 37.5, lng: 127.01, precision: "exact" });
    expect(parseMapUrl("https://www.google.com/maps?q=Blue+Bottle+Seongsu")).toMatchObject({ query: "Blue Bottle Seongsu" });
  });
  it("reads /maps/search/lat,lng", () => {
    expect(parseMapUrl("https://www.google.com/maps/search/37.4,126.9")).toMatchObject({ lat: 37.4, lng: 126.9 });
  });
  it("flags short links", () => {
    expect(parseMapUrl("https://maps.app.goo.gl/AbC123")).toMatchObject({ source: "google", isShortLink: true });
  });
});

describe("Kakao / Naver links", () => {
  it("flags kakao short links", () => {
    expect(parseMapUrl("https://kko.to/Iqc4jhs73Q")).toMatchObject({ source: "kakao", isShortLink: true });
  });
  it("reads kakao place ids", () => {
    expect(parseMapUrl("https://place.map.kakao.com/12345678")).toMatchObject({ kakaoPlaceId: "12345678" });
    expect(parseMapUrl("https://map.kakao.com/?itemId=987654")).toMatchObject({ kakaoPlaceId: "987654" });
  });
  it("reads kakao link/map name,lat,lng", () => {
    expect(parseMapUrl("https://map.kakao.com/link/map/%EC%B9%B4%ED%8E%98,37.4,127.1")).toMatchObject({
      name: "카페",
      lat: 37.4,
      lng: 127.1,
    });
  });
  it("reads naver place id and lat/lng", () => {
    expect(parseMapUrl("https://map.naver.com/p/entry/place/1234567?lng=127.05&lat=37.54")).toMatchObject({
      source: "naver",
      naverPlaceId: "1234567",
      lat: 37.54,
      lng: 127.05,
    });
  });
  it("ignores unrelated hosts", () => {
    expect(parseMapUrl("https://example.com/x")).toMatchObject({ source: "unknown" });
    expect(parseMapUrl("not a url")).toBeNull();
  });
});

describe("pasted share text", () => {
  it("reads the user's Kakao sample (both forms)", () => {
    const h = parsePastedText("[카카오맵] 멘부쿠제면소 https://kko.to/Iqc4jhs73Q\n\n경기 의왕시 이미로 40 (포일동)");
    expect(h.source).toBe("kakao");
    expect(h.name).toBe("멘부쿠제면소");
    expect(h.address).toBe("경기 의왕시 이미로 40");
    expect(h.link?.isShortLink).toBe(true);
  });
  it("reads form A alone", () => {
    const h = parsePastedText("[카카오맵] 멘부쿠제면소 https://kko.to/Iqc4jhs73Q");
    expect(h).toMatchObject({ source: "kakao", name: "멘부쿠제면소" });
    expect(h.address).toBeUndefined();
  });
  it("reads form B (address only)", () => {
    const h = parsePastedText("경기 의왕시 이미로 40 (포일동)");
    expect(h.address).toBe("경기 의왕시 이미로 40");
    expect(h.name).toBeUndefined();
  });
  it("reads naver-style multi-line share", () => {
    const h = parsePastedText("[네이버 지도]\n멘부쿠제면소\n경기 의왕시 이미로 40\nhttps://naver.me/abcd");
    expect(h).toMatchObject({ source: "naver", name: "멘부쿠제면소", address: "경기 의왕시 이미로 40" });
  });
  it("reads a bare google link", () => {
    const h = parsePastedText(GOOGLE_PLUSCODE);
    expect(h.name).toBe("인덕원비빔국수 안양본점");
    expect(h.link?.lat).toBeCloseTo(37.4, 2);
  });
  it("treats other text as a search query", () => {
    expect(parsePastedText("성수 블루보틀")).toMatchObject({ query: "성수 블루보틀" });
  });
});

describe("address helpers", () => {
  it("detects addresses", () => {
    expect(looksLikeKoreanAddress("서울특별시 성동구 아차산로 7")).toBe(true);
    expect(looksLikeKoreanAddress("경기 안양시 동안구 관양동 1488-2")).toBe(true);
    expect(looksLikeKoreanAddress("멘부쿠제면소")).toBe(false);
    expect(looksLikeKoreanAddress("서울 맛집")).toBe(false);
  });
  it("cleans trailing dong in parentheses", () => {
    expect(cleanAddress("경기 의왕시 이미로 40 (포일동)")).toBe("경기 의왕시 이미로 40");
  });
});
