import { NextResponse } from "next/server";
import { authenticate, setSessionCookie } from "@/lib/auth";
import { apiError } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { login?: string; password?: string };
    const id = await authenticate(body.login ?? "", body.password ?? "");
    await setSessionCookie(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
