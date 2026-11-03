import { Link, useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ChevronDown,
  Menu,
  LogOut,
  Settings,
  UserRound,
  Truck,
  BarChart3,
  Boxes,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "./ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { routes, permitted, routeFor } from "@/lib/routes";
import NotificationCenter from "./NotificationCenter";
import { SectionNav } from "./Workspace";
import { safeSessionStorage } from "@/lib/storage";
export default function Layout({ children }: { children: React.ReactNode }) {
  const [path, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { mode, setMode, demoIdentity } = useData();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const main = useRef<HTMLElement>(null);
  const focusAfterNavigation = useRef(false);
  const closeForNavigation = () => {
    focusAfterNavigation.current = open;
    setOpen(false);
    window.scrollTo(0, 0);
  };
  const current = routeFor(path);
  useEffect(() => {
    if (open) focusAfterNavigation.current = true;
    setOpen(false);
    if (current?.group)
      setCollapsed(prior => ({ ...prior, [current.group]: false }));
    document.title = `${current?.label ?? "Page"} | IMSOP`;
    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
      main.current?.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(timer);
  }, [path, current?.label]);
  const navigation = (
    <>
      <Link href="/" className="brand" onClick={closeForNavigation}>
        <span className="brand-mark">
          <img
            src={`${import.meta.env.BASE_URL}favicon.png`}
            width="36"
            height="36"
            alt=""
          />
        </span>
        <span>
          IMSOP<small>OPERATIONS PLATFORM</small>
        </span>
      </Link>
      <nav aria-label="Main navigation" className="main-nav">
        {["Workspace", "Supply chain", "Insights", "Infrastructure"].map(
          group => {
            const items = routes.filter(
              r => r.group === group && permitted(r, user)
            );
            return (
              items.length > 0 && (
                <div
                  className={`nav-group ${group === "Workspace" ? "nav-overview" : ""}`}
                  key={group}
                >
                  {group !== "Workspace" && (
                    <button
                      type="button"
                      className="nav-group-toggle"
                      aria-expanded={!collapsed[group]}
                      onClick={() =>
                        setCollapsed(prior => ({
                          ...prior,
                          [group]: !prior[group],
                        }))
                      }
                    >
                      <span>
                        {group === "Supply chain" ? (
                          <Truck size={15} />
                        ) : group === "Insights" ? (
                          <BarChart3 size={15} />
                        ) : (
                          <Boxes size={15} />
                        )}{" "}
                        {group}
                      </span>
                      <ChevronDown size={12} aria-hidden="true" />
                    </button>
                  )}
                  {(!collapsed[group] || group === "Workspace") &&
                    items.map(r => (
                      <Link
                        key={r.id}
                        href={r.href}
                        className="nav-link"
                        onClick={closeForNavigation}
                        aria-current={current?.id === r.id ? "page" : undefined}
                      >
                        <r.icon size={18} />
                        <span>{r.label}</span>
                      </Link>
                    ))}
                </div>
              )
            );
          }
        )}
      </nav>
      <div className="sidebar-footer">
        <Link
          href="/profile"
          className="sidebar-profile"
          onClick={closeForNavigation}
        >
          <span className="avatar-initial">
            {user?.name
              ?.split(" ")
              .map(n => n[0])
              .slice(0, 2)
              .join("")}
          </span>
          <span>
            <strong>{user?.name}</strong>
            <small>{user?.role}</small>
          </span>
          <ChevronDown size={14} />
        </Link>
        <Link
          href="/settings"
          className="sidebar-preferences"
          onClick={closeForNavigation}
        >
          Preferences
        </Link>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <a
        href="#main-content"
        className="skip-link"
        onClick={e => {
          e.preventDefault();
          window.scrollTo(0, 0);
          main.current?.focus({ preventScroll: true });
        }}
      >
        Skip to main content
      </a>
      <aside className="sidebar">{navigation}</aside>
      <div className="shell-content">
        <header className="shell-header">
          <div className="header-leading">
            <Sheet
              open={open}
              onOpenChange={next => {
                setOpen(next);
                if (next) setCollapsed({});
              }}
            >
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open navigation menu"
                  className="mobile-menu"
                >
                  <Menu size={22} />
                  <span>Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="drawer"
                onCloseAutoFocus={event => {
                  if (focusAfterNavigation.current) {
                    event.preventDefault();
                    focusAfterNavigation.current = false;
                    main.current?.focus({ preventScroll: true });
                  }
                }}
              >
                <SheetTitle className="sr-only">Main navigation</SheetTitle>
                <SheetDescription className="sr-only">
                  Choose a destination. Escape closes navigation.
                </SheetDescription>
                {navigation}
              </SheetContent>
            </Sheet>
            <span className="mobile-page-label" aria-hidden="true">
              {current?.label ?? "Workspace"}
            </span>
            <nav aria-label="Breadcrumb" className="breadcrumbs">
              <Link href="/">Workspace</Link>
              {current?.id !== "overview" && (
                <>
                  <span>/</span>
                  <span>{current?.group}</span>
                  <span>/</span>
                  <span aria-current="page">{current?.label ?? "Page"}</span>
                </>
              )}
            </nav>
          </div>
          <div className="header-actions">
            <label className="header-select">
              <span className="sr-only">Data mode</span>
              <select
                aria-label="Data mode"
                value={mode}
                onChange={async e => {
                  const next = e.target.value as "live" | "demo";
                  if (next === "live" && demoIdentity) {
                    safeSessionStorage.setItem(
                      "imsop:return-to",
                      window.location.hash
                    );
                    await logout();
                    navigate("/login?mode=live");
                  } else setMode(next);
                }}
              >
                <option value="live">Live</option>
                <option value="demo">Demo</option>
              </select>
            </label>
            <ThemeSwitcher />
            <NotificationCenter />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="account-button"
                  aria-label="Account menu"
                >
                  <span className="avatar-initial">
                    {user?.name?.slice(0, 1)}
                  </span>
                  <span className="account-name">{user?.name}</span>
                  <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <UserRound />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings />
                    Preferences
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          ref={main}
          className="main-content"
        >
          {children}
        </main>
        <footer className="page-footer">
          IMSOP <span>Supply chain & operations workspace</span>
          <span>
            {mode === "demo"
              ? "Demonstration environment"
              : "Workspace operations"}
          </span>
        </footer>
      </div>
    </div>
  );
}
