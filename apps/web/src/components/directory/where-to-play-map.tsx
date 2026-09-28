"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle: string;
  href: string;
  kind: "structure" | "tournament";
};

/** Carte « Où jouer au Bénin » (Leaflet, tuiles OpenStreetMap), chargée côté navigateur. */
export function WhereToPlayMap({
  points,
  focus,
  label,
}: {
  points: MapPoint[];
  focus?: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: false }).setView([9.3, 2.3], 7);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      for (const p of points) {
        const marker = L.circleMarker([p.lat, p.lng], {
          radius: p.kind === "tournament" ? 9 : 7,
          color: p.kind === "tournament" ? "#6e1c2c" : "#1c1815",
          fillColor: p.kind === "tournament" ? "#b08b3e" : "#6e1c2c",
          fillOpacity: 0.9,
          weight: 2,
        }).addTo(map);
        const div = document.createElement("div");
        const a = document.createElement("a");
        a.href = p.href;
        a.textContent = p.title;
        a.style.fontWeight = "600";
        const small = document.createElement("div");
        small.textContent = p.subtitle;
        div.append(a, small);
        marker.bindPopup(div);
        if (focus && p.id === focus) {
          map.setView([p.lat, p.lng], 13);
          marker.openPopup();
        }
      }
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points, focus]);
  return (
    <div
      ref={ref}
      role="region"
      aria-label={label}
      className="h-[60vh] min-h-80 w-full rounded-lg border border-line"
    />
  );
}
