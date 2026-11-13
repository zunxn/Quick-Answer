import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { canSeeBook, wrongQuestionIds } from "@/lib/queries";
import { getUserId, isAdmin } from "@/lib/user";
import GradeForm from "./GradeForm";

export default async function GradePage({
  params,
  searchParams,
}: {
  params: Promise<{ sectionId: string }>;
  searchParams: Promise<{ retry?: string }>;
}) {
  const sectionId = Number((await params).sectionId);
  if (!Number.isInteger(sectionId)) notFound();
  const retry = (await searchParams).retry === "1";
  const userId = await getUserId();

  const [sec] = await sql`
    select s.id, s.name, b.id as book_id, b.title, b.status, b.created_by
    from sections s join books b on b.id = s.book_id where s.id = ${sectionId}`;
  if (!sec || !(await canSeeBook(sec as never, userId, await isAdmin()))) notFound();

  // 정답(answer)은 절대 클라이언트로 보내지 않는다.
  let questions = await sql<{ id: number; label: string; kind: "choice" | "short" }[]>`
    select id, label, kind from questions where section_id = ${sectionId} order by ord`;
  if (retry && userId) {
    const wrong = new Set(await wrongQuestionIds(userId, sectionId));
    questions = questions.filter((q) => wrong.has(q.id)) as typeof questions;
  }

  return (
    <>
      <p className="crumb"><Link href={`/books/${sec.book_id}`}>← {sec.title}</Link></p>
      <h1>{sec.name}{retry && " — 오답 다시 풀기"}</h1>
      {questions.length === 0 ? (
        <p className="empty">남은 오답이 없습니다. 🎉</p>
      ) : (
        <GradeForm
          key={retry ? "retry" : "full"}
          sectionId={sectionId}
          questions={questions.map((q) => ({ id: q.id, label: q.label, kind: q.kind }))}
          initialRetry={retry}
        />
      )}
    </>
  );
}
