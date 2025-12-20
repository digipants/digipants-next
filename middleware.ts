import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // 🔒 Premium-only routes
    if (
      pathname.startsWith("/dashboard/premium") &&
      token?.subscription !== "premium"
    ) {
      return NextResponse.redirect(
        new URL("/upgrade", req.url)
      );
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*"],
};
