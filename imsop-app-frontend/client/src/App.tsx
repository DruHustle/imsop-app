import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Router as WouterRouter, Redirect } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider, PreferencesProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { DataProvider } from "./contexts/DataContext";
import Layout from "./components/Layout";
import { routes, permitted } from "./lib/routes";
import { useWorkspaceLocation, useHashQuery } from "./lib/hash-location";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Operations = lazy(() => import("./pages/Operations"));
const Orders = lazy(() => import("./pages/Orders"));
const Detail = lazy(() => import("./pages/RecordDetail"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const Assistant = lazy(() => import("./pages/Assistant"));
const Infrastructure = lazy(() => import("./pages/Infrastructure"));
const Intelligence = lazy(() => import("./pages/Intelligence"));
const Settings = lazy(() => import("./pages/Settings"));
const Profile = lazy(() => import("./pages/Profile"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Forbidden = lazy(() => import("./pages/Forbidden"));
const NotFound = lazy(() => import("./pages/NotFound"));
const components: Record<string, React.ComponentType> = {
  overview: Dashboard,
  shipments: Operations,
  orders: Orders,
  analytics: AnalyticsPage,
  recommendations: Intelligence,
  assistant: Assistant,
  health: Infrastructure,
  integrations: Infrastructure,
  settings: Settings,
  profile: Profile,
};
const loading = (
  <div className="empty-state" role="status">
    Loading workspace…
  </div>
);
function LegacyRedirect({ href }: { href: string }) {
  const q = useHashQuery().toString();
  return <Redirect to={href + (q ? "?" + q : "")} replace />;
}
function WorkspaceRouter() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [location] = useWorkspaceLocation();
  if (location === "/reset-password")
    return (
      <Suspense fallback={loading}>
        <ResetPassword />
      </Suspense>
    );
  if (location === "/forgot-password")
    return (
      <Suspense fallback={loading}>
        <ForgotPassword />
      </Suspense>
    );
  if (isLoading) return loading;
  if (!isAuthenticated)
    return (
      <Suspense fallback={loading}>
        <Switch>
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/reset-password" component={ResetPassword} />
          <Route path="/register" component={Register} />
          <Route component={Login} />
        </Switch>
      </Suspense>
    );
  return (
    <DataProvider>
      <Layout>
        <Suspense fallback={loading}>
          <Switch>
            {routes.flatMap(r =>
              r.aliases.map(alias => (
                <Route key={alias} path={alias}>
                  <LegacyRedirect href={r.href} />
                </Route>
              ))
            )}
            {routes.map(r => {
              const Page = components[r.id];
              return (
                <Route key={r.id} path={r.href}>
                  {permitted(r, user) ? <Page /> : <Forbidden />}
                </Route>
              );
            })}
            <Route path="/supply-chain/shipments/:id/tracking">
              {p => <Detail kind="shipments" id={p.id} tracking />}
            </Route>
            <Route path="/supply-chain/shipments/:id">
              {p => <Detail kind="shipments" id={p.id} />}
            </Route>
            <Route path="/supply-chain/orders/:id">
              {p =>
                permitted(routes.find(r => r.id === "orders")!, user) ? (
                  <Detail kind="orders" id={p.id} />
                ) : (
                  <Forbidden />
                )
              }
            </Route>
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </Layout>
    </DataProvider>
  );
}
export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <PreferencesProvider>
            <TooltipProvider>
              <Toaster />
              <WouterRouter hook={useWorkspaceLocation}>
                <WorkspaceRouter />
              </WouterRouter>
            </TooltipProvider>
          </PreferencesProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
