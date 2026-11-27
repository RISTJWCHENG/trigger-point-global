import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { TradeError } from "@/lib/errors";
import { apiError } from "@/lib/http";
import { deleteComment, editComment } from "@/lib/market-service";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new TradeError("Sign in required", 401);
    const { id } = await context.params;
    const body = (await request.json()) as { body?: string };
    const result = await editComment(user.id, id, body.body ?? "");
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new TradeError("Sign in required", 401);
    const { id } = await context.params;
    const result = await deleteComment(user.id, id);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
