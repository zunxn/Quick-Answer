"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { normalize, parseAnswers, type ParsedQ } from "@/lib/normalize";
import { adminToken, ensureUserId, getUserId, isAdmin } from "@/lib/user";

export type GradeResult = {
  attemptId: number;
  total: number;
  correct: number;
  items: { questionId: number; isCorrect: boolean; rate: number | null; solvers: number }[];
};

// 채점: 맞음/틀림만 돌려주고 정답은 돌려주지 않는다.
export async function gradeAction(
  sectionId: number,
  responses: { questionId: number; response: string }[],
  seconds: number,
  isRetry: boolean,
): Promise<GradeResult> {
  if (!Number.isInteger(sectionId) || !Array.isArray(responses) || responses.length === 0 || responses.length > 500)
    throw new Error("잘못된 요청입니다.");
  const userId = await ensureUserId();
  const questions = await sql<{ id: number; answer: string }[]>`
    select id, answer from questions where section_id = ${sectionId}`;
  const answerOf = new Map(questions.map((q) => [q.id, q.answer]));

  const seen = new Set<number>();
  const graded: { question_id: number; response: string; is_correct: boolean }[] = [];
  for (const r of responses) {
    const ans = answerOf.get(r.questionId);
    if (ans === undefined || seen.has(r.questionId)) continue;
    seen.add(r.questionId);
    const response = String(r.response ?? "").slice(0, 50);
    graded.push({
      question_id: r.questionId,
      response,
      is_correct: response.trim() !== "" && normalize(response) === normalize(ans),
    });
  }
  if (graded.length === 0) throw new Error("채점할 문항이 없습니다.");
  const correct = graded.filter((g) => g.is_correct).length;
  const secs = Math.max(0, Math.min(86400, Math.round(Number(seconds) || 0)));

  const attemptId = await sql.begin(async (tx) => {
    const [a] = await tx`
      insert into attempts (user_id, section_id, total, correct, seconds, is_retry)
      values (${userId}, ${sectionId}, ${graded.length}, ${correct}, ${secs}, ${!!isRetry})
      returning id`;
    await tx`insert into attempt_items ${tx(graded.map((g) => ({ ...g, attempt_id: a.id })))}`;
    return a.id as number;
  });

  // 문항별 정답률: 사용자별 첫 시도 기준
  const stats = await sql<{ question_id: number; solvers: number; rate: number }[]>`
    select question_id, count(*)::int as solvers, avg(is_correct::int)::float as rate
    from (
      select distinct on (a.user_id, i.question_id) i.question_id, i.is_correct
      from attempt_items i join attempts a on a.id = i.attempt_id
      where a.section_id = ${sectionId}
      order by a.user_id, i.question_id, a.id
    ) t group by question_id`;
  const statOf = new Map(stats.map((s) => [s.question_id, s]));

  revalidatePath("/", "layout");
  return {
    attemptId,
    total: graded.length,
    correct,
    items: graded.map((g) => {
      const s = statOf.get(g.question_id);
      return { questionId: g.question_id, isCorrect: g.is_correct, rate: s?.rate ?? null, solvers: s?.solvers ?? 0 };
    }),
  };
}

// 정답 보기: 본인 채점 기록에서 틀린 문항의 정답만 공개
export async function revealAction(attemptId: number): Promise<{ questionId: number; answer: string }[]> {
  const userId = await getUserId();
  if (!userId || !Number.isInteger(attemptId)) return [];
  return await sql<{ questionId: number; answer: string }[]>`
    select q.id as "questionId", q.answer
    from attempt_items i
    join attempts a on a.id = i.attempt_id
    join questions q on q.id = i.question_id
    where a.id = ${attemptId} and a.user_id = ${userId} and not i.is_correct`;
}

export type SectionInput = { name: string; start: number; compact: boolean; answers: string };

