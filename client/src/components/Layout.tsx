import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Truck, 
  BarChart3, 
  BrainCircuit, 
  MessageSquare, 
  Settings, 
  Menu,
  Activity,
  LogOut,
  User,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NotificationCenter from "./NotificationCenter";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/operations", icon: Truck, label: "Operations" },
    { href: "/analytics", icon: BarChart3, label: "Analytics" },
    { href: "/infrastructure", icon: Activity, label: "Infrastructure" },
    { href: "/intelligence", icon: BrainCircuit, label: "Intelligence" },
    { href: "/assistant", icon: MessageSquare, label: "AI Assistant" },
  ];

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-primary/50 bg-primary/10 flex items-center justify-center shadow-[0_0_15px_var(--primary)]">
          <Activity className="w-6 h-6 text-primary" />
        </div>
        <span className="font-display font-bold text-2xl tracking-wider text-foreground">IMSOP</span>
      </div> 
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 cursor-pointer group",
                  isActive 
                    ? "bg-primary/20 text-primary border border-primary/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]" 
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive && "animate-pulse")} />
                <span className="font-medium">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_5px_var(--primary)]" />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto space-y-2">
        <div className="glass-panel rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-muted-foreground">System Status</span>
          </div>
          <div className="text-sm font-mono text-green-400">All Systems Operational</div>
        </div>
        
        <Link href="/settings">
          <div className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-white/5",
            location === "/settings" && "bg-primary/20 text-primary"
          )}>
            <Settings className="w-5 h-5" />
            <span className="font-medium">Settings</span>
          </div>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground font-sans selection:bg-primary/30">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 border-r border-white/10 bg-black/20 backdrop-blur-xl fixed h-full z-50">
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b border-white/10 bg-black/40 backdrop-blur-xl z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary/50 bg-primary/10 flex items-center justify-center shadow-[0_0_10px_var(--primary)]">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <span className="font-display font-bold text-xl tracking-wider">IMSOP</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationCenter />
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 bg-black/90 border-r border-white/10 text-foreground w-72 flex flex-col">
              <div className="flex-1 overflow-y-auto">
                <NavContent />
              </div>
              <div className="p-4 border-t border-white/10 bg-black/40">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-white/20">
                      <AvatarImage src={user?.avatar || undefined} alt={user?.name || "User"} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(user?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <p className="text-sm font-medium leading-none">{user?.name || "User"}</p>
                      <p className="text-xs leading-none text-muted-foreground truncate max-w-[150px]">
                        {user?.email || "No email"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full border-white/10 hover:bg-white/5"
                    onClick={() => {
                      setLocation("/profile");
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-400"
                    onClick={() => {
                      logout();
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 min-h-screen flex flex-col relative">
        {/* Top Bar */}
        <header className="h-16 border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-40 hidden md:flex items-center justify-between px-6">
          <div className="text-sm text-muted-foreground">
            <span className="text-primary">Welcome back,</span> {user?.name || "User"}
          </div>
          <div className="flex items-center gap-4">
            <NotificationCenter />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8 border border-white/20">
                    <AvatarImage src={user?.avatar || undefined} alt={user?.name || "User"} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(user?.name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-black/90 border-white/10 text-foreground" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name || "User"}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email || "No email"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem 
                  className="focus:bg-white/10 cursor-pointer"
                  onClick={() => setLocation("/profile")}
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="focus:bg-white/10 cursor-pointer"
                  onClick={() => setLocation("/settings")}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem className="focus:bg-white/10 cursor-pointer text-red-400 focus:text-red-400" onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 pt-20 md:pt-8 overflow-x-hidden">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
