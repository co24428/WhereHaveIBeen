"use client";

import { useEffect, useRef } from "react";
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/maplibre";
import { MAP_STYLE } from "@/lib/mapStyle";

type LatLng = { lat: number; lng: number };

export default function PinMap({ pin, center, onPick }: { pin: LatLng | null; center: LatLng; onPick: (p: LatLng) => void }) {
  const ref = useRef<MapRef>(null);
  useEffect(() => {
    if (pin && ref.current) ref.current.easeTo({ center: [pin.lng, pin.lat], zoom: Math.max(ref.current.getZoom(), 16), duration: 400 });
  }, [pin?.lat, pin?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = pin ?? center;
  return (
    <Map
      ref={ref}
      mapStyle={MAP_STYLE}
      initialViewState={{ longitude: start.lng, latitude: start.lat, zoom: pin ? 16 : 12 }}
      style={{ width: "100%", height: "100%" }}
      onClick={(e) => onPick({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
      attributionControl={{ compact: true }}
      cooperativeGestures={false}
    >
      <NavigationControl position="top-right" showCompass={false} />
      {pin && (
        <Marker
          longitude={pin.lng}
          latitude={pin.lat}
          anchor="bottom"
          draggable
          onDragEnd={(e) => onPick({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
        >
          <div className="text-4xl leading-none drop-shadow">📍</div>
        </Marker>
      )}
    </Map>
  );
}
