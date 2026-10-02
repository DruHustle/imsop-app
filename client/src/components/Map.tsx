/**
 * GOOGLE MAPS FRONTEND INTEGRATION - ESSENTIAL GUIDE
 *
 * USAGE FROM PARENT COMPONENT:
 * ======
 *
 * const mapRef = useRef<google.maps.Map | null>(null);
 *
 * <MapView
 *   initialCenter={{ lat: 40.7128, lng: -74.0060 }}
 *   initialZoom={15}
 *   onMapReady={(map) => {
 *     mapRef.current = map; // Store to control map from parent anytime
 *   }}
 * />
 *
 * ======
 * Available Libraries and Core Features:
 * -------------------------------
 * 📍 MARKER (from `marker` library)
 * new google.maps.marker.AdvancedMarkerElement({
 *   map,
 *   position: { lat: 37.7749, lng: -122.4194 },
 *   title: "San Francisco",
 * });
 *
 * -------------------------------
 * 🏢 PLACES (from `places` library)
 * const place = new google.maps.places.Place({ id: PLACE_ID });
 * await place.fetchFields({ fields: ["displayName", "location"] });
 * map.setCenter(place.location);
 *
 * -------------------------------
 * 🧭 GEOCODER (from `geocoding` library)
 * const geocoder = new google.maps.Geocoder();
 * geocoder.geocode({ address: "New York" }, (results, status) => {
 *   if (status === "OK" && results[0]) {
 *     map.setCenter(results[0].geometry.location);
 *   }
 * });
 *
 * -------------------------------
 * 📐 GEOMETRY (from `geometry` library)
 * const dist = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
 *
 * -------------------------------
 * 🛣️ ROUTES (from `routes` library)
 * const directionsService = new google.maps.DirectionsService();
 * const directionsRenderer = new google.maps.DirectionsRenderer({ map });
 * directionsService.route(
 *   { origin, destination, travelMode: "DRIVING" },
 *   (res, status) => status === "OK" && directionsRenderer.setDirections(res)
 * );
 */

/// <reference types="@types/google.maps" />

import { useEffect, useRef, useState } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

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
  if (!API_KEY) return Promise.reject(new Error("Google Maps API key is not configured"));
  if (mapScriptPromise) return mapScriptPromise;

  const scriptPromise = new Promise<void>((resolve, reject) => {
    let settled = false;
    let timeoutId: number | undefined;
    const previousInit = window.initGoogleMaps;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (window.initGoogleMaps === onReady) window.initGoogleMaps = previousInit;

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
      'script[src*="maps.googleapis.com/maps/api/js"]',
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
      15_000,
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
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const authenticationFailed = useRef(false);
  const [status, setStatus] = useState<"loading" | "google" | "fallback">("loading");

  const init = usePersistFn(async (isActive: () => boolean) => {
    if (!API_KEY) {
      if (isActive()) setStatus("fallback");
      return;
    }

    try {
      await loadMapScript();
      if (!isActive() || authenticationFailed.current) return;
      if (!mapContainer.current || !window.google?.maps) {
        throw new Error("Google Maps could not initialize the map");
      }

      map.current = new window.google.maps.Map(mapContainer.current, {
        zoom: initialZoom,
        center: initialCenter,
        mapTypeControl: true,
        fullscreenControl: true,
        zoomControl: true,
        streetViewControl: true,
        mapId: "DEMO_MAP_ID",
      });

      setStatus("google");
      onMapReady?.(map.current);
    } catch (error) {
      console.error("Failed to initialize map:", error);
      if (isActive()) setStatus("fallback");
    }
  });

  useEffect(() => {
    let active = true;
    const previousAuthFailure = window.gm_authFailure;
    const handleAuthFailure = () => {
      previousAuthFailure?.();
      authenticationFailed.current = true;
      console.error("Google Maps authentication failed; showing OpenStreetMap instead.");
      if (active) setStatus("fallback");
    };

    window.gm_authFailure = handleAuthFailure;
    init(() => active);

    return () => {
      active = false;
      if (window.gm_authFailure === handleAuthFailure) {
        window.gm_authFailure = previousAuthFailure;
      }
      map.current = null;
    };
  }, [init]);

  return (
    <div className={cn("relative w-full h-[500px]", className)}>
      <iframe
        title="Global activity map powered by OpenStreetMap"
        src="https://www.openstreetmap.org/export/embed.html?bbox=-180%2C-85%2C180%2C85&layer=mapnik"
        className={cn(
          "absolute inset-0 h-full w-full border-0",
          status === "google" ? "invisible" : "visible",
        )}
        loading="eager"
      />
      <div
        ref={mapContainer}
        className={cn(
          "absolute inset-0 h-full w-full",
          status === "google" ? "visible" : "invisible",
        )}
        aria-hidden={status !== "google"}
      />
    </div>
  );
}
