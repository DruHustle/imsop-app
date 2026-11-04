import { NotificationDeliveryPreferences } from "@/components/NotificationDeliveryPreferences";
import { PageHeader, Panel } from "@/components/Workspace";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { usePreferences } from "@/contexts/ThemeContext";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
export default function Settings() {
  const { preferences, update } = usePreferences();
  const { mode } = useData();
  const { user } = useAuth();
  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Preferences"
        description="Appearance and accessibility settings persist on this device. Account preferences are scoped to the signed-in user."
      />
      <div className="max-w-3xl space-y-5">
        <Panel title="Appearance">
          <div className="preference-row theme-preference">
            <div>
              <h3>Theme</h3>
              <p className="muted">
                Auto follows your device’s light or dark setting.
              </p>
            </div>
            <ThemeSwitcher labelled label="Appearance theme" />
          </div>
          <div className="preference-row">
            <div>
              <label htmlFor="reduced-motion">Reduced motion</label>
              <p className="muted">
                Minimize motion. Operating-system reduced motion is always
                respected.
              </p>
            </div>
            <Switch
              id="reduced-motion"
              checked={preferences.reducedMotion}
              onCheckedChange={reducedMotion => update({ reducedMotion })}
            />
          </div>
          <div className="preference-row">
            <div>
              <label htmlFor="contrast">High contrast</label>
              <p className="muted">
                Increase text and boundary contrast throughout the workspace.
              </p>
            </div>
            <Switch
              id="contrast"
              checked={preferences.contrast}
              onCheckedChange={contrast => update({ contrast })}
            />
          </div>
        </Panel>
        <Panel title="Notifications">
          <div className="preference-row">
            <div>
              <label htmlFor="shipment-notifications">
                Demo shipment alerts
              </label>
              <p className="muted">
                {mode === "demo"
                  ? "Show demonstration shipment exceptions in the notification panel."
                  : "This preference applies only to Demo mode. Review email preferences are available below."}
              </p>
            </div>
            <Switch
              id="shipment-notifications"
              disabled={mode !== "demo"}
              checked={mode === "demo" && preferences.shipmentNotifications}
              onCheckedChange={shipmentNotifications =>
                update({ shipmentNotifications })
              }
            />
          </div>
          <NotificationDeliveryPreferences />
        </Panel>
        <Panel title="Security capabilities">
          <div className="preference-row">
            <div>
              <h3>Two-factor authentication</h3>
              <p className="muted">
                No setup endpoint is available for this account.
              </p>
            </div>
            <Button variant="outline" disabled>
              Unavailable
            </Button>
          </div>
          {user?.role === "admin" && (
            <div className="preference-row">
              <div>
                <h3>API-key management</h3>
                <p className="muted">
                  No authorized key-management workflow is implemented.
                </p>
              </div>
              <Button variant="outline" disabled>
                Unavailable
              </Button>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
