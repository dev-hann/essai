# Essai 설계 문서 (Design Doc)

## 1. 해결하는 문제

AI 글쓰기에서 반복되는 세 가지 문제:

**문제 1: AI가 주도한다**
작가가 설정해도 AI가 자의적으로 캐릭터를 만들고, 감정선을 바꾸고, 새로운 설정을 덧붙인다.

**문제 2: 도구가 작가를 제한한다**
특정 장르, 특정 언어, 특정 모델에 종속된다.

**문제 3: 전체를 한 번에 만들려 한다**
한 번의 실행으로 전체 소설을 생성하려 해서, 중간 수정이 어렵다.

### Essai의 태도
> "AI는 연필이다. 쥐는 건 작가다."

- AI가 설정을 만들지 않는다. 작가가 bible에 정의하고, AI가 그 안에서 글을 쓴다.
- AI가 챕터를 한 번에 쏟아내지 않는다. 1화씩, 작가가 확인하면서 진행한다.
- 도구가 장르/언어/모델을 강제하지 않는다. 전부 작가가 선택한다.

---

## 2. 핵심 개념

### Bible (설정서)
작품의 헌법이다. 캐릭터, 관계, 감정 곡선, 챕터 계획을 작가가 직접 작성한다.
AI는 bible을 읽고 그 안에서만 글을 쓴다. bible에 없는 설정은 만들지 않는다.

```
bible/ 폴더 구조:
├── characters.md      # 캐릭터 (이름, 나이, 성격, 말투, 배경)
├── relationships.md   # 인물 관계
├── emotion.md         # 감정 곡선 (단계별 감정 변화)
├── chapters.md        # 챕터 계획 (각 화의 핵심 장면과 목표)
├── style.md           # 필체/문체 (구어체, 문장 길이, 시점 등)
├── tone.md            # 톤/분위기 (잔잔하게, 유머러스하게 등)
└── constraints.md     # 금지 사항
```

### Chapter (챕터)
1회 분량의 글. bible에 정의된 챕터 계획 + 이전 챕터들의 맥락을 바탕으로 생성.

### Memory (기억)
챕터가 쌓일수록 이전 내용을 전부 AI에게 주면 토큰이 폭발한다.
각 챕터의 핵심 사건, 감정 변화, 설정 변경을 요약해서 저장.
다음 챕터를 쓸 때는 요약본만 주입.

---

## 3. 사용자 경험 (UX)

### 권장 워크플로우

```
1. 프로젝트 생성
   $ essai init my-novel
   → my-novel/ 폴더 생성, essai.json + 빈 bible/ 생성

2. 모델 설정
   $ essai config set -g defaultBaseUrl https://api.z.ai/api/coding/paas/v4
   $ essai config set -g defaultApiKey $GLM_API_KEY
   $ essai config set -g defaultModel glm-5.1
   $ essai config set -g defaultLanguage ko
   → ~/.essai/config.json에 저장, 이후 `essai init` 시 신규 essai.json에 상속

   또는 프로젝트 로컬에서:
   $ essai config set llm.baseUrl https://api.z.ai/api/coding/paas/v4
   $ essai config set llm.apiKey $GLM_API_KEY
   $ essai config set llm.model glm-5.1
   $ essai config set language ko
   → essai.json에 저장

3. Bible 작성 (AI 에이전트 대화형)
   $ essai bible init
   → 템플릿 선택: romance / fantasy / mystery / scifi / blank
   → AI 에이전트가 작가와 대화하면서 bible/ 폴더를 완성 (--agent 플래그)

   $ essai bible init romance --agent
   → 템플릿 복사 후 AI 에이전트 대화형 인터페이스 시작

   대화 예시:
   AI: "이야기의 중심이 되는 캐릭터는 누구인가요?"
   작가: "한국 대학생 남자랑 대만 여자 워홀러"
   AI: "좋아요. 남자 캐릭터의 이름과 나이, 직업을 정해볼까요?"
   작가: "도윤, 25세, 전기공학 4학년"
   AI: "도윤의 성격은 어떤 편인가요?"
   ...

   → AI가 맥락을 이해하고 다음 질문을 동적으로 결정
   → 사용자가 "이 정도면 됐어" 하면 대화 종료
   → 답변이 bible/ 폴더 각 파일에 구조화하여 저장

   이후 추가/수정:
   → $ essai bible add → 대화형으로 설정 추가
   → $ essai bible edit → 에디터에서 직접 수정

4. 1화 작성
   $ essai write 1
   → bible의 1화 계획을 읽고, 챕터 생성
   → 화면에 실시간 스트리밍으로 출력
   → chapters/001.md에 저장

5. 확인 및 수정
   $ essai read 1          → 1화 읽기
   $ essai rewrite 1       → 1화 재생성
   $ essai edit 1          → 에디터에서 수동 수정

6. 다음 화 작성
   $ essai write next      → 다음 화 생성 (이전 챕터 요약 + bible 참조)
   $ essai write 5         → 특정 화 생성

7. 전체 확인
   $ essai status          → 진행 상황, 글자수, 감정 곡선 위치
   $ essai list            → 챕터 목록
   $ essai context 5       → 5화 생성 시 참조할 맥락 미리보기

8. 내보내기
   $ essai export          → 전체를 하나의 파일로
```

