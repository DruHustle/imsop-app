import { lazy, Suspense, useEffect, useState } from "react";
import { TrackingEvent, formatTime } from "@/lib/workspace";
import { Button } from "./ui/button";
const Map = lazy(() => import("./Map").then(m => ({ default: m.MapView })));
export default function ShipmentChronology({
  events,
  href,
}: {
  events: TrackingEvent[];
  href: string;
}) {
  const ordered = [...events].sort(
      (a, b) =>
        a.occurredAt.localeCompare(b.occurredAt) ||
        String(a.id).localeCompare(String(b.id))
    ),
    [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false),
    [spatial, setSpatial] = useState(false);
  const active = ordered[Math.min(index, ordered.length - 1)],
    hasReplay = ordered.filter(e => e.position).length >= 2;
  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [events]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setIndex(i => {
          if (i >= ordered.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        }),
      2000
    );
    return () => clearInterval(timer);
  }, [playing, ordered.length]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => setPlaying(false);
    media.addEventListener("change", stop);
    return () => media.removeEventListener("change", stop);
  }, []);
  if (!active) return null;
  return (
    <div className="shipment-chronology">
      <h3>Recorded event chronology</h3>
      <p className="muted text-xs">
        Historical observations in this page only. Locations appear only when
        that event supplies coordinates; no interpolated routes.
      </p>
      <div
        className="chronology-rail"
        role="group"
        aria-label="Select recorded event"
      >
        {ordered.map((e, i) => (
          <button
            key={e.id}
            aria-pressed={i === index}
            onClick={() => {
              setPlaying(false);
              setIndex(i);
            }}
          >
            <i />
            <span>{e.eventType}</span>
            <small>{formatTime(e.occurredAt)}</small>
          </button>
        ))}
      </div>
      <div className="chronology-context" aria-live="polite">
        <strong>{active.eventType}</strong>
        <p>
          Provider {active.provider} · {formatTime(active.occurredAt)}
        </p>
        <p className="muted text-xs">
          Receipt {formatTime(active.receivedAt)} · Event #{active.id}
        </p>
      </div>
      <div className="actions">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setPlaying(false);
            setIndex(i => Math.max(0, i - 1));
          }}
          disabled={index === 0}
        >
          Previous observation
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setPlaying(false);
            setIndex(i => Math.min(ordered.length - 1, i + 1));
          }}
          disabled={index >= ordered.length - 1}
        >
          Next observation
        </Button>
        {hasReplay && (
          <Button
            size="sm"
            onClick={() => {
              if (!playing && index >= ordered.length - 1) setIndex(0);
              setSpatial(true);
              setPlaying(p => !p);
            }}
          >
            {playing ? "Pause replay" : "Play historical replay"}
          </Button>
        )}
        {active.position && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSpatial(v => !v)}
          >
            {spatial ? "Hide event location" : "Show event location"}
          </Button>
        )}
      </div>
      {spatial &&
        (active.position ? (
          <Suspense fallback={<p role="status">Loading recorded location…</p>}>
            <Map
              compact
              assets={[
                {
                  id: String(active.id),
                  label: `Event ${active.id}`,
                  position: active.position,
                  status: active.status ?? undefined,
                  href,
                },
              ]}
            />
          </Suspense>
        ) : (
          <p role="status" className="muted text-sm">
            This event has no recorded location. No previous position is carried
            forward.
          </p>
        ))}
      {!hasReplay && (
        <p className="muted text-xs mt-2">
          Spatial replay requires at least two explicitly located observations.
        </p>
      )}
    </div>
  );
}
