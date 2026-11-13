import Link from "next/link";
import { sql } from "@/lib/db";
import { getUserId } from "@/lib/user";

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 50);
  const userId = await getUserId();
  const like = "%" + q.replace(/[%_\\]/g, "\\$&") + "%";
  const books = await sql<
    { id: number; title: string; subject: string; publisher: string; year: number | null; status: string; sections: number }[]
  >`
    select b.id, b.title, b.subject, b.publisher, b.year, b.status,
           (select count(*)::int from sections s where s.book_id = b.id) as sections
    from books b
    where (b.status = 'approved' or b.created_by = ${userId})
      and (${q}::text = '' or b.title ilike ${like} or b.subject ilike ${like} or b.publisher ilike ${like})
    order by b.status desc, b.title
    limit 100`;

  return (
    <>
      <section className="hero">
        <h1>한 번에 풀고, 한 번에 채점.</h1>
        <p>답만 입력하면 틀린 번호만 알려줍니다. 정답은 다시 풀어본 뒤에 확인하세요.</p>
        <form className="search" action="/">
          <input name="q" defaultValue={q} placeholder="문제집 이름, 과목으로 검색" />
          <button className="btn primary">검색</button>
        </form>
      </section>

      {books.length === 0 ? (
        <p className="empty">
          {q ? `'${q}' 검색 결과가 없습니다. ` : "아직 등록된 문제집이 없습니다. "}
          <Link href="/register">직접 등록하기 →</Link>
        </p>
      ) : (
        <ul className="list">
          {books.map((b) => (
            <li key={b.id}>
              <Link href={`/books/${b.id}`} className="card">
                <span className="tag">{b.subject}</span>
                <strong>{b.title}</strong>
                <span className="muted">
                  {[b.publisher, b.year, `${b.sections}개 단원`].filter(Boolean).join(" · ")}
                  {b.status === "pending" && " · 검토 중 (나만 보임)"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
