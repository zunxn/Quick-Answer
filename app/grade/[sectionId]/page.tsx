import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { canSeeBook, wrongQuestionIds } from "@/lib/queries";
import { getUserId, isAdmin } from "@/lib/user";
import { baseNumber } from "@/lib/normalize";
import GradeForm from "./GradeForm";

export default async function GradePage({
  params,
  searchParams,
}: {
  params: Promise<{ sectionId: string }>;
  searchParams: Promise<{ retry?: string; from?: string; to?: string }>;
}) {
  const sectionId = Number((await params).sectionId);
  if (!Number.isInteger(sectionId)) notFound();
  const sp = await searchParams;
  const retry = sp.retry === "1";
  const from = parseInt(sp.from ?? "", 10);
  const to = parseInt(sp.to ?? "", 10);
  const userId = await getUserId();

  const [sec] = await sql`
    select s.id, s.grp, s.name, s.note, b.id as book_id, b.title, b.status, b.created_by
    from sections s join books b on b.id = s.book_id where s.id = ${sectionId}`;
  if (!sec || !(await canSeeBook(sec as never, userId, await isAdmin()))) notFound();

  // 정답(answer)은 절대 클라이언트로 보내지 않는다.
  const all = await sql<{ id: number; label: string; kind: "choice" | "short" | "self" }[]>`
    select id, label, kind from questions where section_id = ${sectionId} order by ord`;
  const nums = all.map((q) => baseNumber(q.label)).filter((n) => !Number.isNaN(n));
  const minN = nums.length ? Math.min(...nums) : 0;
  const maxN = nums.length ? Math.max(...nums) : 0;
  const ranged = !retry && (!Number.isNaN(from) || !Number.isNaN(to));
  let questions = all.filter((q) => {
    if (!ranged) return true;
    const n = baseNumber(q.label);
    return (Number.isNaN(from) || n >= from) && (Number.isNaN(to) || n <= to);
  });
  if (retry && userId) {
    const wrong = new Set(await wrongQuestionIds(userId, sectionId));
    questions = questions.filter((q) => wrong.has(q.id)) as typeof questions;
  }

  return (
    <>
      <p className="crumb"><Link href={`/books/${sec.book_id}`}>← {sec.title}</Link></p>
      {sec.grp && <p className="crumb">{sec.grp}</p>}
      <h1>{sec.name}{retry && " — 오답 다시 풀기"}</h1>
      {sec.note && <p className="muted">{sec.note}</p>}
      {!retry && nums.length > 0 && (
        <form className="range" action={`/grade/${sectionId}`}>
          <span>범위</span>
          <input name="from" inputMode="numeric" defaultValue={Number.isNaN(from) ? "" : from} placeholder={String(minN)} aria-label="시작 번호" />
          <span>~</span>
          <input name="to" inputMode="numeric" defaultValue={Number.isNaN(to) ? "" : to} placeholder={String(maxN)} aria-label="끝 번호" />
          <button className="btn">적용</button>
        </form>
      )}
      {questions.length === 0 ? (
        <p className="empty">{retry ? "남은 오답이 없습니다. 🎉" : "이 범위에는 문항이 없습니다."}</p>
      ) : (
        <GradeForm
          key={`${retry}-${from}-${to}`}
          sectionId={sectionId}
          questions={questions.map((q) => ({ id: q.id, label: q.label, kind: q.kind }))}
          initialRetry={retry}
        />
      )}
    </>
  );
}
