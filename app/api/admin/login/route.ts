import { NextResponse } from "next/server"
import {
  SESSION_COOKIE,
  isAuthConfigured,
  issueSessionToken,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth"
import { clientKey, recordFailure, recordSuccess, retryAfterSeconds } from "@/lib/rate-limit"

const SESSION_TTL_SECONDS = 8 * 60 * 60

export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      {
        success: false,
        message: "Admin access is not configured on this server. Set the ADMIN_PASSWORD environment variable.",
      },
      { status: 503 },
    )
  }

  // Refuse before checking the password, so a blocked client learns nothing about
  // whether its guess was right.
  const key = clientKey(request)
  const wait = retryAfterSeconds(key)
  if (wait > 0) {
    return NextResponse.json(
      { success: false, message: `Too many failed attempts. Try again in ${wait} seconds.` },
      { status: 429, headers: { "Retry-After": String(wait) } },
    )
  }

  let password = ""
  try {
    const body = await request.json()
    password = typeof body?.password === "string" ? body.password : ""
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body." }, { status: 400 })
  }

  if (!verifyPassword(password)) {
    recordFailure(key)
    return NextResponse.json({ success: false, message: "Invalid password." }, { status: 401 })
  }

  recordSuccess(key)
  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE, issueSessionToken(), sessionCookieOptions(SESSION_TTL_SECONDS))
  return response
}