export async function createBookAction(input: {
  title: string;
  subject: string;
  publisher: string;
  year: string;
  sections: SectionInput[];
}): Promise<{ error: string } | void> {
  const title = String(input.title ?? "").trim().slice(0, 80);
  const subject = String(input.subject ?? "").trim().slice(0, 40);
  const publisher = String(input.publisher ?? "").trim().slice(0, 40);
  const year = /^\d{4}$/.test(String(input.year)) ? Number(input.year) : null;
  if (!title || !subject) return { error: "문제집 이름과 과목을 입력해 주세요." };
  if (!Array.isArray(input.sections) || input.sections.length === 0 || input.sections.length > 80)
    return { error: "단원을 1개 이상 입력해 주세요." };

  const parsed: { name: string; qs: ParsedQ[] }[] = [];
  for (const s of input.sections) {
    const name = String(s.name ?? "").trim().slice(0, 60);
    const start = Number.isInteger(s.start) && s.start >= 0 && s.start < 100000 ? s.start : 1;
    const qs = parseAnswers(String(s.answers ?? "").slice(0, 20000), start, !!s.compact);
    if (!name) return { error: "단원 이름이 비어 있는 곳이 있습니다." };
    if (qs.length === 0) return { error: `'${name}' 단원에 정답이 없습니다.` };
    if (qs.length > 400) return { error: `'${name}' 단원의 문항이 너무 많습니다 (최대 400).` };
    if (qs.some((q) => q.answer === "" || q.answer.length > 30))
      return { error: `'${name}' 단원에 비어 있거나 너무 긴 정답이 있습니다.` };
    parsed.push({ name, qs });
  }

  const userId = await ensureUserId();
  const admin = await isAdmin();
  const [{ n }] = await sql`select count(*)::int as n from books where created_by = ${userId} and status = 'pending'`;
  if (!admin && n >= 10) return { error: "검토 대기 중인 문제집이 너무 많습니다. 검토 후 다시 등록해 주세요." };

  const bookId = await sql.begin(async (tx) => {
    const [b] = await tx`
      insert into books (title, subject, publisher, year, status, created_by)
      values (${title}, ${subject}, ${publisher}, ${year}, ${admin ? "approved" : "pending"}, ${userId})
      returning id`;
    for (let i = 0; i < parsed.length; i++) {
      const [sec] = await tx`
        insert into sections (book_id, name, ord) values (${b.id}, ${parsed[i].name}, ${i}) returning id`;
      await tx`insert into questions ${tx(
        parsed[i].qs.map((q, j) => ({ section_id: sec.id, label: q.label, ord: j, kind: q.kind, answer: q.answer })),
      )}`;
    }
    return b.id as number;
  });
  revalidatePath("/", "layout");
  redirect(`/books/${bookId}`);
}

export async function feedbackAction(body: string, page: string): Promise<{ ok: boolean }> {
  const text = String(body ?? "").trim().slice(0, 2000);
  if (!text) return { ok: false };
  const userId = await getUserId();
  await sql`insert into feedback (user_id, body, page) values (${userId}, ${text}, ${String(page ?? "").slice(0, 200)})`;
  return { ok: true };
}

// ── 관리자 ──
export async function adminLoginAction(formData: FormData) {
  const token = adminToken();
  if (token && String(formData.get("password")) === process.env.ADMIN_PASSWORD) {
    (await cookies()).set("admin", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }
  redirect("/admin");
}

export async function approveBookAction(formData: FormData) {
  if (!(await isAdmin())) throw new Error("권한이 없습니다.");
  await sql`update books set status = 'approved' where id = ${Number(formData.get("id"))}`;
  revalidatePath("/", "layout");
}

export async function deleteBookAction(formData: FormData) {
  if (!(await isAdmin())) throw new Error("권한이 없습니다.");
  await sql`delete from books where id = ${Number(formData.get("id"))}`;
  revalidatePath("/", "layout");
}