---

## 4. 아키텍처

### 멀티 인터페이스

```
                    사용자
                      │
          ┌───────────┼───────────┐
          │           │           │
       CLI           TUI         Web
  (Commander+Ink)  (Ink)     (Next.js)
          │           │           │
          └─────┬─────┴─────┬─────┘
                │           │
          ┌─────▼───────────▼─────┐
          │   @essai/core (순수 TS) │
          │                        │
          │  Bible · Writer · Memory
          │  Editor · Reviewer     │
          │  Config · LLM Provider │
          └────────────────────────┘
```

세 가지 UI가 코어의 같은 함수를 호출. UI에 로직 중복 없음.

### 모듈별 책임

**Bible** (설정 관리)
- bible/ 폴더의 각 Markdown 파일을 읽고 파싱
- 파일별 역할: characters.md, relationships.md, emotion.md, chapters.md, style.md, tone.md, constraints.md
- 챕터 작성 시: 필요한 파일만 조합하여 프롬프트에 주입
- AI 에이전트 대화형 인터페이스: tool_call로 작가와 대화하면서 각 파일을 채움
- 점진적 작성: add 명령으로 특정 파일만 업데이트

**Writer** (챕터 생성)
- Bible(설정) + Memory(이전 챕터 요약)를 조합해서 프롬프트 생성
- 챕터 계획에 없는 설정은 추가하지 않도록 강제
- AI SDK streamText로 스트리밍 응답 → 화면 출력 + 파일 저장 동시 진행
- 추가 지시사항: --instruction "톤을 더 가볍게"
- 언어: config.language를 프롬프트에 주입 (코드에서 언어 결정 안 함)

**Memory** (맥락 유지)
- 챕터 작성 완료 후 자동 요약 생성 (AI SDK generateText 1회)
- 요약: 핵심 사건, 감정 변화, 복선, 확정된 사실, 캐릭터 상태
- 다음 챕터 작성 시 최근 N개 요약만 주입 (토큰 절약)
- 미회수 복선은 전부 추적

**Editor** (수정)
- 챕터 재생성: 기존 챕터를 버리고 새로 씀
- 부분 수정: 특정 문단/장면만 다시 쓰도록 지시
- 격리 구조: 한 챕터 수정이 다른 챕터에 자동 영향을 주지 않음

**Reviewer** (선택적, 기본 OFF)
- 점수가 아닌 피드백 제공
- 검토 기준 커스텀 가능
- 거절하지 않음 — 피드백만 제공

