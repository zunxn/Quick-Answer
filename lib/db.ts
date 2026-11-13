import postgres from "postgres";

const g = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };

// prepare:false — Supabase 커넥션 풀러(transaction mode)와 호환
export const sql =
  g.__sql ??
  (g.__sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 5 }));
