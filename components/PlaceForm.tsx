"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { savePlace } from "@/app/actions/places";
import { statusForDate } from "@/lib/dates";
import { CATEGORIES, categoryStyle, type Candidate, type Category, type Place, type Status } from "@/lib/types";
import PeopleInput from "./PeopleInput";

const PinMap = dynamic(() => import("./PinMap"), { ssr: false, loading: () => <div className="h-full w-full bg-slate-100" /> });

type Props = {
  initial?: Place;
  date: string;
  today: string;
  peopleSuggestions: string[];
  center: { lat: number; lng: number };
  sharedText?: string;
};

type ResolveResponse = { candidates: Candidate[]; confident: boolean; warnings: string[] };

const input = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-sky-300";
const label = "mb-1 block text-sm font-medium text-slate-600";

export default function PlaceForm({ initial, date, today, peopleSuggestions, center, sharedText }: Props) {
  const t = useTranslations("form");
  const tc = useTranslations("category");
  const router = useRouter();
  const [saving, startSaving] = useTransition();

  // location
  const [pin, setPin] = useState(initial ? { lat: initial.lat, lng: initial.lng } : null);
  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [jibun, setJibun] = useState(initial?.jibun_address ?? "");
  const [sourceUrl, setSourceUrl] = useState(initial?.source_url ?? "");
  const [kakaoId, setKakaoId] = useState(initial?.kakao_place_id ?? "");
  const [via, setVia] = useState<Candidate["via"] | null>(null);

  // details
  const [visitDate, setVisitDate] = useState(initial?.visit_date ?? date);
  const [status, setStatus] = useState<Status>(initial?.status ?? statusForDate(date, today));
  const statusTouched = useRef(!!initial);
  const [nickname, setNickname] = useState(initial?.nickname ?? "");
  const [startTime, setStartTime] = useState(initial?.start_time ?? "");
  const [endTime, setEndTime] = useState(initial?.end_time ?? "");
  const [people, setPeople] = useState<string[]>(initial?.people ?? []);
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [category, setCategory] = useState<Category | null>((initial?.category as Category) ?? null);
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [cost, setCost] = useState(initial?.cost != null ? String(initial.cost) : "");
  const [showMore, setShowMore] = useState(!!(initial && (initial.rating || initial.cost != null || initial.start_time)));

  // paste / search
  const [paste, setPaste] = useState(sharedText ?? "");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<"read" | "search" | null>(null);
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const apply = (c: Candidate) => {
    setPin({ lat: c.lat, lng: c.lng });
    if (c.name) setName(c.name);
    setAddress(c.address ?? "");
    setJibun(c.jibunAddress ?? "");
    if (c.sourceUrl) setSourceUrl(c.sourceUrl);
    setKakaoId(c.kakaoPlaceId ?? "");
    if (c.category && !category) setCategory(c.category);
    setVia(c.via);
    setResults(null);
  };

  const read = async (text = paste) => {
    if (!text.trim()) return;
    setBusy("read");
    setWarnings([]);
    setResults(null);
    try {
      const res = await fetch("/api/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      const data = (await res.json()) as ResolveResponse;
      setWarnings(data.warnings ?? []);
      if (data.candidates?.length && data.confident) apply(data.candidates[0]);
      else setResults(data.candidates ?? []);
      // keep the original link even when the user picks from a list
      const url = text.match(/https?:\/\/\S+/)?.[0];
      if (url) setSourceUrl(url);
    } catch {
      setWarnings(["lookupFailed"]);
    } finally {
      setBusy(null);
    }
  };

  const search = async () => {
    if (!query.trim()) return;
    setBusy("search");
    setWarnings([]);
    try {
      const near = pin ?? center;
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&lat=${near.lat}&lng=${near.lng}`);
      const data = await res.json();
      if (data.error) setWarnings([data.error]);
      setResults(data.candidates ?? []);
    } catch {
      setWarnings(["lookupFailed"]);
    } finally {
      setBusy(null);
    }
  };

  const pickOnMap = async (p: { lat: number; lng: number }) => {
    setPin(p);
    setVia("pin");
    setKakaoId("");
    try {
      const res = await fetch(`/api/reverse?lat=${p.lat}&lng=${p.lng}`);
      const a = await res.json();
      setAddress(a.address ?? "");
      setJibun(a.jibunAddress ?? "");
      if (!name && a.building) setName(a.building);
    } catch {
      /* address stays empty */
    }
  };

  // share target: read automatically
  useEffect(() => {
    if (!sharedText) return;
    const id = setTimeout(() => read(sharedText), 0);
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onDateChange = (v: string) => {
    setVisitDate(v);
    if (!statusTouched.current && v) setStatus(statusForDate(v, today));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!pin || !name.trim()) {
      setError(t("required"));
      return;
    }
    startSaving(async () => {
      const r = await savePlace({
        id: initial?.id,
        visit_date: visitDate,
        status,
        nickname: nickname || null,
        name: name.trim(),
        address: address || null,
        jibun_address: jibun || null,
        lat: pin.lat,
        lng: pin.lng,
        start_time: startTime || null,
        end_time: endTime || null,
        category,
        memo: memo || null,
        rating,
        cost: cost === "" ? null : Number(cost),
        source_url: /^https?:\/\//.test(sourceUrl) ? sourceUrl : null,
        kakao_place_id: kakaoId || null,
        people,
      });
      if (r.ok) {
        router.push(`/map?date=${r.date}`);
        router.refresh();
      } else {
        setError(t("errorSave", { error: r.error }));
      }
    });
  };

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-xl space-y-5 px-3 py-4 pb-28">
      <h1 className="text-lg font-bold">{initial ? t("titleEdit") : t("titleAdd")}</h1>

      {/* 1. find the location */}
      <section className="space-y-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div>
          <label className={label} htmlFor="paste">
            {t("pasteLabel")}
          </label>
          <textarea
            id="paste"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (text) setTimeout(() => read(text), 0);
            }}
            rows={2}
            placeholder={t("pastePlaceholder")}
            className={`${input} resize-none text-sm`}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (text) {
                    setPaste(text);
                    read(text);
                  }
                } catch {
                  document.getElementById("paste")?.focus();
                }
              }}
              className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white active:bg-slate-700"
            >
              📋 {t("pasteButton")}
            </button>
            <button
              type="button"
              onClick={() => read()}
              disabled={!paste.trim() || busy !== null}
              className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold disabled:opacity-40"
            >
              {busy === "read" ? t("reading") : t("readButton")}
            </button>
          </div>
        </div>

        <div>
          <label className={label} htmlFor="q">
            {t("searchLabel")}
          </label>
          <div className="flex gap-2">
            <input
              id="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  search();
                }
              }}
              placeholder={t("searchPlaceholder")}
              className={input}
              enterKeyHint="search"
            />
            <button type="button" onClick={search} disabled={busy !== null} className="shrink-0 rounded-xl border border-slate-300 px-4 text-sm font-semibold disabled:opacity-40">
              {busy === "search" ? "…" : t("search")}
            </button>
          </div>
        </div>

        {warnings.map((w) => (
          <p key={w} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {t.has(`warn.${w}`) ? t(`warn.${w}` as "warn.lookupFailed") : w}
          </p>
        ))}

        {results && (
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">{results.length ? t("pickOne") : t("noResults")}</p>
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
              {results.map((c, i) => (
                <li key={`${c.kakaoPlaceId ?? c.name}-${i}`}>
                  <button type="button" onClick={() => apply(c)} className="w-full px-3 py-2 text-left hover:bg-sky-50">
                    <div className="text-sm font-medium">
                      {c.category ? categoryStyle(c.category).icon : "📍"} {c.name}
                    </div>
                    <div className="text-xs text-slate-500">{c.address}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="relative h-56 overflow-hidden rounded-xl ring-1 ring-slate-200">
          <PinMap pin={pin} center={center} onPick={pickOnMap} />
        </div>
        <p className="text-xs text-slate-500">
          {pin ? (
            <>
              {via && <span className="mr-1 rounded bg-sky-100 px-1.5 py-0.5 font-medium text-sky-800">{t(`via.${via}`)}</span>}
              {t("pinHint")} <span className="text-slate-400">({pin.lat.toFixed(5)}, {pin.lng.toFixed(5)})</span>
            </>
          ) : (
            t("noLocation")
          )}
        </p>

        <div>
          <label className={label} htmlFor="name">
            {t("name")}
          </label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={input} required />
        </div>
        <div>
          <label className={label} htmlFor="address">
            {t("address")}
          </label>
          <input id="address" value={address} onChange={(e) => setAddress(e.target.value)} className={`${input} text-sm`} />
          {jibun && <p className="mt-1 px-1 text-xs text-slate-400">{jibun}</p>}
        </div>
      </section>

      {/* 2. details */}
      <section className="space-y-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="date">
              {t("date")}
            </label>
            <input id="date" type="date" value={visitDate} onChange={(e) => onDateChange(e.target.value)} className={input} required />
          </div>
          <div>
            <span className={label}>{t("status")}</span>
            <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-300 text-sm font-medium">
              {(["visited", "planned"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    statusTouched.current = true;
                    setStatus(s);
                  }}
                  className={`py-2.5 ${status === s ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}
                >
                  {s === "visited" ? t("went") : t("willGo")}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className={label} htmlFor="nickname">
            {t("nickname")}
          </label>
          <input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={t("nicknamePlaceholder")} className={input} />
        </div>

        <div>
          <span className={label}>{t("people")}</span>
          <PeopleInput value={people} onChange={setPeople} suggestions={peopleSuggestions} placeholder={t("peoplePlaceholder")} />
        </div>

        <div>
          <label className={label} htmlFor="memo">
            {t("memo")}
          </label>
          <textarea id="memo" value={memo} onChange={(e) => setMemo(e.target.value)} rows={3} className={`${input} resize-y`} />
        </div>

        <div>
          <span className={label}>{t("category")}</span>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => {
              const s = categoryStyle(c);
              const on = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(on ? null : c)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${on ? "text-white" : "border-slate-300 bg-white text-slate-700"}`}
                  style={on ? { background: s.color, borderColor: s.color } : undefined}
                >
                  {s.icon} {tc(c)}
                </button>
              );
            })}
          </div>
        </div>

        {!showMore ? (
          <button type="button" onClick={() => setShowMore(true)} className="text-sm font-medium text-sky-700">
            ＋ {t("more")}
          </button>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="start">
                  {t("startTime")}
                </label>
                <input id="start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={input} />
              </div>
              <div>
                <label className={label} htmlFor="end">
                  {t("endTime")}
                </label>
                <input id="end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={input} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className={label}>{t("rating")}</span>
                <div className="flex text-2xl">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(rating === n ? null : n)}
                      className={`px-0.5 ${rating && n <= rating ? "text-amber-400" : "text-slate-300"}`}
                      aria-label={`${n}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={label} htmlFor="cost">
                  {t("cost")}
                </label>
                <input id="cost" type="number" inputMode="numeric" min={0} value={cost} onChange={(e) => setCost(e.target.value)} className={input} />
              </div>
            </div>
          </>
        )}
      </section>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-2">
          <button type="button" onClick={() => router.back()} className="rounded-xl border border-slate-300 px-5 py-3 font-semibold">
            {t("cancel")}
          </button>
          <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-sky-600 py-3 font-semibold text-white disabled:opacity-60">
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </form>
  );
}
