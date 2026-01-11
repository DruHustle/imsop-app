import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        toast.success("Login successful!");
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
      setEmail(cred.email);
      setPassword(cred.password);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[url('./images/hero-bg.jpg')] bg-cover bg-center relative">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      <Card className="w-full max-w-md glass-panel border-white/10 relative z-10 animate-in fade-in zoom-in duration-500">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded bg-primary flex items-center justify-center shadow-[0_0_20px_var(--primary)]">
              <BrainCircuit className="w-7 h-7 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-display font-bold tracking-wide">Welcome to IMSOP</CardTitle>
          <CardDescription className="text-muted-foreground">
            Intelligent Multi-Cloud Supply Chain & Operations Platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-background/50 border-white/20"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
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
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-background/50 border-white/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <Button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/80 text-primary-foreground shadow-[0_0_15px_var(--primary)]"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <button
              onClick={() => navigate('/register')}
              className="text-primary hover:underline font-semibold"
            >
              Sign Up
            </button>
          </div>
          
          <div className="space-y-3">
            <p className="text-xs text-center text-muted-foreground">Demo Accounts (click to fill):</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => fillDemoCredentials("admin")} className="text-xs">
                Admin
              </Button>
              <Button variant="outline" size="sm" onClick={() => fillDemoCredentials("engineer")} className="text-xs">
                Engineer
              </Button>
              <Button variant="outline" size="sm" onClick={() => fillDemoCredentials("analyst")} className="text-xs">
                Analyst
              </Button>
              <Button variant="outline" size="sm" onClick={() => fillDemoCredentials("demo")} className="text-xs">
                Demo
              </Button>
            </div>
          </div>
          
          <div className="mt-6 text-center text-xs text-muted-foreground">
            <p>Protected by IMSOP Identity Service</p>
            <p>v2.5.0-stable</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
