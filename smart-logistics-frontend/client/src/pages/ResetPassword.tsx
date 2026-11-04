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
import { BrainCircuit, Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  captureResetToken,
  forgetResetToken,
  PASSWORD_GUIDANCE,
} from "@/lib/recovery";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const [, navigate] = useLocation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState(captureResetToken);
  const linkVersion = useRef(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const receive = () => {
      linkVersion.current++;
      setToken(captureResetToken());
      setSuccess(false);
      setError("");
      setPassword("");
      setConfirmPassword("");
      setIsLoading(false);
    };
    window.addEventListener("imsop:recovery-link", receive);
    return () => window.removeEventListener("imsop:recovery-link", receive);
  }, []);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error("Invalid reset token");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 12 || password.length > 128) {
      setError(PASSWORD_GUIDANCE);
      return;
    }

    const submittedVersion = linkVersion.current;
    setError("");
    setIsLoading(true);

    try {
      const result = await resetPassword(token, password);
      if (submittedVersion !== linkVersion.current) return;
      if (result.success) {
        forgetResetToken();
        setSuccess(true);
      } else {
        setError(
          result.error || "Could not reset your password. You can retry."
        );
      }
    } catch (error) {
      if (submittedVersion !== linkVersion.current) return;
      setError(
        "Could not reach the server. Your link is retained here; retry."
      );
    } finally {
      if (submittedVersion === linkVersion.current) setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
        <Card className="w-full max-w-md glass-panel border-border relative z-10 animate-in fade-in zoom-in duration-500">
          <CardHeader className="space-y-1 text-center">
            <h1 className="text-2xl font-display font-bold tracking-wide">
              Invalid Link
            </h1>
            <CardDescription className="text-muted-foreground">
              Reopen the link from your email, or request a new link. Recovery
              links are removed from the address bar and are not retained after
              reload.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate("/forgot-password")}
              className="w-full bg-primary hover:bg-primary/80"
            >
              Request New Link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
        <Card className="w-full max-w-md glass-panel border-border relative z-10 animate-in fade-in zoom-in duration-500">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-green-500" />
              </div>
            </div>
            <h1 className="text-2xl font-display font-bold tracking-wide">
              Password Reset!
            </h1>
            <CardDescription className="text-muted-foreground">
              Your password has been reset. Sign in with your new password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/")}>
              Sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <Card className="w-full max-w-md glass-panel border-border relative z-10 animate-in fade-in zoom-in duration-500">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded bg-primary flex items-center justify-center ">
              <BrainCircuit className="w-7 h-7 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-display font-bold tracking-wide">
            Reset Password
          </h1>
          <CardDescription className="text-muted-foreground">
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p id="password-policy" className="text-sm text-muted-foreground">
            {PASSWORD_GUIDANCE}
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-background/50 border-border"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  aria-describedby="password-policy"
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="pl-10 bg-background/50 border-border"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/80 text-primary-foreground "
            >
              {isLoading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>

          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="w-full"
          >
            Back to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