**LLM Provider** (AI SDK 래퍼)
- Vercel AI SDK로 모델 추상화
- OpenAI 호환 API면 모든 모델 지원
- reasoning 켜기/끄기, temperature, maxTokens 전부 config에서

---

## 5. 데이터 흐름

### 1화 작성

```
essai write 1 →

1. Config 로드 (모델, 언어, 글자수)
2. Bible 파싱 → 1화 챕터 계획 + 캐릭터/설정 추출
3. Memory 확인 → 이전 챕터 없음 (1화)
4. 프롬프트 조합:
   system: craft rules + "bible 설정만 따를 것" + "Write in {language}"
   user:   "## 설정\n{bible 요약}\n## 1화 계획\n{챕터 계획}\n## 지시\n약 {chapterWords}자"
5. AI SDK streamText 호출
6. 화면에 실시간 출력 + chapters/001.md에 동시 저장
7. Memory: 1화 요약 자동 생성 → memory/001.json
8. 완료: "1화 완성 (3,021자)"
```

### 5화 작성 (맥락 주입)

```
essai write 5 →

1-2. 동일
3. Memory에서 2~4화 요약 로드 (최근 3개)
4. 프롬프트:
   system: 동일
   user: "## 설정 + ## 이전 이야기(2~4화 요약) + ## 5화 계획"
5-8. 동일
```

### 3화 재생성

```
essai rewrite 3 --instruction "대화를 더 늘려" →

1-3. 동일 (3화 이전 맥락 로드)
4. 프롬프트에 "## 추가 지시: 대화를 더 늘려" 추가
5. chapters/003.md 덮어쓰기
6. Memory: 3화 요약 업데이트
```

---

## 6. 파일 구조

### 모노레포 (프레임워크)

```
essai/
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
├── biome.json                   # 린트/포맷 통일
├── tsconfig.base.json           # 공통 TS 설정 (strict)
├── packages/
│   ├── core/                    # @essai/core
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts         # 공개 API
│   │       ├── config/
│   │       │   └── project-config.ts
│   │       ├── bible/
│   │       │   ├── bible-parser.ts
│   │       │   ├── bible-types.ts
│   │       │   └── bible-writer.ts
│   │       ├── llm/
│   │       │   ├── provider.ts
│   │       │   ├── prompts.ts
│   │       │   └── craft-rules.ts
│   │       ├── writer/
│   │       │   └── chapter-writer.ts
│   │       ├── memory/
│   │       │   ├── memory-store.ts
│   │       │   └── summarizer.ts
│   │       ├── editor/
│   │       │   └── chapter-editor.ts
│   │       └── reviewer/
│   │           └── chapter-reviewer.ts
│   ├── cli/                     # @essai/cli
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts         # 진입점 (essai 명령어)
│   │       ├── commands/
│   │       │   ├── init.ts
│   │       │   ├── config.ts
│   │       │   ├── bible.ts
│   │       │   ├── write.ts
│   │       │   ├── read.ts
│   │       │   ├── rewrite.ts
│   │       │   ├── list.ts
│   │       │   ├── status.ts
│   │       │   └── export.ts
│   │       └── ui/
│   │           └── ink-components.ts
│   ├── tui/                     # @essai/tui (Phase 5)
│   │   └── src/
│   └── web/                     # @essai/web (Phase 5)
│       └── src/
├── templates/
│   ├── romance.md
│   ├── fantasy.md
│   ├── mystery.md
│   ├── scifi.md
│   └── blank.md
├── docs/
│   └── design.md
└── tests/                       # 통합 테스트
```

### 사용자 프로젝트 (작가의 소설)

```
my-novel/
├── essai.json                  # 프로젝트 설정 (모델, 언어, 글자수)
├── bible/                      # 설정서
│   ├── characters.md
│   ├── relationships.md
│   ├── emotion.md
│   ├── chapters.md
│   ├── style.md
│   ├── tone.md
│   └── constraints.md
├── chapters/
│   ├── 001.md
│   ├── 002.md
│   └── ...
├── memory/                     # 자동 생성
│   ├── 001.json
│   └── ...
└── exports/
```

