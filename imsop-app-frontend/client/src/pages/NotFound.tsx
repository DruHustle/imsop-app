import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { EmptyState, Panel, PageHeader } from "@/components/Workspace";
export default function NotFound() {
  const [, navigate] = useLocation();
  return (
    <>
      <PageHeader
        title="404"
        description="This workspace destination could not be found."
      />
      <Panel>
        <EmptyState
          title="Page not found"
          description="Return to Overview to continue your work."
          action={<Button onClick={() => navigate("/")}>Go home</Button>}
        />
      </Panel>
    </>
  );
}
