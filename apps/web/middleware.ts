import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const rawPath = new URL(request.url).pathname;
  try {
    decodeURIComponent(rawPath);
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
