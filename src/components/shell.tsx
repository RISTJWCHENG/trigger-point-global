"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { Avatar } from "./avatar";
import { cn, formatTp } from "@/lib/format";

export type ShellUser = {
  id: string;
  username: string;
  name: string;
  balance: number;
  avatarColor: string;
  unread: number;
};

const ToastContext = createContext<(message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const links = [
  { href: "/?fy=0", label: "Home", match: "/", icon: HomeIcon },
  { href: "/topics", label: "Topics", match: "/topics", icon: TopicsIcon },
  { href: "/portfolio", label: "Portfolio", match: "/portfolio", icon: PortfolioIcon },
  { href: "/leaderboard", label: "Leaderboard", match: "/leaderboard", icon: BoardIcon },
  { href: "/notifications", label: "Notifications", match: "/notifications", icon: BellIcon },
];

export function Shell({ user, children }: { user: ShellUser | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  if (pathname.startsWith("/embed/")) {
    return <div className="min-h-screen bg-canvas text-ink">{children}</div>;
  }

  function toast(message: string) {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message }]);
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3200);
  }

  function active(match: string) {
    if (match === "/") return pathname === "/";
    return pathname === match || pathname.startsWith(`${match}/`);
  }

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <ToastContext.Provider value={toast}>
      <div className="min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col overflow-hidden border-r border-line bg-canvas lg:flex">
          <Link href="/?fy=0" className="flex shrink-0 items-center gap-2.5 px-5 pb-2 pt-5">
            <Logo />
            <span>
              <span className="block font-display text-[18px] leading-none tracking-tight text-ink">TriggerPoint</span>
              <span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.18em] text-muted">Global</span>
            </span>
          </Link>
          <nav className="mt-4 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                data-testid={`nav-${link.label.toLowerCase()}`}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
                  active(link.match) ? "bg-pill font-medium text-ink" : "text-secondary hover:bg-pill hover:text-ink",
                )}
              >
                <link.icon />
                <span className="flex-1">{link.label}</span>
                {link.label === "Notifications" && user && user.unread > 0 && (
                  <span className="num rounded-full bg-actionDeep px-1.5 py-0.5 text-[10px] font-medium text-[var(--action-ink)]">
                    {user.unread}
                  </span>
                )}
              </Link>
            ))}
            <Link href="/create" className="btn-primary mt-3 w-full" data-testid="nav-create">
              Create market
            </Link>
          </nav>
          <div className="shrink-0 border-t border-line p-3">
            {user ? (
              <div className="rounded-xl bg-pill p-3">
                <Link href={`/profile/${user.username}`} className="flex items-center gap-2.5">
                  <Avatar name={user.name} color={user.avatarColor} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
                    <span className="block truncate text-xs text-secondary">@{user.username}</span>
                  </span>
                </Link>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted">Balance</div>
                    <div className="num text-lg font-medium leading-tight text-ink" data-testid="user-balance">
                      {formatTp(user.balance)}
                      <span className="ml-1 text-xs font-normal text-secondary">TP</span>
                    </div>
                  </div>
                  <button type="button" onClick={signOut} className="text-xs text-secondary hover:text-ink">
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Link href="/signin" className="btn-primary w-full" data-testid="nav-signin">
                  Sign in
                </Link>
                <Link href="/signup" className="btn w-full border border-line bg-card text-ink hover:bg-pill">
                  Create account
                </Link>
              </div>
            )}
            <p className="mt-3 px-1 pb-1 text-[11px] leading-relaxed text-secondary">
              Play-money markets. TP has no cash value.
            </p>
            <ThemeToggle />
          </div>
        </aside>

        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-canvas px-4 py-3 lg:hidden">
          <Link href="/?fy=0" className="flex items-center gap-2">
            <Logo />
            <span className="font-display text-[17px] leading-none tracking-tight">TriggerPoint</span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <ThemeToggle compact />
                <Link href="/notifications" className="relative rounded-lg p-2 text-secondary hover:bg-pill" aria-label="Notifications">
                  <BellIcon />
                  {user.unread > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-action" />}
                </Link>
                <Link href="/portfolio" className="num rounded-full bg-pill px-2.5 py-1 text-xs font-medium text-ink" data-testid="user-balance-mobile">
                  {formatTp(user.balance, "compact")} TP
                </Link>
              </>
            ) : (
              <>
                <ThemeToggle compact />
                <Link href="/signin" className="btn-primary h-8 px-3 text-xs">
                  Sign in
                </Link>
              </>
            )}
          </div>
        </header>

        <main className="pb-20 lg:pb-10 lg:pl-[248px]">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-line bg-canvas lg:hidden">
          {[
            { href: "/?fy=0", label: "Home", match: "/", icon: HomeIcon },
            { href: "/topics", label: "Topics", match: "/topics", icon: TopicsIcon },
            { href: "/create", label: "Create", match: "/create", icon: PlusIcon },
            { href: "/leaderboard", label: "Board", match: "/leaderboard", icon: BoardIcon },
            { href: "/portfolio", label: "Portfolio", match: "/portfolio", icon: PortfolioIcon },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[10px]",
                active(item.match) ? "text-ink" : "text-muted",
              )}
            >
              <item.icon />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(100%-2rem,320px)] flex-col gap-2 lg:right-6 lg:top-6">
          {toasts.map((item) => (
            <div key={item.id} className="pointer-events-auto rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm text-ink shadow-sheet">
              {item.message}
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--action-deep)" />
      <path d="M16 7v18" stroke="var(--canvas)" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="16" cy="12.5" r="2.5" fill="var(--canvas)" />
    </svg>
  );
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      {children}
    </svg>
  );
}

function HomeIcon() {
  return (
    <Icon>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </Icon>
  );
}
function TopicsIcon() {
  return (
    <Icon>
      <path d="M5 6h14M5 12h14M5 18h9" strokeLinecap="round" />
    </Icon>
  );
}
function PortfolioIcon() {
  return (
    <Icon>
      <rect x="4" y="6" width="16" height="13" rx="2" />
      <path d="M8 6V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1" />
    </Icon>
  );
}
function BoardIcon() {
  return (
    <Icon>
      <path d="M5 19V10M12 19V5M19 19v-7" strokeLinecap="round" />
    </Icon>
  );
}
function BellIcon() {
  return (
    <Icon>
      <path d="M6 16h12l-1.2-2.2a6 6 0 0 1-.8-3V9a4 4 0 1 0-8 0v1.8a6 6 0 0 1-.8 3L6 16Z" />
      <path d="M10 16a2 2 0 0 0 4 0" />
    </Icon>
  );
}
function PlusIcon() {
  return (
    <Icon>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </Icon>
  );
}

function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    if (next === "dark") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    localStorage.setItem("tpg-theme", next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      data-testid="theme-toggle"
      className={compact ? "rounded-lg p-2 text-secondary hover:bg-pill" : "mt-2 w-full rounded-lg px-2 py-1.5 text-left text-xs text-secondary hover:bg-pill hover:text-ink"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}
