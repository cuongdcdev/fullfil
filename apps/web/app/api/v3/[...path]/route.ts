type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: Context) {
  const handler = await import("../../../../lib/server/v3/handler");
  return handler.GET(request, context);
}

export async function POST(request: Request, context: Context) {
  const handler = await import("../../../../lib/server/v3/handler");
  return handler.POST(request, context);
}

export async function PUT(request: Request, context: Context) {
  const handler = await import("../../../../lib/server/v3/handler");
  return handler.PUT(request, context);
}
