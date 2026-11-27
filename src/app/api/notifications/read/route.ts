import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { TradeError } from "@/lib/errors";
import { apiError } from "@/lib/http";
import { markNotificationsRead } from "@/lib/market-service";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new TradeError("Sign in required", 401);
    const body = (await request.json().catch(() => ({}))) as { id?: string };
    await markNotificationsRead(user.id, body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
