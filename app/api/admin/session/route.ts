import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE, isAuthConfigured, sessionCookieOptions, verifySessionToken } from "@/lib/auth"

/** Lets the admin page restore a session after reload without re-prompting. */
export async function GET() {
  const store = await cookies()
  return NextResponse.json({
    authenticated: verifySessionToken(store.get(SESSION_COOKIE)?.value),
    authConfigured: isAuthConfigured(),
  })
}

/** Log out: clear the session cookie. */
export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0))
  return response
}
