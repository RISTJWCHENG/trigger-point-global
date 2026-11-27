export async function postJson<T>(url: string, body?: unknown, method: "POST" | "PATCH" | "DELETE" = "POST"): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "DELETE" ? undefined : JSON.stringify(body ?? {}),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export function safeNext(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
