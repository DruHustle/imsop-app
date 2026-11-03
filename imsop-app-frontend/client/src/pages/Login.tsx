import { useHashQuery } from "@/lib/hash-location";
import { safeSessionStorage } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrainCircuit, Lock, Mail, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const liveRequested = useHashQuery().get("mode") === "live";
  const [signInMode, setSignInMode] = useState<"live" | "demo">("live");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login(email, password, signInMode);
      if (result.success) {
        const destination = safeSessionStorage.getItem("imsop:return-to");
        safeSessionStorage.removeItem("imsop:return-to");
        safeSessionStorage.removeItem("imsop:session-expired");
        navigate(
          destination?.startsWith("#/") &&
            !/^#\/(login|reset-password|forgot-password)/.test(destination)
            ? destination.slice(1)
            : "/"
        );
      } else {
        toast.error(result.error || "Login failed");
      }
    } catch (error) {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoCredentials = (role: string) => {
    const credentials: Record<string, { email: string; password: string }> = {
      admin: { email: "admin@imsop.io", password: "admin123" },
      engineer: { email: "engineer@imsop.io", password: "engineer123" },
      analyst: { email: "analyst@imsop.io", password: "analyst123" },
      demo: { email: "demo@imsop.io", password: "demo123" },
    };
    const cred = credentials[role];
    if (cred) {
      setSignInMode("demo");
      setEmail(cred.email);
      setPassword(cred.password);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background bg-cover bg-center p-4 relative"
      style={{
        backgroundImage: `url("${import.meta.env.BASE_URL}images/hero-bg.jpg")`,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-black/50"
      />
      <Card className="w-full max-w-md glass-panel border-border relative z-10 animate-in fade-in zoom-in duration-500">
        {safeSessionStorage.getItem("imsop:session-expired") && (
          <p role="status" className="p-4 text-sm">
            Your session expired. Sign in to return to your work.
          </p>
        )}
        {safeSessionStorage.getItem("imsop:signout-pending") && (
          <p role="alert" className="p-4 text-sm">
            Server sign out was not confirmed. This device is locked locally.
            Signing in retries sign out first.
          </p>
        )}
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded bg-primary flex items-center justify-center ">
              <BrainCircuit className="w-7 h-7 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold">Welcome to IMSOP</h1>
          <CardDescription className="text-muted-foreground">
            Intelligent Multi-Cloud Supply Chain & Operations Platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p
            role="status"
            className="text-sm text-center text-muted-foreground"
          >
            {liveRequested
              ? "Sign in with your workspace account to view live data."
              : signInMode === "demo"
                ? "Demo sign-in · Example data only"
                : "Live sign-in · Use your workspace account"}
          </p>
          {signInMode === "demo" && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSignInMode("live");
                setEmail("");
                setPassword("");
              }}
            >
              Use live sign-in
            </Button>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    setSignInMode("live");
                  }}
                  className="pl-10 bg-background/50 border-border"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-background/50 border-border"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/80 text-primary-foreground "
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">
              Don't have an account?{" "}
            </span>
            <button
              onClick={() => navigate("/register")}
              className="text-primary hover:underline font-semibold"
            >
              Sign Up
            </button>
          </div>

          {!liveRequested && (
            <div className="space-y-3">
              <p className="text-xs text-center text-muted-foreground">
                Demo Accounts (click to fill):
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fillDemoCredentials("admin")}
                  className="text-xs"
                >
                  Admin
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fillDemoCredentials("engineer")}
                  className="text-xs"
                >
                  Engineer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fillDemoCredentials("analyst")}
                  className="text-xs"
                >
                  Analyst
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fillDemoCredentials("demo")}
                  className="text-xs"
                >
                  Demo
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6 text-center text-xs text-muted-foreground">
            <p>Protected by IMSOP Identity Service</p>
            {!liveRequested && (
              <p>Demo identities use isolated, labelled example data.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
