import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import { sql } from "./db";

const UUID = /^[0-9a-f-]{36}$/;

// 개인정보 없이 브라우저 쿠키로만 사용자를 구분한다.
export async function getUserId(): Promise<string | null> {
  const v = (await cookies()).get("uid")?.value;
  return v && UUID.test(v) ? v : null;
}

// 서버 액션 안에서만 호출 (쿠키를 쓰기 때문)
export async function ensureUserId(): Promise<string> {
  const existing = await getUserId();
  if (existing) {
    const [row] = await sql`select id from users where id = ${existing}`;
    if (row) return existing;
  }
  const [u] = await sql`insert into users default values returning id`;
  (await cookies()).set("uid", u.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 400,
    path: "/",
  });
  return u.id;
}

export function adminToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return createHash("sha256").update("qa-admin:" + pw).digest("hex");
}

export async function isAdmin(): Promise<boolean> {
  const token = adminToken();
  const v = (await cookies()).get("admin")?.value;
  if (!token || !v || v.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(v), Buffer.from(token));
}
