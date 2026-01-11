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

import { useEffect, useRef } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: typeof google;
    initGoogleMaps?: () => void;
  }
}

// Use environment variable for Google Maps API key
// Users should set VITE_GOOGLE_MAPS_API_KEY in their .env file
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

function loadMapScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.google?.maps) {
      resolve();
      return;
    }

    // Check if script is already loading
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve());
      return;
    }

    if (!API_KEY) {
      console.warn("Google Maps API key not configured. Set VITE_GOOGLE_MAPS_API_KEY in your .env file.");
      // Still resolve to allow the component to render (will show error in map container)
      resolve();
      return;
    }

    window.initGoogleMaps = () => {
      resolve();
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&v=weekly&libraries=marker,places,geocoding,geometry&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      console.error("Failed to load Google Maps script");
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });
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

  const init = usePersistFn(async () => {
    try {
      await loadMapScript();
      
      if (!mapContainer.current) {
        console.error("Map container not found");
        return;
      }

      if (!window.google?.maps) {
        // Show placeholder if Maps API is not available
        if (mapContainer.current) {
          mapContainer.current.innerHTML = `
            <div class="flex items-center justify-center h-full glass-panel rounded-lg border border-white/10">
              <div class="text-center p-6 space-y-3">
                <div class="flex justify-center mb-2">
                  <svg class="w-12 h-12 text-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                  </svg>
                </div>
                <p class="text-muted-foreground font-medium">Map Visualization Unavailable</p>
                <p class="text-xs text-muted-foreground/70">Google Maps API key not configured</p>
                <p class="text-xs text-muted-foreground/50 mt-2">Set <code class="bg-white/5 px-1 py-0.5 rounded">VITE_GOOGLE_MAPS_API_KEY</code> in .env to enable</p>
              </div>
            </div>
          `;
        }
        return;
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
      
      if (onMapReady) {
        onMapReady(map.current);
      }
    } catch (error) {
      console.error("Failed to initialize map:", error);
    }
  });

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div ref={mapContainer} className={cn("w-full h-[500px]", className)} />
  );
}
