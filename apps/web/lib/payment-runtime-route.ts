import { NextRequest, NextResponse } from "next/server";

const ALLOWED = /^(?:products|checkout|portal|me|checkouts\/[A-Za-z0-9_-]+)$/u;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

async function proxy(request: NextRequest, segments: string[]): Promise<NextResponse> {
  const path = segments.join("/");
  if (!ALLOWED.test(path)) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Payment route not found" } },
      { status: 404 },
    );
  }
  const baseUrl = process.env.SPK_PAYMENT_RUNTIME_API_URL?.replace(/\/$/u, "") ?? "";
  const credential = process.env.SPK_PAYMENT_RUNTIME_CREDENTIAL ?? "";
  if (!baseUrl || !credential) {
    return NextResponse.json(
      { error: { code: "payments_not_configured", message: "Payments are not enabled for this application." } },
      { status: 503 },
    );
  }
  const headers = new Headers({
    authorization: `Bearer ${credential}`,
    accept: "application/json",
  });
  const identity = request.headers.get("x-spk-supabase-access-token");
  if (identity) headers.set("x-spk-supabase-access-token", identity);
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
  const body = request.method === "POST" ? await request.text() : undefined;
  if (body) headers.set("content-type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/${path}`, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return NextResponse.json(
      { error: { code: "payments_unavailable", message: "Payments are temporarily unavailable." } },
      { status: 503 },
    );
  }
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_RESPONSE_BYTES) {
    return NextResponse.json(
      { error: { code: "response_too_large", message: "The payment response is invalid." } },
      { status: 502 },
    );
  }
  const payload = await response.arrayBuffer();
  if (payload.byteLength > MAX_RESPONSE_BYTES) {
    return NextResponse.json(
      { error: { code: "response_too_large", message: "The payment response is invalid." } },
      { status: 502 },
    );
  }
  return new NextResponse(payload, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
      "cache-control": "no-store",
    },
  });
}

function paymentRuntimeRequest(
  request: NextRequest,
  context: { params: Promise<{ paymentPath: string[] }> },
) {
  return context.params.then(({ paymentPath }) => proxy(request, paymentPath));
}

export const paymentRuntimeGET = paymentRuntimeRequest;
export const paymentRuntimePOST = paymentRuntimeRequest;
