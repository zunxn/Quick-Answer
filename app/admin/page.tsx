import Link from "next/link";
import { sql } from "@/lib/db";
import { isAdmin } from "@/lib/user";
import { adminLoginAction, approveBookAction, deleteBookAction } from "../actions";

export const metadata = { robots: "noindex" };

export default async function AdminPage() {
  if (!(await isAdmin()))
    return (
      <form action={adminLoginAction} className="form narrow">
        <h1>관리자</h1>
        <input type="password" name="password" placeholder="비밀번호" autoFocus />
        <button className="btn primary">로그인</button>
      </form>
    );

  const [stats] = await sql`
    select (select count(*)::int from users) as users,
           (select count(*)::int from attempts) as attempts,
           (select count(*)::int from attempts where created_at > now() - interval '1 day') as attempts_24h,
           (select count(distinct user_id)::int from attempts where created_at > now() - interval '7 days') as active_7d`;
  const books = await sql`
    select b.id, b.title, b.subject, b.status, b.created_at,
           (select count(*)::int from questions q join sections s on s.id = q.section_id where s.book_id = b.id) as questions,
           (select count(*)::int from attempts a join sections s on s.id = a.section_id where s.book_id = b.id) as attempts
    from books b order by b.status desc, b.created_at desc`;
  const feedback = await sql`select id, body, page, created_at from feedback order by id desc limit 200`;
  const dt = (d: Date) => d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

  return (
    <>
      <h1>관리자</h1>
      <div className="stats">
        <div><b>{stats.users}</b>사용자</div>
        <div><b>{stats.active_7d}</b>7일 활성</div>
        <div><b>{stats.attempts}</b>총 채점</div>
        <div><b>{stats.attempts_24h}</b>24시간 채점</div>
      </div>

      <h2>문제집</h2>
      <ul className="list">
        {books.map((b) => (
          <li key={b.id} className="card sec">
            <div>
              <strong>
                <Link href={`/books/${b.id}`}>{b.title}</Link> {b.status === "pending" && <span className="tag warn">검토 대기</span>}
              </strong>
              <span className="muted">{b.subject} · {b.questions}문항 · 채점 {b.attempts}회 · {dt(b.created_at)}</span>
            </div>
            <div className="row">
              {b.status === "pending" && (
                <form action={approveBookAction}>
                  <input type="hidden" name="id" value={b.id} />
                  <button className="btn primary">승인</button>
                </form>
              )}
              <form action={deleteBookAction}>
                <input type="hidden" name="id" value={b.id} />
                <button className="btn ghost">삭제</button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      <h2>피드백 ({feedback.length})</h2>
      <ul className="list">
        {feedback.map((f) => (
          <li key={f.id} className="card">
            <span>{f.body}</span>
            <span className="muted">{dt(f.created_at)} · {f.page}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
