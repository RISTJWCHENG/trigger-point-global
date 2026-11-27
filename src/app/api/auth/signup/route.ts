import { NextResponse } from "next/server";
import { registerUser, setSessionCookie } from "@/lib/auth";
import { apiError } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; name?: string; email?: string; password?: string };
    const user = await registerUser({
      username: body.username ?? "",
      name: body.name ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
    });
    await setSessionCookie(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
