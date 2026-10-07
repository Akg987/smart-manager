import { NextResponse, type NextRequest } from "next/server";

const protectedPaths = [
  "/",
  "/dashboard",
  "/admin",
  "/users",
  "/organization",
  "/profile",
  "/kpis",
  "/checkins",
  "/actions",
  "/alerts",
  "/reports",
  "/kpi-reports",
  "/settings",
  "/modules",
  "/inbox",
  "/audit",
  "/sms-ippanel-hub",
];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const protectedRoute = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const sessionCookie = request.cookies.get("smart_manager_session")?.value;
  let authenticated = false;
  if (sessionCookie) {
    try {
      const api = process.env.NEST_API_URL ?? "http://localhost:4000";
      const response = await fetch(`${api}/api/auth/me`, {
        headers: { cookie: request.headers.get("cookie") ?? "" },
        cache: "no-store",
      });
      authenticated = response.ok;
    } catch {
      authenticated = false;
    }
  }
  if (protectedRoute && !authenticated) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  if (pathname === "/login" && authenticated)
    return NextResponse.redirect(new URL("/dashboard", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|fonts|assets).*)",
  ],
};
