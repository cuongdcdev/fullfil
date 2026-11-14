export async function GET(
  request: Request,
  context: { params: Promise<{ sha256: string }> },
) {
  const handler = await import("../../../../lib/server/v3/blob-handler");
  return handler.GET(request, context);
}
