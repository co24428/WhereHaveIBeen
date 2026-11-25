"use client";

import { useId, useState } from "react";

export default function PeopleInput({
  value,
  onChange,
  suggestions,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  suggestions: string[];
  placeholder: string;
}) {
  const [text, setText] = useState("");
  const listId = useId();
  const add = (raw: string) => {
    const names = raw
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length) onChange([...new Set([...value, ...names])]);
    setText("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2 py-1.5 focus-within:ring-2 focus-within:ring-sky-300">
      {value.map((n) => (
        <span key={n} className="flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-2.5 pr-1 text-sm">
          {n}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== n))} className="rounded-full px-1 text-slate-400 hover:text-slate-700" aria-label={`Remove ${n}`}>
            ×
          </button>
        </span>
      ))}
      <input
        list={listId}
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          // picking from the datalist fills the whole value at once
          if (suggestions.includes(v) && !value.includes(v)) add(v);
          else setText(v);
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === ",") && !e.nativeEvent.isComposing) {
            e.preventDefault();
            add(text);
          } else if (e.key === "Backspace" && !text && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => text && add(text)}
        placeholder={value.length ? "" : placeholder}
        className="min-w-24 flex-1 bg-transparent py-1 text-base outline-none"
        enterKeyHint="done"
      />
      <datalist id={listId}>
        {suggestions.filter((s) => !value.includes(s)).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
