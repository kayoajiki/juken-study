import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/jwt";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isAuthPath =
    path.startsWith("/login") || path.startsWith("/signup");

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const userId = token ? await verifySessionToken(token) : null;

  if (!userId && !isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (userId && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|sw\\.js|api/).*)",
  ],
};
