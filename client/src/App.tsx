import { Analytics } from '@vercel/analytics/react';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Router as WouterRouter } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Operations = lazy(() => import('./pages/Operations'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const Assistant = lazy(() => import('./pages/Assistant'));
const Infrastructure = lazy(() => import('./pages/Infrastructure'));
const Intelligence = lazy(() => import('./pages/Intelligence'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Profile = lazy(() => import('./pages/Profile'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Forbidden = lazy(() => import('./pages/Forbidden'));


// LOG TO VERIFY YOUR CONFIGURATION
console.log("Connecting to backend at:", import.meta.env.VITE_API_URL);

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const canAccess = (roles: string[]) => Boolean(user && roles.includes(user.role));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show login page for unauthenticated users, but allow access to password reset pages
  if (!isAuthenticated) {
    return (
      
      <WouterRouter hook={useHashLocation}>
        <Switch>
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/reset-password" component={ResetPassword} />
          <Route path="/register" component={Register} />
          <Route path="/login" component={Login} />
          <Route path="/" component={Login} />
          <Route component={Login} />
        </Switch>
      </WouterRouter>
    );
  }

  return (
    <WouterRouter hook={useHashLocation}>
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/operations" component={Operations} />
        <Route path="/analytics">{canAccess(['admin', 'analyst']) ? <AnalyticsPage /> : <Forbidden />}</Route>
        <Route path="/infrastructure">{canAccess(['admin', 'engineer']) ? <Infrastructure /> : <Forbidden />}</Route>
        <Route path="/intelligence">{canAccess(['admin', 'engineer', 'analyst']) ? <Intelligence /> : <Forbidden />}</Route>
        <Route path="/assistant" component={Assistant} />
        <Route path="/settings" component={Settings} />
        <Route path="/profile" component={Profile} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  </WouterRouter>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background" role="status">Loading…</div>}>
              <Router />
            </Suspense>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
