import { sql } from "./db";

// 사용자의 문항별 "가장 최근" 채점 결과가 오답인 문항 = 현재 오답
export async function wrongQuestionIds(userId: string, sectionId: number): Promise<number[]> {
  const rows = await sql<{ question_id: number }[]>`
    select question_id from (
      select distinct on (i.question_id) i.question_id, i.is_correct
      from attempt_items i join attempts a on a.id = i.attempt_id
      where a.user_id = ${userId} and a.section_id = ${sectionId}
      order by i.question_id, a.id desc
    ) t where not is_correct`;
  return rows.map((r) => r.question_id);
}

export async function canSeeBook(
  book: { status: string; created_by: string | null },
  userId: string | null,
  admin: boolean,
) {
  return book.status === "approved" || admin || (userId !== null && book.created_by === userId);
}
