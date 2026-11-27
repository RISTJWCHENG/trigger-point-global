import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { Shell, type ShellUser } from "@/components/shell";
import { getCurrentUser } from "@/lib/auth";
import { seedDatabase } from "@/lib/seed";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

export const metadata: Metadata = {
  title: { default: "TriggerPointGlobal", template: "%s · TriggerPointGlobal" },
  description: "Play-money prediction markets with a calm trading desk and a constant-product market maker.",
};

export const dynamic = "force-dynamic";

let seeding: Promise<void> | null = null;

function ensureSeeded() {
  if (process.env.NEXT_PHASE === "phase-production-build") return Promise.resolve();
  if (!seeding) {
    seeding = seedDatabase().catch((error) => {
      seeding = null;
      throw error;
    });
  }
  return seeding;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await ensureSeeded();
  const current = await getCurrentUser();
  const user: ShellUser | null = current
    ? {
        id: current.id,
        username: current.username,
        name: current.name,
        balance: current.balance,
        avatarColor: current.avatarColor,
        unread: current.unread,
      }
    : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("tpg-theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`,
          }}
        />
      </head>
      <body className={`${outfit.variable} ${fraunces.variable} font-sans antialiased`}>
        <Shell user={user}>{children}</Shell>
      </body>
    </html>
  );
}
