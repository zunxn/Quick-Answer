import RegisterForm from "./RegisterForm";

export default function RegisterPage() {
  return (
    <>
      <h1>문제집 등록</h1>
      <p className="muted">
        객관식·단답형 정답만 등록합니다 (서술형 제외). 등록 후 바로 본인은 사용할 수 있고, 검토를 통과하면 모두에게 공개됩니다.
      </p>
      <RegisterForm />
    </>
  );
}
