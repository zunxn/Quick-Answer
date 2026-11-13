// 답 비교용 정규화: 공백/쉼표 제거, 전각→반각, 기호 통일
export function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/루트|sqrt/g, "√")
    .replace(/파이|pi/g, "π")
    .replace(/[\s,]/g, "");
}

export type ParsedQ = { label: string; kind: "choice" | "short"; answer: string };

// 정답 입력 문자열 → 문항 목록
// - 띄어쓰기/줄바꿈/쉼표로 구분. 1~5 한 글자는 객관식, 그 외는 단답형
// - 단답형 정답이 1~5 한 글자이면 "=3"처럼 = 를 붙임
// - compact=true 이면 숫자를 붙여 써도 한 글자가 한 문항 (객관식 전용)
export function parseAnswers(raw: string, start: number, compact: boolean): ParsedQ[] {
  const tokens = compact
    ? raw.replace(/[^1-5]/g, "").split("")
    : raw.split(/[\s,]+/).filter(Boolean);
  return tokens.map((t, i) => {
    const forcedShort = t.startsWith("=");
    const ans = forcedShort ? t.slice(1) : t;
    const kind = !forcedShort && /^[1-5]$/.test(ans) ? "choice" : "short";
    return { label: String(start + i), kind, answer: ans };
  });
}
