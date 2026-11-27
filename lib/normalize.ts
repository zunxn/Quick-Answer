const SUP: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };

// 답 비교용 정규화: 공백/쉼표 제거, 전각→반각, 기호 통일
export function normalize(s: string): string {
  let t = s
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => "^" + [...m].map((c) => SUP[c]).join(""))
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/루트|sqrt/g, "√")
    .replace(/파이|pi/g, "π")
    .replace(/<=|=</g, "≤")
    .replace(/>=|=>/g, "≥")
    .replace(/[\s,·`]/g, "")
    .replace(/\*\*/g, "^");
  // "y=", "f(x)=", "y'=", "a=" 같은 앞부분은 없어도 정답 처리
  t = t.replace(/^[a-z]'?(\([a-z]\))?=/, "");
  return t;
}

function asNumber(s: string): number | null {
  const m = s.match(/^(-?)(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/);
  if (!m) return null;
  const v = Number(m[2]) / (m[3] ? Number(m[3]) : 1);
  return Number.isFinite(v) ? (m[1] ? -v : v) : null;
}

// answer는 "|"로 여러 허용 답을 가질 수 있다. 숫자는 값으로 비교 (0.5 = 1/2)
export function isCorrect(response: string, answer: string): boolean {
  const r = normalize(response);
  if (!r) return false;
  return answer.split("|").some((alt) => {
    const a = normalize(alt);
    if (a === r) return true;
    const x = asNumber(a), y = asNumber(r);
    return x !== null && y !== null && Math.abs(x - y) < 1e-9;
  });
}

// 화면에 보여줄 대표 정답 (허용 답 중 첫 번째)
export const displayAnswer = (answer: string) => answer.split("|")[0];

// "042(1)" → 42
export const baseNumber = (label: string) => parseInt(label, 10);

export type ParsedQ = { label: string; kind: "choice" | "short" | "self"; answer: string };

// 정답 입력 문자열 → 문항 목록
// - 띄어쓰기/줄바꿈으로 구분. 1~5 한 글자는 객관식, 그 외는 단답형
// - 단답형 정답이 1~5 한 글자이면 "=3"처럼 = 를 붙임
// - 자동 채점이 어려운 답(여러 값, 구간 등)은 "?"를 붙여 자가채점으로: 예) ?a=1,b=2
// - compact=true 이면 숫자를 붙여 써도 한 글자가 한 문항 (객관식 전용)
export function parseAnswers(raw: string, start: number, compact: boolean): ParsedQ[] {
  const tokens = compact ? raw.replace(/[^1-5]/g, "").split("") : raw.split(/\s+/).filter(Boolean);
  return tokens.map((t, i) => {
    const label = String(start + i);
    if (t.startsWith("?")) return { label, kind: "self", answer: t.slice(1) };
    const forcedShort = t.startsWith("=");
    const ans = forcedShort ? t.slice(1) : t;
    const kind = !forcedShort && /^[1-5]$/.test(ans) ? "choice" : "short";
    return { label, kind, answer: ans };
  });
}
