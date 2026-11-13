// 사용법: DATABASE_URL=... npm run db:setup  (여러 번 실행해도 안전)
import postgres from "postgres";
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL 환경변수가 필요합니다.");
const sql = postgres(url, { prepare: false, onnotice: () => {} });
await sql.unsafe(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
console.log("DB 준비 완료");
await sql.end();
