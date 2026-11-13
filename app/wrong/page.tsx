import Link from "next/link";
import { sql } from "@/lib/db";
import { getUserId } from "@/lib/user";

export default async function WrongPage() {
  const userId = await getUserId();
  const rows = userId
    ? await sql<{ book_id: number; title: string; section_id: number; name: string; labels: string[] }[]>`
        select b.id as book_id, b.title, s.id as section_id, s.name,
               array_agg(q.label order by q.ord) as labels
        from (
          select distinct on (i.question_id) i.question_id, i.is_correct
          from attempt_items i join attempts a on a.id = i.attempt_id
          where a.user_id = ${userId}
          order by i.question_id, a.id desc
        ) t
        join questions q on q.id = t.question_id
        join sections s on s.id = q.section_id
        join books b on b.id = s.book_id
        where not t.is_correct
        group by b.id, b.title, s.id, s.name, s.ord
        order by b.title, s.ord`
    : [];

  return (
    <>
      <h1>내 오답</h1>
      <p className="muted">다시 풀어서 맞히면 목록에서 사라집니다. 기록은 이 브라우저에만 연결됩니다.</p>
      {rows.length === 0 ? (
        <p className="empty">남은 오답이 없습니다.</p>
      ) : (
        <ul className="list">
          {rows.map((r) => (
            <li key={r.section_id} className="card sec">
              <div>
                <strong>{r.title} — {r.name}</strong>
                <span className="muted">{r.labels.join(", ")}번 ({r.labels.length}개)</span>
              </div>
              <Link className="btn primary" href={`/grade/${r.section_id}?retry=1`}>다시 풀기</Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
