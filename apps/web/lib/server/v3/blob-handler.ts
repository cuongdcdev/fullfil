import { bearerMatches } from "./auth";
import { proofBytes, proofContentType } from "./service";

export async function GET(
  request: Request,
  context: { params: Promise<{ sha256: string }> },
) {
  const match = bearerMatches(request, process.env.PROOF_BLOB_TOKEN);
  if (match === undefined)
    return Response.json(
      {
        error: {
          code: "not_configured",
          message: "Proof blob token unavailable",
        },
      },
      { status: 503 },
    );
  if (!match)
    return Response.json(
      { error: { code: "unauthorized", message: "Invalid proof blob token" } },
      { status: 401 },
    );
  const { sha256 } = await context.params;
  if (!/^[a-f0-9]{64}$/.test(sha256))
    return Response.json(
      { error: { code: "not_found", message: "Proof not found" } },
      { status: 404 },
    );
  const bytes = proofBytes(sha256);
  if (!bytes)
    return Response.json(
      { error: { code: "not_found", message: "Proof not found" } },
      { status: 404 },
    );
  return new Response(new Uint8Array(bytes).buffer, {
    headers: {
      "Content-Type": proofContentType(sha256),
      "Content-Length": String(bytes.length),
    },
  });
}
