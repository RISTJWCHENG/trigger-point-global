import { NextResponse } from "next/server";
import { demoUserId, setSessionCookie } from "@/lib/auth";
import { apiError } from "@/lib/http";

export async function POST() {
  try {
    const id = await demoUserId();
    await setSessionCookie(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