---

## 7. CLI 명령어 전체

> 현재 구현된 명령. 설계 문서와 실제 CLI 동기화용.

### 초기화 & 설정
```
essai init [name]                       프로젝트 생성 (빈 bible/ — `bible init`으로 채움)
essai config set <key> <value>          설정 변경 (-g: 글로벌 default* 키)
essai config get <key>                  설정 확인
essai config show                       전체 essai.json 출력
```

글로벌 키: `defaultBaseUrl`, `defaultApiKey`, `defaultModel`, `defaultLanguage`, `defaultChapterWords`, `defaultTemperature`
프로젝트 키: `llm.baseUrl`, `llm.apiKey`, `llm.model`, `llm.temperature`, `llm.maxTokens`, `llm.thinkingEnabled`, `language`, `chapterWords`

### Bible
```
essai bible init [template] [--agent]   bible/ 스캐폴드 (blank/romance/fantasy/mystery/scifi)
                                        --agent: AI 에이전트 대화형 Bible 생성
essai bible show                        현재 bible/ 파일 목록 (용량 포함)
essai bible edit [file]                 $EDITOR에서 bible/ (또는 특정 파일) 열기
essai bible add <section>               대화형으로 항목 추가 (예: bible add characters)
essai bible validate                    표준 섹션 누락/빈 파일 검사
```

### 챕터 작성
```
essai write <n>                         N화 생성 (파이프라인: write → review → fix → memory)
essai write next                        다음 화 생성
essai write <n> --raw                   파이프라인 건너뛰고 write만
essai write <n> --no-fix                review는 수행하되 자동 수정 생략
essai write <n> -i "..."                추가 지시사항
essai rewrite <n>                       N화 재생성 (자동 .bak 백업, 실패 시 복원)
essai rewrite <n> -i "..."              지시문과 함께 재생성
```

### 챕터 검토/검증
```
essai read <n>                          N화 출력
essai review <n> [-r <rules.md>]        품질 피드백 (커스텀 룰 파일 옵션)
essai validate <n> [--disable <rule>]   정적 일관성 검사 (bible/world.md 기반)
                                        rules: floor-consistency, forbidden-props, visa-duration
```

### 챕터 관리
```
essai list                              챕터 목록 + 글자수
essai status                            진행 상황 (감정 단계, 미회수 복선)
essai context <n>                       N화 생성 시 주입될 맥락 미리보기
essai export [-f md|txt]                전체 내보내기 (txt는 마크다운 strip)
```

### UI
```
essai serve [-p <port>] [--start]       웹 UI (Next.js dev, --start: prod 서버)
essai tui                               터미널 UI (Ink)
```

---

## 8. 설계 원칙

### 8-1. 언어 독립성 (가장 중요)

코드에 어떤 언어도 하드코딩하지 않는다. 프롬프트에서만 처리.

```
essai.json:
  "language": "ko"     →  프롬프트: "Write all prose in Korean."
  "language": "en"     →  프롬프트: "Write all prose in English."
  "language": "zh"     →  프롬프트: "Write all prose in Chinese."
  "language": "ja"     →  프롬프트: "Write all prose in Japanese."
```

- 언어 목록을 코드에 정의하지 않음. config.language는 그냥 문자열.
- "ko", "en", "zh" 분기(if/else)가 코드 어디에도 없어야 함.
- 새 언어 추가 = config 하나만 바꾸면 끝.
- CLI 출력은 영어로 고정.

### 8-2. 파일이 곧 데이터
데이터베이스 없음. Markdown과 JSON만. git 친화적.

