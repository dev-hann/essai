# InkOS vs Essai 리뷰/파이프라인 비교 — 개선 플랜

> **For Hermes:** 이 플랜은 essai의 리뷰 및 파이프라인 개선 방향을 정의합니다.

**Goal:** InkOS의 장점을 essai에 흡수하면서 essai의 단순함은 유지하기

---

## InkOS 파이프라인 분석

### 단편 (short-fiction) 파이프라인: 7단계

```
1. Creating outline          → PlannerAgent
2. Reviewing outline         → OutlineReviewerAgent (점수 매김)
3. Revising outline          → OutlineReviserAgent (리뷰 기반 수정)
4. Writing draft             → WriterAgent (전체 챕터 한 번에)
5. Reviewing draft           → DraftReviewerAgent
6. Revising draft            → DraftReviserAgent (리뷰 기반 수정)
7. Packaging (시놉시스+표지)   → PackagingAgent
```

### 장편 (book) 파이프라인: 챕터당 5단계

```
1. Preparing chapter inputs  → ComposerAgent (맥락 조합)
2. Writing chapter draft      → WriterAgent
3. Auditing draft             → ContinuityAuditor + AI tells 검사 + 금지어 검사
4. Review cycle               → 점수 85점 이상까지 assess → revise 루프
5. Truth persistence          → 캐릭터 상태/팩트 저장
```

### InkOS의 핵심 검증 메커니즘

```
chapter-review-cycle.js:
  1. 길이 정규화 (hard range 벗어나면 normalize)
  2. assess (audit):
     - LLM audit (연속성, 설정 일관성)
     - AI tells 검사 (delve, tapestry 등)
     - 금지어 검사
     - post-write 검증
  3. 점수 계산 (0-100, 통과 임계값: 85)
  4. 미통과 시 reviser가 이슈 리스트 받고 수정
  5. 다시 assess (루프, 기본 1회)
```

### InkOS의 장점 (essai가借鉴할 것)

1. **리뷰-수정 루프** — 리뷰 후 자동으로 이슈 리스트를 만들고, 그 리스트 기반으로 재작성
2. **AI 흔적 검사** — delve, tapestry 등 AI 특유 단어 자동 탐지
3. **연속성 감사** — 이전 챕터와의 설정 충돌 자동 검출
4. **점수 기반 패스/페일** — 객관적 품질 기준 (essai는 피드백만 제공)

### InkOS의 단점 (essai가 유지할 차이점)

1. **강제 파이프라인** — essai는 작가가 단계 선택 (점진적 적용)
2. **점수 = 거절** — essai는 피드백만 제공, 거절 안 함
3. **무거움** — essai는 단순함 유지

---

## Essai 개선 방향

### 현재 essai 리뷰

```
write 1 → 챕터 생성 → memory 생성 → 끝
review 1 → (별도 실행) → 피드백 텍스트만 반환
```

문제: 리뷰와 수정이 분리되어 있어서, 피드백을 보고 수정하려면 수동으로 rewrite해야 함.

### 개선: 리뷰-수정 루프 (선택적)

```
write 1 → 챕터 생성 → memory 생성 → 끝 (기본, 변함 없음)

essai review 1 --fix → 리뷰 + 자동 수정
  1. ChapterReviewer가 피드백 + 이슈 리스트 생성
  2. 이슈 리스트를 instruction으로 변환
  3. ChapterEditor.rewrite(1, instruction) 호출
  4. before/after 저장
  5. 작가가 확인 후 채택/거절

essai review 1 → 피드백만 (기존과 동일, 수정 안 함)
```

### 새로운 검증 기능 (InkOS에서 차용)

**1. AI 흔적 검사 (auto, 별도 API 없음)**

writer의 craft rules에 이미 있지만, 사후 검증도 추가:

```typescript
// packages/core/src/reviewer/ai-tells.ts
const AI_TELLS = [
  "delve", "tapestry", "testament", "intricate", "pivotal",
  "It wasn't X; it was Y", "핵심", "결국",
]

export function detectAITells(content: string): string[] {
  return AI_TELLS.filter(word => content.includes(word))
}
```

이건 LLM 호출 없이 정규식/문자열 검사만으로 됨. write 후 자동 실행.

**2. 연속성 감사 (memory 기반)**

```
memory/001.json에 "도윤은 203호에 산다"라고 되어 있는데
chapters/005.md에서 "도윤이 301호 문을 열었다" → 충돌
```

이건 LLM 호출 1회로 가능. ChapterReviewer에 옵션으로 추가.

**3. 점수 (선택적, 기본 OFF)**

InkOS는 85점 미만이면 거절. essai는 점수를 "참고용"으로만 제공.

```bash
essai review 1 --score   # 점수 포함 (선택적)
essai review 1           # 피드백만 (기본)
```

---

## 구현 태스크

### Task 1: 리뷰-수정 루프 (--fix)

**Files:**
- Modify: `packages/core/src/reviewer/chapter-reviewer.ts`
- Modify: `packages/cli/src/commands/review.ts`

**구현:**
- `review --fix` 플래그 추가
- 리뷰 결과에서 이슈를 추출해서 instruction으로 변환
- ChapterEditor.rewrite() 호출
- 결과를 `chapters/001.md`에 덮어쓰고, 원본은 `chapters/001.bak.md`에 백업

### Task 2: AI 흔적 사후 검사

**Files:**
- Create: `packages/core/src/reviewer/ai-tells.ts`
- Modify: `packages/core/src/writer/chapter-writer.ts` (write 후 자동 실행)

**구현:**
- AI_TELLS 상수 (영어 + 한국어)
- detectAITells(content): string[] 함수
- write 완료 후 자동 실행, 발견 시 경고 출력

### Task 3: 연속성 감사 (옵션)

**Files:**
- Modify: `packages/core/src/reviewer/chapter-reviewer.ts`

**구현:**
- review 시 memory JSON을 같이 주입
- "이전 챕터에서 A라고 했는데 이 챕터에서 B라고 함" 같은 충돌 감지
- `review --audit` 플래그로 활성화

### Task 4: 점수 (선택적)

**Files:**
- Modify: `packages/core/src/reviewer/chapter-reviewer.ts`

**구현:**
- `review --score` 시 0-100 점수 반환
- 기본은 피드백만 (점수 없음)
- 점수는 거들이 아닌 참고용

### Task 5: 웹 UI에 리뷰 흐름 통합

**Files:**
- `packages/web/` (아직 미생성)

**구현:**
- 챕터 상세 페이지에 리뷰 탭
- "AI 리뷰" 버튼 → 피드백 표시
- "자동 수정" 버튼 → --fix 실행, 실시간 스트리밍
- before/after diff 비교

---

## 우선순위

```
1순위: Task 1 (리뷰-수정 루프) — 핵심 가치
2순위: Task 2 (AI 흔적 검사) — 가볍고 효과적
3순위: Task 5 (웹 UI) — 사용성
4순위: Task 3 (연속성 감사) — 고급 기능
5순위: Task 4 (점수) — 선택적
```

## Essai가 유지할 것 (InkOS와의 차이점)

- 리뷰는 강제가 아님 (작가가 선택)
- 점수는 참고용 (거들이 아님)
- 파이프라인은 작가가 조합 (고정 7단계 아님)
- 리뷰-수정 루프도 선택적 (`--fix`를 쓸 때만)
- 단순함 (857 패키지가 아닌 최소 의존성)
