import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { Palette, Monitor, Moon, Sun, Bell, Shield, User } from "lucide-react";

export default function Settings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-4xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">Manage your preferences and account settings.</p>
      </div>

      <div className="grid gap-6">
        {/* Appearance Settings */}
        <Card className="glass border-white/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              <CardTitle>Appearance</CardTitle>
            </div>
            <CardDescription>Customize the look and feel of the application.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Theme Mode</Label>
                <p className="text-sm text-muted-foreground">Select your preferred interface theme.</p>
              </div>
              <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/10">
                <Button 
                  variant={theme === 'light' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  onClick={() => setTheme('light')}
                  className="h-8 w-8 p-0"
                >
                  <Sun className="w-4 h-4" />
                </Button>
                <Button 
                  variant={theme === 'system' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  onClick={() => setTheme('system')}
                  className="h-8 w-8 p-0"
                >
                  <Monitor className="w-4 h-4" />
                </Button>
                <Button 
                  variant={theme === 'dark' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  onClick={() => setTheme('dark')}
                  className="h-8 w-8 p-0"
                >
                  <Moon className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Reduced Motion</Label>
                <p className="text-sm text-muted-foreground">Minimize animations for better accessibility.</p>
              </div>
              <Switch />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">High Contrast</Label>
                <p className="text-sm text-muted-foreground">Increase contrast for better legibility.</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="glass border-white/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-purple-400" />
              <CardTitle>Notifications</CardTitle>
            </div>
            <CardDescription>Configure how you receive alerts and updates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Critical Alerts</Label>
                <p className="text-sm text-muted-foreground">Receive immediate alerts for system failures.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Shipment Updates</Label>
                <p className="text-sm text-muted-foreground">Get notified when shipment status changes.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Email Digest</Label>
                <p className="text-sm text-muted-foreground">Receive a daily summary of operational metrics.</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* Account Settings */}
        <Card className="glass border-white/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-green-400" />
              <CardTitle>Account</CardTitle>
            </div>
            <CardDescription>Manage your profile and security settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">Add an extra layer of security to your account.</p>
              </div>
              <Button variant="outline" className="border-white/10 hover:bg-white/5">Enable 2FA</Button>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">API Keys</Label>
                <p className="text-sm text-muted-foreground">Manage access keys for external integrations.</p>
              </div>
              <Button variant="outline" className="border-white/10 hover:bg-white/5">Manage Keys</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
