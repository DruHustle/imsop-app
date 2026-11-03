import { ReviewEvidence } from "@/components/WorkspaceVisuals";
import { useData } from "@/contexts/DataContext";
import { PageHeader, SourceNote } from "@/components/Workspace";
import { Forecasts } from "@/components/Forecasts";
import { OperationalReview } from "@/components/OperationalReview";
import { DemoReview } from "@/components/DemoReview";
export default function Intelligence() {
  const { mode, shipments } = useData();
  return (
    <>
      <PageHeader
        title="Recommendations"
        description="Review exceptions and decide what to do next"
      />
      <SourceNote />
      {shipments.status === "ready" && (
        <ReviewEvidence items={shipments.items} mode={mode} />
      )}
      {mode === "demo" ? <DemoReview /> : <OperationalReview />}
      <details className="source-details">
        <summary>Forecast evidence</summary>
        <Forecasts />
      </details>
      <details className="source-details">
        <summary>
          {mode === "live"
            ? "About forecast providers"
            : "About demonstration reviews"}
        </summary>
        <p>
          Forecasts use explicitly supplied source observations and the
          configured provider evidence contract. Review actions document human
          follow-up and do not change delivery status, inventory or bookings.
          Demo actions persist only on this device.
        </p>
      </details>
    </>
  );
}
