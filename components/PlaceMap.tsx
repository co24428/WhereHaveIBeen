"use client";

import { useEffect, useMemo, useRef } from "react";
import Map, { Layer, Marker, NavigationControl, GeolocateControl, Popup, Source, type MapRef } from "react-map-gl/maplibre";
import { MAP_STYLE } from "@/lib/mapStyle";
import { categoryStyle, type Place } from "@/lib/types";

type Props = {
  places: Place[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  fallbackCenter: { lat: number; lng: number };
  renderPopup: (p: Place) => React.ReactNode;
  /** extra bottom padding (px) so markers aren't hidden under the sheet */
  bottomPadding?: number;
  leftPadding?: number;
};

export default function PlaceMap({ places, selectedId, onSelect, fallbackCenter, renderPopup, bottomPadding = 0, leftPadding = 0 }: Props) {
  const ref = useRef<MapRef>(null);
  const selected = places.find((p) => p.id === selectedId) ?? null;

  const route = useMemo(
    () => ({
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: places.map((p) => [p.lng, p.lat]) },
    }),
    [places]
  );

  // fit to all places whenever the set of places changes
  const placesKey = places.map((p) => `${p.id}:${p.lat}:${p.lng}`).join("|");
  const fit = () => {
    const map = ref.current;
    if (!map || !places.length) return;
    const padding = { top: 60, bottom: 60 + bottomPadding, left: 40 + leftPadding, right: 40 };
    if (places.length === 1) {
      map.easeTo({ center: [places[0].lng, places[0].lat], zoom: 15, padding, duration: 500 });
      return;
    }
    const lngs = places.map((p) => p.lng);
    const lats = places.map((p) => p.lat);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding, maxZoom: 16, duration: 500 }
    );
  };
  useEffect(fit, [placesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selected && ref.current) {
      ref.current.easeTo({ center: [selected.lng, selected.lat], duration: 400, padding: { top: 0, left: leftPadding, right: 0, bottom: bottomPadding } });
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const first = places[0] ?? fallbackCenter;
  return (
    <Map
      ref={ref}
      mapStyle={MAP_STYLE}
      initialViewState={{ longitude: first.lng, latitude: first.lat, zoom: places.length ? 14 : 12 }}
      style={{ position: "absolute", inset: 0 }}
      onLoad={fit}
      onClick={() => onSelect(null)}
      attributionControl={{ compact: true }}
    >
      <NavigationControl position="top-right" showCompass={false} />
      <GeolocateControl position="top-right" />
      {places.length > 1 && (
        <Source id="route" type="geojson" data={route}>
          <Layer
            id="route-line"
            type="line"
            layout={{ "line-join": "round", "line-cap": "round" }}
            paint={{ "line-color": "#0f172a", "line-width": 3, "line-opacity": 0.55, "line-dasharray": [2, 1.5] }}
          />
        </Source>
      )}
      {places.map((p, i) => {
        const { color } = categoryStyle(p.category);
        return (
          <Marker
            key={p.id}
            longitude={p.lng}
            latitude={p.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelect(p.id);
            }}
          >
            <div
              className={`pin ${p.status === "planned" ? "planned" : ""} ${p.id === selectedId ? "selected" : ""}`}
              style={p.status === "planned" ? { color, borderColor: color } : { background: color }}
              title={p.nickname || p.name}
            >
              {i + 1}
            </div>
          </Marker>
        );
      })}
      {selected && (
        <Popup
          longitude={selected.lng}
          latitude={selected.lat}
          anchor="bottom"
          offset={22}
          closeOnClick={false}
          onClose={() => onSelect(null)}
          maxWidth="280px"
        >
          {renderPopup(selected)}
        </Popup>
      )}
    </Map>
  );
}
