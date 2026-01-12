import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Router as WouterRouter } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import Operations from "./pages/Operations";
import Analytics from "./pages/Analytics";
import Assistant from "./pages/Assistant";
import Infrastructure from "./pages/Infrastructure";
import Intelligence from "./pages/Intelligence";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Layout from "./components/Layout";
import Profile from "./pages/Profile";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";


// LOG TO VERIFY YOUR CONFIGURATION
console.log("Connecting to backend at:", import.meta.env.VITE_API_URL);

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

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
        <Route path="/analytics" component={Analytics} />
        <Route path="/infrastructure" component={Infrastructure} />
        <Route path="/intelligence" component={Intelligence} />
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
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