### 8-3. 점진적 적용
```
Level 0: Bible만 쓴다 → 직접 글을 쓴다
Level 1: Bible + Writer → 챕터를 AI가 쓴다
Level 2: Bible + Writer + Memory → 긴 연재도 맥락 유지
Level 3: + Reviewer → 품질 검토
```

### 8-4. 프롬프트 분리
프롬프트는 core/llm/에서 관리. 사용자가 수정 가능.

### 8-5. 모델 독립
OpenAI 호환 API면 모든 모델이 동일하게 작동. AI SDK가 추상화.

---

## 9. Craft Rules (작법 규칙)

Writer가 챕터를 생성할 때 system prompt에 포함되는 글쓰기 규칙.
언어 독립적 — 모든 규칙은 영어로 작성, 출력 언어는 config.language에서 주입.

### 공통 규칙

```
- Show, don't tell
- Simile restraint: at most one per scene
- Anti-AI wording: avoid delve, tapestry, testament, intricate, pivotal
- No padding: every scene must advance something
- Climax is a scene, not a recap
- Payoffs need setup
- Side characters need motives
- Mobile-first pacing
- Bible compliance: only use settings defined in the Bible
```

### 언어 지시문 (실행 시점 조합)

```
Write all prose, dialogue, and narration in {config.language}.
```

### 사용자 커스텀 (bible/에서 주입)

- style.md → Writing Style
- tone.md → Tone & Mood
- constraints.md → Constraints

우선순위: 공통 < 커스텀 (bible이 이김)

---

## 10. Memory (맥락 유지)

### 요약 JSON 스키마

```typescript
interface ChapterMemory {
  chapter: number
  title: string
  wordCount: number
  events: string[]                          // 핵심 사건 3~8개
  emotions: Array<{
    character: string
    emotion: string                         // "경계 → 안도"
    intensity: "low" | "medium" | "high"
    note?: string
  }>
  foreshadowing: Array<{
    item: string
    status: "unresolved" | "active" | "resolved"
    chapterIntroduced: number
  }>
  facts: string[]                           // 확정된 객관적 사실
  characterState: Record<string, {
    location: string
    mood: string
    knows: string[]
  }>
}
```

### 주입 방식

```
5화 작성 시:
- 최근 3개 요약 (2, 3, 4화) 주입
- 미회수 복선 전부 추적
- characterState 최신 상태만
- 토큰 약 87% 절약
```

---

## 11. Bible 파싱 규칙

### 관대한 파서

1. 형식이 조금 틀려도 에러 안 남
2. 키 제한 없음 (characters.md에 정해진 필드 강제 안 함)
3. 빈 파일 허용 (경고만 하고 진행)
4. 확장 가능 (bible/에 새 .md 파일 추가하면 자동 인식)
5. YAML frontmatter 지원 (선택적)

### 커스텀 파일 자동 인식

bible/에 임의의 .md 파일 추가 시 → Writer 프롬프트에 "Additional Context"로 자동 포함.

---

## 12. 기술 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| 언어 | TypeScript (strict) | 타입 안전, 개발자 전문 분야 |
| AI | Vercel AI SDK | 모델 추상화, 스트리밍, tool_call 내장 |
| CLI | Commander.js | 가볍고 검증됨 |
| TUI | Ink | React for terminal, 컴포넌트 재사용 |
| Web | Next.js | 같은 React 생태계 |
| 모노레포 | pnpm workspaces + Turborepo | 패키지 관리 + 빌드 캐싱 |
| 린트/포맷 | Biome | 빠르고 통일된 린트 |
| 타입 체크 | tsc --strict | 컴파일 타임 타입 안전 |
| 스키마 | Zod | 런타임 검증 (tool parameter, config) |
| 테스트 | Vitest | 빠르고 ESM 네이티브 |

---

## 13. 품질 관리

### TypeScript Strict 모드

```jsonc
// tsconfig.base.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": false,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}
```

### Biome (린트 + 포맷)

