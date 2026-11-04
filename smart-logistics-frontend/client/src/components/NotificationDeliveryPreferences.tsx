import { useEffect, useState } from "react";
import { z } from "zod";
import { useData } from "@/contexts/DataContext";
import { requestJSON } from "@/lib/requests";
import { Switch } from "./ui/switch";
const schema = z.object({
  emailEnabled: z.boolean(),
  deliveryAvailable: z.boolean(),
});
export function NotificationDeliveryPreferences() {
  const { mode } = useData();
  const [value, setValue] = useState<z.infer<typeof schema> | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (mode !== "live") return;
    const c = new AbortController();
    requestJSON(
      "/api/operations/notifications/preferences",
      "GET",
      undefined,
      undefined,
      c.signal
    )
      .then(r => setValue(schema.parse(r)))
      .catch(e => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [mode]);
  if (mode === "demo")
    return (
      <p className="muted text-xs">
        Email preferences use your live workspace. Demo mode sends no emails.
      </p>
    );
  return (
    <div className="preference-row">
      <div>
        <label htmlFor="review-emails">Review activity emails</label>
        <p className="muted">
          {value?.deliveryAvailable
            ? "Opt in to future review activity emails for this workspace. Provider acceptance does not confirm inbox delivery."
            : "Server email delivery is not enabled and configured. In-app notices remain available."}
        </p>
        {error && <p role="alert">{error}</p>}
      </div>
      <Switch
        id="review-emails"
        checked={value?.emailEnabled ?? false}
        disabled={
          busy || !value || (!value.deliveryAvailable && !value.emailEnabled)
        }
        onCheckedChange={async emailEnabled => {
          setBusy(true);
          setError("");
          try {
            setValue(
              schema.parse(
                await requestJSON(
                  "/api/operations/notifications/preferences",
                  "PUT",
                  { emailEnabled }
                )
              )
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
