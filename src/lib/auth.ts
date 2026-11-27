import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { STARTING_BALANCE } from "./constants";
import { prisma } from "./db";
import { TradeError } from "./errors";
import { uid } from "./format";
import { hashPassword, verifyPassword } from "./password";

export { hashPassword, verifyPassword };

const COOKIE = "tpg_session";
const WEEK = 60 * 60 * 24 * 30;

function secret() {
  return process.env.AUTH_SECRET || "triggerpoint-global-dev-secret";
}

export function signSession(userId: string): string {
  const body = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + WEEK * 1000 })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readToken(token: string | undefined): string | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as { uid?: string; exp?: number };
    if (!payload.uid || !payload.exp || payload.exp < Date.now()) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE, signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: WEEK,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

const userSelect = {
  id: true,
  username: true,
  name: true,
  balance: true,
  startingBalance: true,
  bio: true,
  avatarColor: true,
  isDemo: true,
  lastBonusAt: true,
  createdAt: true,
} as const;

export async function getCurrentUser() {
  const jar = await cookies();
  const userId = readToken(jar.get(COOKIE)?.value);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
  if (!user) return null;
  const unread = await prisma.notification.count({ where: { userId: user.id, read: false } });
  return { ...user, createdAt: user.createdAt.toISOString(), unread };
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

const COLORS = ["#2A333D", "#3D4F63", "#345E4A", "#6E4545", "#5C5346", "#3E4C55", "#4A4458", "#3A5348"];

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export async function registerUser(input: { username: string; name: string; email: string; password: string }) {
  const username = normalizeUsername(input.username);
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    throw new TradeError("Usernames are 3–20 characters: letters, numbers, and underscores");
  }
  if (name.length < 2 || name.length > 40) throw new TradeError("Enter your name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new TradeError("Enter a valid email");
  if (input.password.length < 6) throw new TradeError("Use at least 6 characters for the password");
  try {
    const user = await prisma.user.create({
      data: {
        id: uid("usr"),
        username,
        name,
        email,
        passwordHash: hashPassword(input.password),
        balance: STARTING_BALANCE,
        startingBalance: STARTING_BALANCE,
        avatarColor: COLORS[username.length % COLORS.length],
        bio: "",
      },
      select: { id: true },
    });
    return user;
  } catch {
    throw new TradeError("That username or email is already registered");
  }
}

export async function authenticate(login: string, password: string) {
  const key = login.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: key }, { username: key }] },
  });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new TradeError("Incorrect email, username, or password", 401);
  }
  return user.id;
}

export async function demoUserId() {
  const user = await prisma.user.findUnique({ where: { username: "demo" }, select: { id: true } });
  if (!user) throw new TradeError("The demo desk isn't ready yet. Start the app once so it can seed.", 503);
  return user.id;
}
