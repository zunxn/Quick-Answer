import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { canSeeBook } from "@/lib/queries";
import { getUserId, isAdmin } from "@/lib/user";

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const userId = await getUserId();
  const [book] = await sql`select * from books where id = ${id}`;
  if (!book || !(await canSeeBook(book as never, userId, await isAdmin()))) notFound();

  const sections = await sql<
    { id: number; name: string; note: string; total: number; last_correct: number | null; last_total: number | null; wrong: number }[]
  >`
    select s.id, s.name, s.note,
      (select count(*)::int from questions q where q.section_id = s.id) as total,
      la.correct as last_correct, la.total as last_total,
      coalesce((
        select count(*)::int from (
          select distinct on (i.question_id) i.is_correct
          from attempt_items i join attempts a on a.id = i.attempt_id
          where a.user_id = ${userId} and a.section_id = s.id
          order by i.question_id, a.id desc
        ) t where not is_correct), 0) as wrong
    from sections s
    left join lateral (
      select correct, total from attempts a
      where a.user_id = ${userId} and a.section_id = s.id and not a.is_retry
      order by a.id desc limit 1
    ) la on true
    where s.book_id = ${id}
    order by s.ord`;

  return (
    <>
      <p className="crumb"><Link href="/">← 문제집 목록</Link></p>
      <h1>{book.title}</h1>
      <p className="muted">
        {[book.subject, book.publisher, book.year].filter(Boolean).join(" · ")}
        {book.status === "pending" && " · 검토 중 — 승인 전까지 나에게만 보입니다"}
      </p>
      <ul className="list">
        {sections.map((s) => (
          <li key={s.id} className="card sec">
            <div>
              <strong>{s.name}</strong>
              <span className="muted">
                {s.total}문항
                {s.last_total !== null && ` · 최근 ${s.last_correct}/${s.last_total}`}
                {s.wrong > 0 && ` · 남은 오답 ${s.wrong}개`}
              </span>
              {s.note && <span className="muted small">{s.note}</span>}
            </div>
            <div className="row">
              {s.wrong > 0 && (
                <Link className="btn" href={`/grade/${s.id}?retry=1`}>오답 다시 풀기</Link>
              )}
              <Link className="btn primary" href={`/grade/${s.id}`}>채점하기</Link>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
