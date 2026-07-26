import { NextResponse } from "next/server"
import {
  SESSION_COOKIE,
  isAuthConfigured,
  issueSessionToken,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth"

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

  let password = ""
  try {
    const body = await request.json()
    password = typeof body?.password === "string" ? body.password : ""
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body." }, { status: 400 })
  }

  if (!verifyPassword(password)) {
    return NextResponse.json({ success: false, message: "Invalid password." }, { status: 401 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE, issueSessionToken(), sessionCookieOptions(SESSION_TTL_SECONDS))
  return response
}
