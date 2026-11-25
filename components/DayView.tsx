"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import dynamic from "next/dynamic";
import { deletePlace, reorderPlaces } from "@/app/actions/places";
import { categoryStyle, type Place } from "@/lib/types";
import PlaceDetails from "./PlaceDetails";

const PlaceMap = dynamic(() => import("./PlaceMap"), { ssr: false, loading: () => <div className="absolute inset-0 bg-slate-100" /> });

const DESKTOP = "(min-width: 768px)";
function subscribeDesktop(cb: () => void) {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

type Props = { date: string; initialPlaces: Place[]; fallbackCenter: { lat: number; lng: number } };

export default function DayView({ date, initialPlaces, fallbackCenter }: Props) {
  const t = useTranslations("map");
  const router = useRouter();
  const [places, setPlaces] = useState(initialPlaces);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(initialPlaces.length > 0);
  const isDesktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP).matches, () => false);
  const [, startTransition] = useTransition();

  // server data changed (router.refresh): reset local order
  const [prevInitial, setPrevInitial] = useState(initialPlaces);
  if (initialPlaces !== prevInitial) {
    setPrevInitial(initialPlaces);
    setPlaces(initialPlaces);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = places.findIndex((p) => p.id === active.id);
    const to = places.findIndex((p) => p.id === over.id);
    const next = arrayMove(places, from, to).map((p, i) => ({ ...p, visit_order: i + 1 }));
    setPlaces(next);
    startTransition(async () => {
      const r = await reorderPlaces(date, next.map((p) => p.id));
      if (!r.ok) router.refresh();
    });
  };

  const remove = (p: Place) => {
    if (!confirm(t("confirmDelete", { name: p.nickname || p.name }))) return;
    setPlaces((list) => list.filter((x) => x.id !== p.id));
    setSelectedId(null);
    startTransition(async () => {
      await deletePlace(p.id);
      router.refresh();
    });
  };

  const sheetOpen = open || isDesktop;
  const popup = (p: Place) => (
    <div>
      <PlaceDetails place={p} index={places.findIndex((x) => x.id === p.id) + 1} />
      <div className="mt-2 flex gap-2 border-t border-slate-100 pt-2 text-xs font-medium">
        <Link href={`/places/${p.id}/edit`} className="rounded-md bg-slate-900 px-2.5 py-1.5 text-white">
          {t("edit")}
        </Link>
        <button onClick={() => remove(p)} className="rounded-md px-2.5 py-1.5 text-rose-600 hover:bg-rose-50">
          {t("delete")}
        </button>
        {p.source_url && (
          <a href={p.source_url} target="_blank" rel="noreferrer" className="ml-auto rounded-md px-2 py-1.5 text-slate-500 hover:bg-slate-100">
            {t("open")} ↗
          </a>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative flex-1 overflow-hidden">
      <PlaceMap
        places={places}
        selectedId={selectedId}
        onSelect={setSelectedId}
        fallbackCenter={fallbackCenter}
        renderPopup={popup}
        bottomPadding={!isDesktop && sheetOpen ? 220 : 0}
        leftPadding={isDesktop ? 320 : 0}
      />

      {/* list: bottom sheet on phones, left panel on desktop */}
      <section
        className="absolute inset-x-0 bottom-0 z-20 flex max-h-[45%] flex-col rounded-t-2xl border-t border-slate-200 bg-white shadow-[0_-6px_24px_rgba(0,0,0,0.12)] pb-[env(safe-area-inset-bottom)]
                   md:inset-x-auto md:bottom-auto md:left-3 md:top-3 md:max-h-[calc(100%-1.5rem)] md:w-80 md:rounded-2xl md:border md:pb-0"
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 px-4 pb-2 pt-2 text-left md:cursor-default"
          aria-expanded={sheetOpen}
          aria-label={sheetOpen ? t("hideList") : t("showList")}
        >
          <span className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-300 md:hidden" />
          <span className="mt-2 text-sm font-semibold">{t("places", { count: places.length })}</span>
          {places.length > 1 && sheetOpen && <span className="mt-2 text-xs text-slate-400">· {t("dragHint")}</span>}
          <span className="ml-auto mt-2 text-slate-400 md:hidden">{sheetOpen ? "▾" : "▴"}</span>
        </button>

        {sheetOpen && (
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {places.length === 0 ? (
              <p className="px-2 py-3 text-sm text-slate-500">{t("empty")}</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={places.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  <ol className="space-y-1">
                    {places.map((p, i) => (
                      <Row key={p.id} place={p} index={i + 1} selected={p.id === selectedId} onSelect={() => setSelectedId(p.id)} />
                    ))}
                  </ol>
                </SortableContext>
              </DndContext>
            )}
            <Link
              href={`/add?date=${date}`}
              className="mt-2 flex items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              ＋ {t("addHere")}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ place, index, selected, onSelect }: { place: Place; index: number; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: place.id });
  const { color, icon } = categoryStyle(place.category);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-xl px-2 py-2 ${selected ? "bg-sky-50 ring-1 ring-sky-200" : "hover:bg-slate-50"} ${
        isDragging ? "relative z-10 bg-white shadow-lg" : ""
      }`}
    >
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold"
        style={place.status === "planned" ? { border: `2.5px solid ${color}`, color } : { background: color, color: "white" }}
      >
        {index}
      </span>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-medium">
          {icon} {place.nickname || place.name}
        </div>
        <div className="truncate text-xs text-slate-500">
          {[place.start_time, place.people.join(", "), place.memo].filter(Boolean).join(" · ") || place.address}
        </div>
      </button>
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="touch-none rounded-lg px-2 py-2 text-lg leading-none text-slate-400 hover:bg-slate-100 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        ≡
      </button>
    </li>
  );
}
