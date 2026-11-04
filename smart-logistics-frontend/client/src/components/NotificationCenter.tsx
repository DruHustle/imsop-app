import { LiveNotifications } from "./OperationalReview";
import { useState } from "react";
import { Link } from "wouter";
import { Bell } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { usePreferences } from "@/contexts/ThemeContext";
import { safeLocalStorage } from "@/lib/storage";
import { isException, formatTime } from "@/lib/workspace";
export default function NotificationCenter() {
  const { user } = useAuth();
  const { mode } = useData();
  return <ScopedNotifications key={`${user?.id}:${mode}`} />;
}
function ScopedNotifications() {
  const { user } = useAuth();
  const { mode, shipments, scope } = useData();
  const { preferences } = usePreferences();
  const key = `imsop:notifications:${scope}:${mode}`;
  const [open, setOpen] = useState(false);
  const [stored, setStored] = useState<{ read: string[]; dismissed: string[] }>(
    () => {
      try {
        const v = JSON.parse(safeLocalStorage.getItem(key) || "{}");
        return {
          read: Array.isArray(v.read)
            ? v.read.filter((s: unknown) => typeof s === "string")
            : [],
          dismissed: Array.isArray(v.dismissed)
            ? v.dismissed.filter((s: unknown) => typeof s === "string")
            : [],
        };
      } catch {
        return { read: [], dismissed: [] };
      }
    }
  );
  const update = (next: typeof stored) => {
    setStored(next);
    safeLocalStorage.setItem(key, JSON.stringify(next));
  };
  const items =
    mode === "demo" && preferences.shipmentNotifications
      ? shipments.items
          .filter(isException)
          .filter(s => !stored.dismissed.includes(s.id))
      : [];
  const unread = items.filter(s => !stored.read.includes(s.id)).length;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        >
          <Bell size={17} />
          <span className="notification-button-text text-xs">
            Notifications
          </span>
          {unread > 0 && <span className="text-xs">{unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="notification-list">
        {mode === "live" ? (
          <LiveNotifications />
        ) : (
          <>
            <div className="p-4">
              <h2>Notifications</h2>
              <p className="muted text-xs mt-1">
                {mode === "demo"
                  ? "Demo shipment alerts · scoped to your account"
                  : "Live notification delivery is not configured."}
              </p>
            </div>
            {items.length ? (
              <>
                <div className="actions px-4 pb-3">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!unread}
                    onClick={() =>
                      update({ ...stored, read: items.map(s => s.id) })
                    }
                  >
                    Mark all read
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      update({
                        ...stored,
                        dismissed: [
                          ...stored.dismissed,
                          ...items.map(s => s.id),
                        ],
                      })
                    }
                  >
                    Clear all
                  </Button>
                </div>
                {items.map(s => (
                  <article key={s.id} className="notification-item">
                    <strong>
                      {!stored.read.includes(s.id) && "Unread · "}
                      {s.trackingNumber}: {s.status}
                    </strong>
                    <p className="muted">
                      Demo observation: {formatTime(s.observedAt)}
                    </p>
                    <div className="actions">
                      <Link
                        href={`/supply-chain/shipments/${s.id}`}
                        className="record-link"
                        onClick={() => {
                          update({ ...stored, read: [...stored.read, s.id] });
                          setOpen(false);
                        }}
                      >
                        Open shipment
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          update({ ...stored, read: [...stored.read, s.id] })
                        }
                        disabled={stored.read.includes(s.id)}
                        aria-label={`Mark ${s.trackingNumber} read`}
                      >
                        Mark read
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          update({
                            ...stored,
                            dismissed: [...stored.dismissed, s.id],
                          })
                        }
                        aria-label={`Dismiss ${s.trackingNumber}`}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </article>
                ))}
              </>
            ) : (
              <div className="notification-item">
                <p className="muted">
                  {preferences.shipmentNotifications
                    ? "No unread or retained demonstration alerts."
                    : "Demo shipment notifications are disabled in Preferences."}
                </p>
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