```jsonc
// biome.json
{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": { "noUnusedVariables": "error" },
      "suspicious": { "noExplicitAny": "error" },
      "style": { "useImportType": "error" }
    }
  }
}
```

### CI 게이트

```bash
# pre-commit / CI에서 전부 통과해야 함
pnpm typecheck     # tsc --noEmit
pnpm lint          # biome check
pnpm test          # vitest run
```

---

## 14. 개발 로드맵

### Phase 1: MVP (핵심 — 글을 쓸 수 있는 상태)

목표: bible을 넣고 1화를 쓸 수 있다.

| 단계 | 작업 | 테스트 |
|------|------|--------|
| 1.1 | 모노레포 세팅 (pnpm, turbo, biome, tsconfig) | `pnpm install && pnpm build` 통과 |
| 1.2 | Config: essai.json 읽기/쓰기 (Zod 스키마) | 잘못된 config → 에러, 정상 config → 로드 |
| 1.3 | LLM Provider: AI SDK 래퍼 (모델 생성) | 모킹으로 streamText 호출 검증 |
| 1.4 | Craft Rules: 프롬프트 조합 (공통 규칙 + 언어 + 커스텀) | 스냅샷: 프롬프트 문자열 검증 |
| 1.5 | Bible Parser: characters.md, chapters.md 파싱 | 파싱 결과 → 구조화 데이터 검증 |
| 1.6 | Bible Parser 나머지: relationships, emotion, style, tone, constraints | 각 파일별 파싱 테스트 |
| 1.7 | Writer: 챕터 생성 (bible + 프롬프트 → streamText → 저장) | 모킹 LLM으로 챕터 생성 검증 |
| 1.8 | CLI: init, config, write, read, list | 통합 테스트 |
| 1.9 | 실제 GLM API로 1화 생성 검증 | 수동 E2E |

### Phase 2: Memory (연재 가능)

목표: 14화까지 맥락 유지하며 연재.

| 단계 | 작업 | 테스트 |
|------|------|--------|
| 2.1 | Memory 스키마 (Zod) + JSON 저장/로드 | 빈 파일/잘못된 JSON 처리 |
| 2.2 | Summarizer: 챕터 텍스트 → 요약 JSON (generateText) | 모킹으로 요약 생성 검증 |
| 2.3 | Memory 주입: 최근 N개 요약 + 미회수 복선 | 5개 챕터 후 토큰 수 검증 |
| 2.4 | CLI: write next, context, status | 통합 테스트 |

### Phase 3: Editor (수정)

목표: 마음에 안 드는 화를 다시 쓸 수 있다.

| 단계 | 작업 | 테스트 |
|------|------|--------|
| 3.1 | 챕터 재생성 (--rewrite) | 기존 내용 교체 검증 |
| 3.2 | 추가 지시사항 (--instruction) | instruction이 프롬프트에 들어가는지 |
| 3.3 | CLI: rewrite, edit, export | 통합 테스트 |

### Phase 4: Bible Agent + Polish

목표: 대화형 Bible 생성, 템플릿, 검토.

| 단계 | 작업 | 테스트 |
|------|------|--------|
| 4.1 | Bible 템플릿 (romance, fantasy, mystery, scifi, blank) | 템플릿 로드 검증 |
| 4.2 | Bible Agent: AI SDK tool_call로 대화형 생성 | tool 호출 → 파일 저장 검증 |
| 4.3 | Reviewer: 피드백 생성 (선택적) | 모킹으로 피드백 검증 |
| 4.4 | CLI: bible init, bible add, review, bible validate | 통합 테스트 |

### Phase 5: TUI + Web UI

목표: 터미널이 아닌 UI에서 작업.

| 단계 | 작업 |
|------|------|
| 5.1 | Ink TUI: 챕터 목록, bible 뷰어, 채팅형 write |
| 5.2 | Next.js Web: 에디터, 챕터 관리, 실시간 스트리밍 |
