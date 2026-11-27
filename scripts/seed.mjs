// 사용법: DATABASE_URL=... node scripts/seed.mjs data/파일.json
// 같은 제목의 문제집이 있으면 지우고 다시 넣는다 (채점 기록도 함께 삭제되므로 주의).
import postgres from "postgres";
import { readFileSync } from "node:fs";

const [file, flag] = process.argv.slice(2);
if (!file) throw new Error("JSON 파일 경로가 필요합니다.");
const book = JSON.parse(readFileSync(file, "utf8"));
const sql = postgres(process.env.DATABASE_URL, { prepare: false, onnotice: () => {} });

const [existing] = await sql`select id from books where title = ${book.title}`;
if (existing && flag !== "--replace") {
  console.log(`'${book.title}' 이미 있음 (id ${existing.id}). 덮어쓰려면 --replace`);
  await sql.end();
  process.exit(0);
}
await sql.begin(async (tx) => {
  if (existing) await tx`delete from books where id = ${existing.id}`;
  const [b] = await tx`
    insert into books (title, subject, publisher, year, status)
    values (${book.title}, ${book.subject}, ${book.publisher ?? ""}, ${book.year ?? null}, 'approved') returning id`;
  for (const [i, s] of book.sections.entries()) {
    const [sec] = await tx`
      insert into sections (book_id, name, ord, note) values (${b.id}, ${s.name}, ${i}, ${s.note ?? ""}) returning id`;
    await tx`insert into questions ${tx(s.questions.map((q, j) => ({ section_id: sec.id, label: q.label, ord: j, kind: q.kind, answer: q.answer })))}`;
  }
  console.log(`등록 완료: ${book.title} (id ${b.id}), ${book.sections.length}개 단원, ${book.sections.reduce((n, s) => n + s.questions.length, 0)}문항`);
});
await sql.end();
