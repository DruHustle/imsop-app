import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { User, Mail, Shield, Camera, Key, LogOut, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Profile() {
  const { user, logout, updateProfile, changePassword } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    // Convert to base64 for localStorage storage
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const result = await updateProfile({ avatar: base64 });
      if (result.success) {
        toast.success("Avatar updated successfully");
      } else {
        toast.error(result.error || "Failed to update avatar");
      }
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleNameUpdate = async () => {
    if (name === user?.name) return;
    setIsUpdatingName(true);
    const result = await updateProfile({ name });
    if (result.success) {
      toast.success("Name updated successfully");
    } else {
      toast.error(result.error || "Failed to update name");
    }
    setIsUpdatingName(false);
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsChangingPassword(true);
    const result = await changePassword(currentPassword, newPassword);
    if (result.success) {
      toast.success("Password changed successfully");
      setIsPasswordDialogOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      toast.error(result.error || "Failed to change password");
    }
    setIsChangingPassword(false);
  };

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-4xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
          Profile
        </h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences.</p>
      </div>

      <div className="grid gap-6">
        {/* Profile Overview */}
        <Card className="glass border-white/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <CardTitle>Profile Overview</CardTitle>
            </div>
            <CardDescription>Your personal information and account details.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Avatar Section */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <Avatar className="w-24 h-24 border-2 border-primary/20">
                    <AvatarImage src={user?.avatar || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-display">
                      {getInitials(user?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera className="w-6 h-6 text-white" />
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleAvatarUpload}
                      disabled={isUploading}
                    />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isUploading ? "Uploading..." : "Click to upload"}
                </p>
              </div>

              {/* Info Section */}
              <div className="flex-1 space-y-4 w-full">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <div className="flex gap-2">
                      <Input 
                        id="name" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)}
                        className="bg-white/5 border-white/10"
                      />
                      {name !== user?.name && (
                        <Button 
                          onClick={handleNameUpdate}
                          disabled={isUpdatingName}
                          size="sm"
                        >
                          {isUpdatingName ? "..." : "Save"}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input 
                      id="email" 
                      value={user?.email || ""} 
                      readOnly
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Input 
                      id="role" 
                      value={user?.role || "user"} 
                      readOnly
                      className="bg-white/5 border-white/10 capitalize"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="joined">Account Status</Label>
                    <Input 
                      id="joined" 
                      value="Active"
                      readOnly
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card className="glass border-white/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>Manage your account security settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Password
                </Label>
                <p className="text-sm text-muted-foreground">Change your account password.</p>
              </div>
              <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="border-white/10 hover:bg-white/5"
                  >
                    Change Password
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass border-white/10">
                  <DialogHeader>
                    <DialogTitle>Change Password</DialogTitle>
                    <DialogDescription>
                      Enter your current password and choose a new one.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="current-password"
                          type={showPasswords ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="bg-white/5 border-white/10 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords(!showPasswords)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input
                        id="new-password"
                        type={showPasswords ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="bg-white/5 border-white/10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <Input
                        id="confirm-password"
                        type={showPasswords ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="bg-white/5 border-white/10"
                      />
                    </div>
                    <Button 
                      onClick={handlePasswordChange}
                      disabled={isChangingPassword}
                      className="w-full"
                    >
                      {isChangingPassword ? "Changing..." : "Change Password"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Verification
                </Label>
                <p className="text-sm text-muted-foreground">Your email is verified.</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-sm font-medium">
                Verified
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="glass border-red-500/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <LogOut className="w-5 h-5 text-red-400" />
              <CardTitle className="text-red-400">Session</CardTitle>
            </div>
            <CardDescription>Manage your current session.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Sign Out</Label>
                <p className="text-sm text-muted-foreground">End your current session and return to login.</p>
              </div>
              <Button 
                variant="destructive"
                onClick={handleLogout}
              >
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
