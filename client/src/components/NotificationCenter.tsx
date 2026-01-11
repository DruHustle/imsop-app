import { Bell, Check, CheckCheck, Info, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { safeLocalStorage } from "@/lib/storage";
import { useState, useEffect } from "react";

interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  isRead: boolean;
  createdAt: Date;
}

const typeIcons = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle,
};

const typeColors = {
  info: "text-blue-400",
  warning: "text-amber-400",
  error: "text-red-400",
  success: "text-green-400",
};

const NOTIFICATIONS_KEY = 'imsop_notifications';

// Demo notifications
const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    title: "Shipment Delayed",
    message: "Shipment SHP-2024-001 has been delayed due to weather conditions in the Pacific region.",
    type: "warning",
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
  },
  {
    id: 2,
    title: "New Integration Available",
    message: "SAP S/4HANA integration is now available. Connect your ERP system for real-time data sync.",
    type: "info",
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
  },
  {
    id: 3,
    title: "System Update Complete",
    message: "IMSOP has been updated to version 2.5.0 with improved analytics and AI capabilities.",
    type: "success",
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
  },
  {
    id: 4,
    title: "High CPU Usage Alert",
    message: "Microservice 'inventory-sync' is experiencing high CPU usage. Consider scaling resources.",
    type: "error",
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
  },
];

function getNotifications(): Notification[] {
  const stored = safeLocalStorage.getItem(NOTIFICATIONS_KEY);
  if (!stored) {
    safeLocalStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(DEMO_NOTIFICATIONS));
    return DEMO_NOTIFICATIONS;
  }
  return JSON.parse(stored).map((n: Notification) => ({
    ...n,
    createdAt: new Date(n.createdAt),
  }));
}

function saveNotifications(notifications: Notification[]): void {
  safeLocalStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setNotifications(getNotifications());
    setIsLoading(false);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAsRead = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = notifications.map(n => 
      n.id === id ? { ...n, isRead: true } : n
    );
    setNotifications(updated);
    saveNotifications(updated);
  };

  const handleMarkAllAsRead = () => {
    const updated = notifications.map(n => ({ ...n, isRead: true }));
    setNotifications(updated);
    saveNotifications(updated);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-[10px] font-bold flex items-center justify-center text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 glass border-white/10">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 px-2 text-xs"
              onClick={handleMarkAllAsRead}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = typeIcons[notification.type] || Info;
              const colorClass = typeColors[notification.type] || "text-blue-400";
              
              return (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-3 p-3 cursor-pointer focus:bg-white/5",
                    !notification.isRead && "bg-white/5"
                  )}
                >
                  <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", colorClass)} />
                  <div className="flex-1 space-y-1">
                    <p className={cn("text-sm font-medium", !notification.isRead && "text-white")}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={(e) => handleMarkAsRead(notification.id, e)}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                </DropdownMenuItem>
              );
            })
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
