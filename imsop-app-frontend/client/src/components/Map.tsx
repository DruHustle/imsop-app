/// <reference types="@types/google.maps" />

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import land from "@/assets/world-land.json";
import { MapAsset } from "@/lib/map-types";
import { statusColor } from "@/lib/overview";
import { Button } from "./ui/button";
const Globe = lazy(() => import("./Globe"));

import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";

declare global {
  interface Window {
    google?: typeof google;
    initGoogleMaps?: () => void;
    gm_authFailure?: () => void;
  }
}

// Use environment variable for Google Maps API key
// Users should set VITE_GOOGLE_MAPS_API_KEY in their .env file
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
let mapScriptPromise: Promise<void> | null = null;

function loadMapScript(): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (!API_KEY)
    return Promise.reject(new Error("Google Maps API key is not configured"));
  if (mapScriptPromise) return mapScriptPromise;

  const scriptPromise = new Promise<void>((resolve, reject) => {
    let settled = false;
    let timeoutId: number | undefined;
    const previousInit = window.initGoogleMaps;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (window.initGoogleMaps === onReady)
        window.initGoogleMaps = previousInit;

      if (error) reject(error);
      else resolve();
    };

    const onReady = () => {
      if (window.google?.maps) finish();
      else finish(new Error("Google Maps loaded without initializing"));
    };
    const onLoad = () => {
      if (window.google?.maps) finish();
      else finish(new Error("Google Maps loaded without initializing"));
    };
    const onError = () => finish(new Error("Failed to load Google Maps"));

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    );
    const script = existingScript ?? document.createElement("script");

    if (!existingScript) {
      window.initGoogleMaps = onReady;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&v=weekly&libraries=marker,places,geocoding,geometry&callback=initGoogleMaps`;
      script.async = true;
      script.defer = true;
    }

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    timeoutId = window.setTimeout(
      () => finish(new Error("Timed out while loading Google Maps")),
      15_000
    );

    if (!existingScript) document.head.appendChild(script);
  });

  mapScriptPromise = scriptPromise.catch((error: unknown) => {
    mapScriptPromise = null;
    throw error;
  });

  return mapScriptPromise;
}

interface MapViewProps {
  className?: string;
  assets?: MapAsset[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  compact?: boolean;
}
const landPaths = land.map(
  ring =>
    ring
      .map(
        ([lng, lat], i) =>
          `${i ? "L" : "M"}${(lng + 180) * 2},${(90 - lat) * 2}`
      )
      .join(" ") + "Z"
);
export function MapView({
  className,
  assets = [],
  selectedId,
  onSelect,
  compact = false,
}: MapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [status, setStatus] = useState<"loading" | "google" | "fallback">(
    "loading"
  );
  const [view, setView] = useState<"map" | "globe">("map"),
    [globeFailed, setGlobeFailed] = useState(false);
  const { theme } = useTheme();
  const valid = assets.filter(
    a =>
      Number.isFinite(a.position.lat) &&
      Number.isFinite(a.position.lng) &&
      Math.abs(a.position.lat) <= 90 &&
      Math.abs(a.position.lng) <= 180
  );
  const select = (id: string) => {
    if (onSelect) onSelect(id);
    else {
      const a = valid.find(a => a.id === id);
      window.location.hash = a?.href ?? `/supply-chain/shipments/${id}`;
    }
  };
  useEffect(() => {
    let active = true;
    const previous = window.gm_authFailure;
    const fail = () => {
      if (active) setStatus("fallback");
    };
    window.gm_authFailure = fail;
    void loadMapScript()
      .then(() => {
        if (!active || !container.current || !window.google?.maps) return;
        map.current = new window.google.maps.Map(container.current, {
          center: { lat: 15, lng: 0 },
          zoom: 2,
          streetViewControl: false,
          mapTypeControl: false,
        });
        setStatus("google");
      })
      .catch(fail);
    return () => {
      active = false;
      if (window.gm_authFailure === fail) window.gm_authFailure = previous;
      if (map.current)
        window.google?.maps.event.clearInstanceListeners(map.current);
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (status !== "google" || !map.current || !window.google?.maps) return;
    const bounds = new window.google.maps.LatLngBounds();
    const markers = valid.map(a => {
      const marker = new window.google!.maps.Marker({
        map: map.current,
        position: a.position,
        title: `${a.label} · ${a.status ?? "Status unavailable"}`,
      });
      bounds.extend(a.position);
      marker.addListener("click", () => select(a.id));
      return marker;
    });
    if (valid.length) map.current.fitBounds(bounds, 45);
    return () =>
      markers.forEach(marker => {
        window.google?.maps.event.clearInstanceListeners(marker);
        marker.setMap(null);
      });
  }, [assets, status, onSelect, view]);
  useEffect(() => {
    const apply = () => {
      const dark = document.documentElement.classList.contains("dark"),
        css = getComputedStyle(document.documentElement);
      map.current?.setOptions({
        styles: dark
          ? [
              {
                elementType: "geometry",
                stylers: [{ color: css.getPropertyValue("--muted").trim() }],
              },
              {
                elementType: "labels.text.fill",
                stylers: [
                  { color: css.getPropertyValue("--muted-foreground").trim() },
                ],
              },
            ]
          : [],
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [theme, status]);
  return (
    <div className={cn("shipment-spatial", className)}>
      <div className="spatial-toolbar">
        <div className="segmented" aria-label="Spatial view">
          <Button
            size="sm"
            variant={view === "map" ? "default" : "outline"}
            aria-pressed={view === "map"}
            onClick={() => setView("map")}
          >
            2D map
          </Button>
          <Button
            size="sm"
            variant={view === "globe" ? "default" : "outline"}
            aria-pressed={view === "globe"}
            disabled={globeFailed}
            onClick={() => setView("globe")}
          >
            3D globe
          </Button>
        </div>
        <span className="muted text-xs">{valid.length} recorded positions</span>
      </div>
      <div
        ref={container}
        className={
          status === "google" && view === "map" ? "provider-map" : "hidden"
        }
        aria-label="Shipment map"
      />
      {view === "globe" ? (
        <Suspense fallback={<p role="status">Loading spatial view…</p>}>
          <Globe
            assets={valid}
            selectedId={selectedId}
            onSelect={select}
            onUnavailable={() => {
              setGlobeFailed(true);
              setView("map");
            }}
          />
        </Suspense>
      ) : (
        status !== "google" && (
          <div className="map-fallback geographic-map">
            <svg
              viewBox="0 0 720 360"
              role="img"
              aria-label={`Geographic longitude and latitude plot of ${valid.length} recorded positions. Use the record selector below.`}
            >
              <rect width="720" height="360" fill="var(--background)" />
              {[-120, -60, 0, 60, 120].map(x => (
                <path
                  key={x}
                  d={`M${(x + 180) * 2} 0V360`}
                  stroke="var(--border)"
                  strokeOpacity=".5"
                />
              ))}
              {[-60, -30, 0, 30, 60].map(y => (
                <path
                  key={y}
                  d={`M0 ${(90 - y) * 2}H720`}
                  stroke="var(--border)"
                  strokeOpacity=".5"
                />
              ))}
              {landPaths.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill="var(--muted)"
                  stroke="var(--border)"
                  strokeWidth=".5"
                />
              ))}
              {valid.map(a => (
                <a
                  href={
                    onSelect
                      ? undefined
                      : `#${a.href ?? `/supply-chain/shipments/${a.id}`}`
                  }
                  key={a.id}
                  role="button"
                  tabIndex={0}
                  aria-label={
                    onSelect ? `Select ${a.label}` : `Open ${a.label}`
                  }
                  onClick={e => {
                    e.preventDefault();
                    select(a.id);
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      select(a.id);
                    }
                  }}
                >
                  <circle
                    cx={(a.position.lng + 180) * 2}
                    cy={(90 - a.position.lat) * 2}
                    r={selectedId === a.id ? 8 : 5}
                    style={{
                      fill: statusColor(a.status ?? "In transit"),
                      stroke:
                        selectedId === a.id
                          ? "var(--foreground)"
                          : "var(--background)",
                      strokeWidth: 2,
                    }}
                  >
                    <title>
                      {a.label} · {a.status ?? "Status unavailable"}
                    </title>
                  </circle>
                </a>
              ))}
            </svg>
          </div>
        )
      )}
      {globeFailed && (
        <p role="status" className="muted text-xs">
          3D rendering unavailable on this device. The coordinate map and
          records remain available.
        </p>
      )}
      <p className="muted spatial-note">
        {status !== "google" && view === "map"
          ? "Keyless map · Provider unavailable or not configured. "
          : ""}
        Source positions only.
      </p>
      <details className="chart-values">
        <summary>Position evidence</summary>
        <p>
          Only supplied coordinates are shown; no positions or route paths
          inferred. Coordinate observation age is unavailable unless supplied.
        </p>
      </details>
      {onSelect && valid.length > 0 && (
        <label className="field spatial-selector">
          Inspect a location
          <select
            aria-label="Inspect shipment location"
            value={selectedId ?? ""}
            onChange={e => onSelect(e.target.value)}
          >
            <option value="">Select a shipment</option>
            {valid.map(a => (
              <option value={a.id} key={a.id}>
                {a.label} · {a.status ?? "Status unavailable"}
              </option>
            ))}
          </select>
        </label>
      )}
      {!compact && (
        <div className="coordinate-list">
          {valid.map(a => (
            <div key={a.id}>
              <Link href={a.href ?? `/supply-chain/shipments/${a.id}`}>
                {a.label} ↗
              </Link>
              <p className="muted">
                Latitude {a.position.lat} · Longitude {a.position.lng}
                {a.status ? ` · ${a.status}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
      {!valid.length && (
        <p className="muted text-sm">
          No valid coordinates in the filtered records. Use List to inspect
          shipments.
        </p>
      )}
    </div>
  );
}
