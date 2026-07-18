# Essai 설계 문서 (Design Doc)

## 1. Essai가 해결하는 문제

AI 글쓰기에서 반복되는 세 가지 문제:

**문제 1: AI가 주도한다**
작가가 설정해도 AI가 자의적으로 캐릭터를 만들고, 감정선을 바꾸고, 새로운 설정을 덧붙인다.

**문제 2: 도구가 작가를 제한한다**
특정 장르, 특정 언어, 특정 모델에 종속된다.

**문제 3: 전체를 한 번에 만들려 한다**
한 번의 실행으로 전체 소설을 생성하려 해서, 중간 수정이 어렵다.

### Essai의 태도
> "AI는 연필이다. 쥐는 건 작가다."

- AI가 설정을 만들지 않는다. 작가가 bible.md에 정의하고, AI가 그 안에서 글을 쓴다.
- AI가 챕터를 한 번에 쏟아내지 않는다. 1화씩, 작가가 확인하면서 진행한다.
- 도구가 장르/언어/모델을 강제하지 않는다. 전부 작가가 선택한다.

---

## 2. 핵심 개념

### Bible (설정서)
작품의 헌법이다. 캐릭터, 세계관, 감정 곡선, 챕터 계획을 작가가 직접 Markdown으로 작성한다.
AI는 bible을 읽고 그 안에서만 글을 쓴다. bible에 없는 설정은 만들지 않는다.

```
bible/ 폴더 구조:
├── characters.md      # 캐릭터 (이름, 나이, 성격, 말투, 배경)
├── relationships.md   # 인물 관계
├── emotion.md         # 감정 곡선 (단계별 감정 변화)
├── chapters.md        # 챕터 계획 (각 화의 핵심 장면과 목표)
├── style.md           # 필체/문체 (구어체, 문장 길이, 시점 등)
├── tone.md            # 톤/분위기 (잔잔하게, 유머러스하게 등)
└── constraints.md     # 금지 사항 ("이 설정 추가하지 마", "이 톤은 유지해")
```

### Chapter (챕터)
1회 분량의 글이다. bible에 정의된 챕터 계획 + 이전 챕터들의 맥락을 바탕으로 생성된다.
각 챕터는 독립적인 파일이며, 언제든 재생성/수정할 수 있다.

### Memory (기억)
챕터가 쌓일수록 이전 내용을 전부 AI에게 주면 토큰이 폭발한다.
그래서 각 챕터의 핵심 사건, 감정 변화, 설정 변경을 요약해서 저장한다.
다음 챕터를 쓸 때는 요약본만 주입한다.

---

## 3. 사용자 경험 (UX)

### 권장 워크플로우

```
1. 프로젝트 생성
   $ essai init my-novel
   → my-novel/ 폴더 생성, essai.json + 빈 bible.md 생성

2. 모델 설정
   $ essai config set base-url https://api.z.ai/api/coding/paas/v4
   $ essai config set api-key $GLM_API_KEY
   $ essai config set model glm-5.1
   $ essai config set language ko
   → essai.json에 저장

3. Bible 작성 (AI 에이전트 대화형)
   $ essai bible init
   → 템플릿 선택: romance / fantasy / mystery / scifi / blank
   → AI 에이전트가 작가와 대화하면서 bible.md를 완성

   대화 예시:
   AI: "이야기의 중심이 되는 캐릭터는 누구인가요?"
   작가: "한국 대학생 남자랑 대만 여자 워홀러"
   AI: "좋아요. 남자 캐릭터의 이름과 나이, 직업을 정해볼까요?"
   작가: "도윤, 25세, 전기공학 4학년"
   AI: "도윤의 성격은 어떤 편인가요? 예를 들어 과묵한지, 말이 많은지,"
        "감정을 직접 표현하는지 숨는지..."
   작가: "과묵한데 은근히 챙기는 타입"
   AI: "그러면 여주도 정해볼까요? 이름과 배경을 알려주세요"
   작가: "위팅, 23세, 대만에서 워홀로 한국 옴"
   AI: "도윤과 위팅이 처음 만나는 상황은 어떤가요? 작가님이 원하시는"
        "첫 만남 시나리오가 있나요?"
   ...

   → AI가 맥락을 이해하고 다음 질문을 결정
   → 사용자가 "이 정도면 됐어" 하면 대화 종료
   → 답변이 bible.md에 자동 구조화하여 저장

   이후 추가/수정:
   → $ essai bible add → "추가하고 싶은 게 뭐예요?" 대화 시작
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

8. 내보내기
   $ essai export          → 전체를 하나의 파일로
```

### 핵심 UX 원칙
1. **1화씩 진행** — 한 번에 전체를 생성하지 않음. 확인하고 넘어감
2. **언제든 되돌리기** — 챕터 재생성, 수정, 삭제가 자유로움
3. **투명성** — AI가 무슨 맥락을 참조했는지 확인 가능 ($ essai context 5)
4. **점진적** — Bible만 쓰고 직접 써도 됨. Writer 안 써도 됨. Reviewer 안 써도 됨

---

## 4. 아키텍처

### 모듈 구조

```
                    ┌─────────┐
                    │   CLI   │  사용자 인터페이스
                    └────┬────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
     ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
     │  Bible  │   │  Writer │   │  Memory │
     │ (설정)  │   │ (생성)  │   │ (맥락)  │
     └────┬────┘   └────┬────┘ └────┬────┘
          │              │           │
          └──────────────┼───────────┘
                         │
                   ┌─────▼─────┐
                   │    LLM    │  모델 독립적 API 클라이언트
                   │ Provider  │
                   └───────────┘
```

### 모듈별 책임

**Bible** (설정 관리)
- bible/ 폴더의 각 Markdown 파일을 읽고 파싱
- 파일별 역할: characters.md, relationships.md, emotion.md, chapters.md, style.md, tone.md, constraints.md
- 챕터 작성 시: characters + relationships + 해당 화 chapters + style + tone + constraints를 조합하여 프롬프트에 주입
- AI 에이전트 대화형 인터페이스: 작가와 대화하면서 각 파일을 개별적으로 채움
  - AI가 답변을 분석해 다음 질문을 동적으로 생성
  - 템플릿별 대화 가이드라인(어떤 순서로 뭘 물어볼지)은 가지되, 고정 순차가 아님
  - 사용자가 "이 정도면 됐어" 하면 대화 종료
- 추출된 정보를 각 파일에 구조화하여 자동 저장
- 점진적 작성: add 명령으로 특정 파일만 업데이트
  - add character → characters.md에 추가
  - add chapter 3 → chapters.md에 3화 계획 추가
  - add relationship → relationships.md에 추가

**Writer** (챕터 생성)
- Bible(설정) + Memory(이전 챕터 요약)를 조합해서 프롬프트 생성
- 챕터 계획에 없는 설정은 추가하지 않도록 강제 ("bible에 없으면 쓰지 마")
- LLM Provider에 요청, 스트리밍 응답을 화면에 실시간 출력
- 응답 완료되면 chapters/NNN.md에 저장
- craft rules (Show don't tell, AI 흔적 제거 등)를 프롬프트에 포함
- 추가 지시사항 지원: --instruction "톤을 더 가볍게"
- 언어: config.language를 프롬프트에 주입 (코드에서 언어 결정 안 함)

**Memory** (맥락 유지)
- 챕터 작성 완료 후 자동 요약 생성 (LLM 호출 1회)
- 요약 내용: 핵심 사건, 감정 변화, 새로 등장한 정보, 미회수 복선
- 다음 챕터 작성 시 최근 N개 요약 + 현재 감정 단계만 주입
- 토큰 예산 관리: 전체 챕터 텍스트가 아닌 요약본만 주입해서 토큰 절약
- $ essai context <n> 으로 "N화 생성 시 어떤 맥락이 들어가는지" 미리보기 가능

**Editor** (수정)
- 챕터 재생성: 기존 챕터를 버리고 새로 씀 (이전 맥락은 유지)
- 부분 수정: 특정 문단/장면만 다시 쓰도록 지시 (--section "옥상 씬")
- 추가 지시: 기존 내용을 유지하면서 방향 수정 (--instruction "대화를 더 늘려")
- 격리 구조: 한 챕터 수정이 다른 챕터에 자동 영향을 주지 않음
  단, Memory 요약은 업데이트됨 → 이후 챕터에 반영

**Reviewer** (선택적, 기본 OFF)
- 작가가 켤 수 있는 품질 피드백 기능
- 점수가 아닌 피드백 제공 ("5장에서 감정 전환이 급함", "3장 대사가 자연스러움")
- 검토 기준 커스텀 가능 (--rules ./my-rules.md)
- 거절하지 않음 — 피드백만 주고, 수정 여부는 작가가 결정

**LLM Provider**
- OpenAI 호환 API (/v1/chat/completions)
- 스트리밍 지원
- reasoning 켜기/끄기 (GLM-5.x, o1 등)
- 모델 종속적이지 않음 — 어떤 모델이든 동일 인터페이스

### 데이터 흐름 (1화 작성 예시)

```
작가: $ essai write 1

1. Config 로드 (모델, 언어, 글자수)
2. Bible에서 1화 챕터 계획 + 캐릭터/설정 추출
3. Memory 확인 → 이전 챕터 없음 (1화)
4. 프롬프트 조합:
   system: "한국어 소설 작가. bible 설정만 따를 것. + craft rules"
   user:   "## 설정\n{bible 요약}\n## 1화 계획\n{챕터 계획}\n## 지시\n한국어로 약 3000자"
5. LLM Provider → API 스트리밍 호출 (thinking 비활성화)
6. 화면에 실시간 출력 + chapters/001.md에 동시 저장
7. Memory: 1화 요약 자동 생성 → memory/001.json
8. 완료: "1화 완성 (3,021자)"
```

### 데이터 흐름 (5화 작성 예시)

```
작가: $ essai write 5

1. Config 로드
2. Bible에서 5화 챕터 계획 추출
3. Memory에서 1~4화 요약 로드
   → 토큰 예산에 맞게 최근 3개(2~4화) 요약만 선택
4. 프롬프트 조합:
   system: "한국어 소설 작가. bible 설정만 따를 것. + craft rules"
   user:   "## 설정\n{bible 캐릭터/관계 요약}\n## 이전 이야기\n{2~4화 요약}\n## 5화 계획\n{챕터 계획}\n## 지시\n한국어로 약 3000자"
5. LLM 호출 → chapters/005.md 저장
6. Memory: 5화 요약 생성
7. 완료: "5화 완성 (2,876자) — 감정 단계: 의존"
```

### 데이터 흐름 (3화 재생성 예시)

```
작가: $ essai rewrite 3 --instruction "대화를 더 늘려"

1. Config 로드
2. Bible에서 3화 챕터 계획 추출
3. Memory에서 1~2화 요약 로드 (3화 이전 맥락)
4. 기존 3화 내용을 reference로 로드 (있으면)
5. 프롬프트 조합:
   system: 동일
   user:   "## 설정 + ## 이전 이야기 + ## 3화 계획 + ## 기존 초과(있으면) + ## 추가 지시: 대화를 더 늘려"
6. LLM 호출 → chapters/003.md 덮어쓰기
7. Memory: 3화 요약 업데이트
8. 완료: "3화 재생성 완료 (3,412자)"
```

---

## 5. 프로젝트 파일 구조

### 프레임워크 (essai 자체)

```
essai/
├── README.md
├── LICENSE
├── pyproject.toml
├── essai/
│   ├── __init__.py
│   ├── cli.py                 # CLI 진입점 (typer)
│   ├── config.py              # 설정 관리 (essai.json)
│   ├── bible.py               # Bible 파싱/관리
│   ├── bible_agent.py         # 대화형 Bible 생성 AI 에이전트
│   ├── writer.py              # 챕터 생성
│   ├── memory.py              # 맥락/요약 관리
│   ├── editor.py              # 챕터 수정/재생성
│   ├── reviewer.py            # 품질 검토 (선택적, 기본 OFF)
│   └── llm/
│       ├── __init__.py
│       ├── provider.py        # OpenAI 호환 API 클라이언트
│       └── prompts.py         # 프롬프트 빌더 + craft rules
├── templates/                  # Bible 템플릿 (대화 가이드라인 포함)
│   ├── romance.md
│   ├── fantasy.md
│   ├── mystery.md
│   ├── scifi.md
│   └── blank.md
└── tests/
```

### 사용자 프로젝트 (작가의 소설)

```
my-novel/
├── essai.json                  # 프로젝트 설정 (모델, 언어, 글자수)
├── bible/                      # 설정서 (AI 에이전트 대화로 생성, 수동 수정 가능)
│   ├── characters.md           # 캐릭터
│   ├── relationships.md        # 인물 관계
│   ├── emotion.md              # 감정 곡선
│   ├── chapters.md             # 챕터 계획
│   ├── style.md                # 필체/문체
│   ├── tone.md                 # 톤/분위기
│   └── constraints.md          # 금지 사항
├── chapters/
│   ├── 001.md                  # 1화
│   ├── 002.md                  # 2화
│   └── ...
├── memory/                     # 자동 생성 (건드릴 필요 없음)
│   ├── 001.json                # 1화 요약 (사건, 감정, 복선)
│   ├── 002.json                # 2화 요약
│   └── ...
└── exports/                    # 내보낸 파일
    └── full.md
```

### 템플릿 구조

템플릿은 두 가지 역할을 합니다: bible.md의 빈 양식 + 대화형 에이전트의 가이드라인.

```yaml
# templates/romance.md

---
# 대화형 에이전트 가이드라인
agent:
  sections:        # 이 순서대로 질문을 시작하되, 사용자 답변에 따라 유연하게
    - characters   # "중심 캐릭터는?"
    - relationships # "둘의 관계는?"
    - conflict      # "핵심 갈등은?"
    - emotion       # "감정이 어떻게 변하나요?"
    - chapters      # "각 화에서 일어나는 일은?"
    - tone          # "분위기나 톤이 있나요?"
    - rules         # "피하고 싶은 것 있나요?"
  min_questions: 5  # 최소 5개 섹션은 다룰 것
---

# Bible

## 캐릭터
(작가가 대화로 채움)

## 인물 관계

## 감정 곡선

## 챕터 계획

## 톤/분위기

## 금지 사항
```

에이전트는 이 가이드라인을 읽고, 각 섹션에 대해 자연스러운 대화로 정보를 추출합니다.
고정된 질문이 아니라, 이전 답변을 반영해서 다음 질문을 동적으로 생성합니다.

---

## 6. CLI 명령어 전체

### 초기화 & 설정
```
essai init [name]                    프로젝트 생성
essai config set <key> <value>       설정 변경
essai config get <key>               설정 확인
essai config show                    전체 설정 출력
```

### Bible
```
essai bible init [--template romance]  대화형으로 Bible 생성
essai bible show                       현재 설정 출력 (트리 구조)
essai bible edit                       에디터에서 bible.md 열기
essai bible add character              대화형으로 캐릭터 추가
essai bible add chapter <n>            N화 챕터 계획 추가
essai bible add relationship           인물 관계 추가
essai bible validate                   설정 누락/충돌 검사
```

### 챕터 작성
```
essai write <n>                      N화 생성
essai write next                     다음 화 생성
essai write <n> --rewrite            N화 재생성 (기존 것 교체)
essai write <n> --instruction "..."  추가 지시사항 (예: "톤을 더 가볍게")
```

### 챕터 관리
```
essai read <n>                       N화 읽기
essai edit <n>                       에디터에서 N화 열기
essai list                           챕터 목록 + 글자수
essai status                         진행 상황 (감정 곡선 위치 포함)
essai context <n>                    N화 생성 시 참조할 맥락 미리보기
```

### 검토 (선택적)
```
essai review <n>                     N화 품질 피드백
essai review <n> --rules <file>      커스텀 기준으로 검토
```

### 내보내기
```
essai export [--format md|txt]       전체 내보내기
essai export <n> [--format md|txt]   특정 화만 내보내기
```

---

## 7. 설계 원칙

### 7-1. 언어 독립성 (가장 중요)

코드에 어떤 언어도 하드코딩하지 않는다. 프롬프트에서만 처리한다.

```
essai.json:
  "language": "ko"     →  프롬프트: "Write all prose in Korean."
  "language": "en"     →  프롬프트: "Write all prose in English."
  "language": "zh"     →  프롬프트: "Write all prose in Chinese."
  "language": "ja"     →  프롬프트: "Write all prose in Japanese."
```

- 언어 목록을 코드에 정의하지 않음. config.language는 그냥 문자열.
- craft rules, system prompt, bible agent 대화 — 전부 config.language 값을 프롬프트에 주입만 함.
- "ko", "en", "zh" 분기(if/elif)가 코드 어디에도 없어야 함.
- 새 언어 추가 = 코드 변경 없이 config 하나만 바꾸면 끝.
- CLI 출력(진행 메시지, 에러 등)은 영어로 고정. 본문 언어와 무관.

### 7-2. 파일이 곧 데이터
데이터베이스 없음. 전부 Markdown과 JSON. git으로 버전 관리 가능.
작가가 파일을 직접 열어보고 수정할 수 있음.

### 7-3. 점진적 적용
```
Level 0: Bible만 쓴다 → 직접 글을 쓴다 (AI 안 씀)
Level 1: Bible + Writer → 챕터를 AI가 쓴다
Level 2: Bible + Writer + Memory → 긴 연재도 맥락 유지
Level 3: Bible + Writer + Memory + Reviewer → 품질 검토까지
```
모든 단계가 선택적이다.

### 7-4. 프롬프트 분리
프롬프트는 llm/prompts.py에서 관리. 사용자가 수정 가능.
craft rules (Show don't tell, AI 흔적 제거 등)도 파일로 분리.
언어 지시문도 별도 함수에서 조합 (하드코딩 아님).

### 7-5. 모델 독립
OpenAI 호환 API면 모든 모델이 동일하게 작동.
reasoning 모델(GLM-5.x, o1)과 비-reasoning 모델(GLM-5.1, GPT-4o) 모두 지원.

---

## 8. Craft Rules (작법 규칙)

Writer가 챕터를 생성할 때 system prompt에 포함되는 글쓰기 규칙.
언어 독립적 — 모든 규칙은 영어로 작성, 출력 언어는 config.language에서 주입.

### 공통 규칙 (모든 장르, 모든 언어)

```
## Craft Rules

- Show, don't tell: behavior, evidence, concrete detail, and staging —
  never label emotions directly.
- Simile restraint: at most one simile/metaphor per scene. Prefer precise
  verbs and concrete actions over figures of speech.
- Anti-AI wording: avoid "delve", "tapestry", "testament", "intricate",
  "pivotal". Do not use "It wasn't X; it was Y" as a crutch.
- No padding: every scene must advance conflict, causality, emotion,
  evidence, pressure, payoff, or a relationship.
- Climax is a scene, not a recap: key beats must play out on the page
  (action, dialogue, senses). Never compress into one line.
- Payoffs need setup: every reversal, reconciliation, or reveal must ride
  a chain of evidence established in earlier chapters.
- Side characters need motives: even minor characters act from interest,
  misjudgment, or fear — never plot devices.
- Mobile-first pacing: short paragraphs, dense information, no decorative
  filler.
- Bible compliance: only use settings, characters, and plot points defined
  in the Bible. Do not invent new characters, settings, or backstory.
```

### 언어 지시문 (실행 시점 조합)

craft rules 다음에 언어 지시문이 자동으로 붙음:

```
Write all prose, dialogue, and narration in {config.language}.
Internal monologue must also be in {config.language}.
```

### 사용자 커스텀 규칙

bible.md에서 세 가지 섹션이 craft rules에 추가로 주입됨:

**필체/문체** (문장 스타일)
```
bible.md:
  ## 필체/문체
  - 구어체, ㅋㅋ 살리기
  - 짧은 문장 위주
  - 1인칭 남성 화자

→ 프롬프트 주입:
  ## Writing Style
  - 구어체, ㅋㅋ 살리기
  - 짧은 문장 위주
  - 1인칭 남성 화자
```

**톤/분위기** (이야기의 느낌)
```
bible.md:
  ## 톤/분위기
  - 잔잔하고 애틋하게
  - 유머는 자연스럽게

→ 프롬프트 주입:
  ## Tone & Mood
  - 잔잔하고 애틋하게
  - 유머는 자연스럽게
```

**금지 사항** (내용 제한)
```
bible.md:
  ## 금지 사항
  - bible에 없는 설정 추가 금지
  - 과도한 멜로드라마 금지

→ 프롬프트 주입:
  ## Constraints
  - bible에 없는 설정 추가 금지
  - 과도한 멜로드라마 금지
```

규칙 우선순위: 공통 규칙 < 사용자 커스텀 (bible.md). 충돌 시 bible.md가 이김.

---

## 9. Memory (맥락 유지)

### 왜 필요한가

5화를 쓸 때 AI는 1~4화를 알아야 한다. 하지만 전체 텍스트를 주면 토큰이 폭발한다.
그래서 각 화의 핵심만 요약해서 저장하고, 다음 화 작성 시 요약본만 주입한다.

### 요약 JSON 스키마

```json
{
  "chapter": 1,
  "title": "계약 통역",
  "word_count": 3021,
  "events": [
    "아줌마가 도윤에게 중국어 통역 요청",
    "건물 앞에서 위팅과 첫 만남 — 캐리어 끌고 폰 만지는 모습",
    "도윤이 영업마인드로 방 설명하다가 위팅이 경계",
    "도윤이 자기 계약서를 보여주며 옆방 세입자임을 증명",
    "위팅이 안심하고 계약. 세 명 동시에 웃음",
    "아줌마가 '301호 학생'으로 부르다 못 알아듣고, 도윤이 '산링' 제안"
  ],
  "emotions": [
    {
      "character": "도윤",
      "emotion": "호기심",
      "intensity": "낮음",
      "note": "첫인상 귀엽다고 느낌, 그 이상은 아님"
    },
    {
      "character": "위팅",
      "emotion": "경계 → 안도",
      "intensity": "중간",
      "note": "방 팔아먹는 넘인 줄 알다가 계약서 보고 안심"
    }
  ],
  "foreshadowing": [
    {
      "item": "관리비 면제 약속",
      "status": "미회수",
      "chapter_introduced": 1
    },
    {
      "item": "산링 별명 정착",
      "status": "활성",
      "chapter_introduced": 1
    }
  ],
  "facts": [
    "위팅은 301호에 살게 됨",
    "도윤은 203호에 살고 있음 (한 달째)",
    "아줌마는 경상도 사투리를 씀",
    "위팅은 한국어를 거의 못 함"
  ],
  "character_state": {
    "도윤": { "location": "원룸", "mood": "호기심", "knows": ["위팅 존재", "옆방 이웃"] },
    "위팅": { "location": "301호", "mood": "안도", "knows": ["도윤은 옆방 학생"] }
  }
}
```

### 필드 설명

| 필드 | 설명 | 왜 필요한가 |
|------|------|-------------|
| events | 이 챕터에서 일어난 핵심 사건 (3~8개) | 다음 화에서 참조할 줄거리 |
| emotions | 등장인물별 감정 상태 변화 | 감정선 연속성 유지 |
| foreshadowing | 복선 목록 + 회수 여부 | 안 회수한 복선 추적 |
| facts | 이 챕터에서 확정된 사실 | 설정 충돌 방지 (위팅 나이, 방 호수 등) |
| character_state | 각 캐릭터의 현재 위치/기분/알고 있는 정보 | 다음 화 행동의 출발점 |

### 요약 생성 방식

챕터 작성 완료 직후 자동으로 LLM을 한 번 더 호출하여 요약 생성.
프롬프트:
```
다음 챕터를 읽고 JSON 형식으로 요약하라.
events: 핵심 사건 3~8개
emotions: 각 캐릭터의 감정 변화
foreshadowing: 새로운 복선이나 회수된 복선
facts: 이 챕터에서 확정된 객관적 사실
character_state: 각 캐릭터의 현재 상태
```

### 주입 방식 (다음 화 작성 시)

```
5화를 쓸 때:

1. 최근 3개 요약 (2, 3, 4화) 로드
   → 1화는 오래됐지만 facts는 별도로 보존
2. foreshadowing에서 미회수 복선 전부 로드
3. character_state에서 최신 상태만 로드 (4화 기준)
4. events + emotions는 요약본만 주입
```

토큰 예산 예시:
```
1화 전체 텍스트:     ~3000자 → 약 2000 토큰
1화 요약:            ~400자 → 약 250 토큰 (87% 절약)

4개 분량 주입 시:
  전체 텍스트: 8000 토큰
  요약본:      1000 토큰
```

### Memory 미리보기

```bash
$ essai context 5

Chapter 5 will reference:
  Recent: chapters 2, 3, 4
  Foreshadowing (unresolved):
    - 관리비 면제 약속 (introduced: ch.1)
    - 산링 별명 정착 (introduced: ch.1, active)
    - 도윤의 중국어 실력 한계 (introduced: ch.2)
  Character state:
    도윤: 원룸, 호기심 → 호감
    위팅: 301호, 경계 → 안도 → 호기심
  Facts: 7개
  Estimated tokens: ~1,200
```

작가가 미리 "이번 화에 어떤 맥락이 들어가는지" 확인할 수 있다.

### Memory 파일 위치

```
memory/
├── 001.json    # 1화 요약
├── 002.json    # 2화 요약
├── 003.json    # 3화 요약
└── ...
```

각 파일은 독립적. 삭제해도 다른 챕터에 영향 없음 (해당 화의 맥락만 사라짐).

---

---

## 10. Bible 파싱 규칙

### 파일 구조와 파싱

bible/ 폴더의 각 Markdown 파일을 읽어서 Writer 프롬프트에 주입한다.

### 파일별 파싱 방식

**characters.md** — 느슨한 구조, 섹션 헤더로 캐릭터 구분

```markdown
## 도윤
- 나이: 25세, 군필 복학 4학년
- 전공: 전기공학
- 성격: 과묵하지만 챙기는 타입
- 말투: 차분함, 가끔 위트
- 배경: 3학년 때 베이징 교환학생 1년

## 위팅 (雨婷, Yǔtíng)
- 나이: 23~24세
- 비자: H-1 워킹홀리데이 (1년)
- 성격: 엉뚱하고 즉흥적
- 한국어: "나는 ○○ 임니다" 수준
```

파싱 결과:
```json
{
  "도윤": { "age": "25세", "major": "전기공학", "personality": "과묵하지만 챙기는 타입", ... },
  "위팅": { "age": "23~24세", "visa": "H-1", "personality": "엉뚱하고 즉흥적", ... }
}
```

규칙:
- `##` 헤더 = 캐릭터 이름
- `- key: value` 형태의 리스트 = 속성
- 정해진 key 목록 없음. 작가가 자유롭게 작성
- 파서는 key-value를 그대로 보존. 모르는 key가 나와도 에러 안 남

**relationships.md** — 자유 텍스트, 줄 단위 파싱

```markdown
도윤 → 위팅: 옆방 이웃, 통역 담당
위팅 → 도윤: 의존, 말이 통하는 유일한 사람
아줌마 → 도윤: 아들처럼 생각함, 등 떠밈
아줌마 → 위팅: 딸처럼 생각함, 챙김
도윤 → 아줌마: 세입자, 경상도 사투리 통역 역할
```

파싱 결과:
```json
[
  { "from": "도윤", "to": "위팅", "desc": "옆방 이웃, 통역 담당" },
  { "from": "위팅", "to": "도윤", "desc": "의존, 말이 통하는 유일한 사람" },
  ...
]
```

규칙:
- `A → B: 설명` 형태
- 화살표 방향이 의미 있음 (A가 B에게 어떤 존재인지)
- 비대칭 관계 표현 가능 (도윤은 호감, 위팅은 경계 등)

**emotion.md** — 단계별 표 또는 리스트

```markdown
## 감정 곡선

1단계 — 만남 (1~2화)
도윤: 호기심 (낮음)
위팅: 경계 → 안도

2단계 — 호기심 (3~4화)
도윤: 호기심 → 호감
위팅: 안도 → 호기심

3단계 — 가까워짐 (5~6화)
도윤: 호감 → 의존
위팅: 호기심 → 의존
```

파싱 결과:
```json
{
  "stages": [
    { "stage": 1, "name": "만남", "chapters": "1~2", "emotions": { "도윤": "호기심 (낮음)", "위팅": "경계 → 안도" } },
    { "stage": 2, "name": "호기심", "chapters": "3~4", "emotions": { "도윤": "호기심 → 호감", "위팅": "안도 → 호기심" } },
    ...
  ]
}
```

규칙:
- `N단계 — 이름 (화 범위)` 형태의 헤더
- 캐릭터별 감정을 화 범위와 매핑
- Writer가 현재 쓰는 화가 어느 단계인지 판단하는 기준

**chapters.md** — 각 화의 계획

```markdown
## 1화: 계약 통역 (첫 만남)
- 아줌마 전화로 통역 요청
- 건물 입구에서 위팅과 첫 만남
- 영업마인드로 방 설명 → 위팅 경계
- 계약서 보여주며 설득 → 계약 성사
- 산링 이름 유래 장면

## 2화: 현금 사태
- 다음 날 아줌마 긴급 전화
- 오만원 뭉탱이
- 은행 입금
```

파싱 결과:
```json
{
  1: { "title": "계약 통역 (첫 만남)", "scenes": ["아줌마 전화로 통역 요청", "건물 입구에서 위팅과 첫 만남", ...] },
  2: { "title": "현금 사태", "scenes": ["다음 날 아줌마 긴급 전화", "오만원 뭉탱이", ...] },
  ...
}
```

규칙:
- `## N화: 제목` 형태의 헤더
- 하위 리스트 = 씬/이벤트
- Writer는 `write N` 실행 시 N번째 계획만 추출
- 계획이 없는 화는 에러 ("N화 계획이 bible에 없습니다")

**style.md / tone.md / constraints.md** — 리스트 형태

```markdown
## 필체/문체
- 구어체, ㅋㅋ 살리기
- 짧은 문장 위주
- 1인칭 남성 화자
```

파싱 결과:
```json
["구어체, ㅋㅋ 살리기", "짧은 문장 위주", "1인칭 남성 화자"]
```

규칙:
- `-` 로 시작하는 줄을 리스트 항목으로 파싱
- 헤더(`##`)는 카테고리 구분용, 무시 가능
- Writer 프롬프트에 그대로 주입

### 파싱 원칙

1. **관대한 파서** — 형식이 조금 틀려도 에러 안 남. 최대한 정보 추출
2. **키 제한 없음** — characters.md에 정해진 필드(age, personality 등)를 강제하지 않음
3. **빈 파일 허용** — relationships.md가 비어 있어도 경고만 하고 진행
4. **확장 가능** — bible/에 새 .md 파일을 추가하면 자동으로 인식 (예: world.md 세계관 파일)
5. **YAML frontmatter 지원** — 파일 상단에 `---` 블록이 있으면 메타데이터로 파싱 (선택적)

### 커스텀 파일 자동 인식

bible/ 폴더에 사용자가 임의의 .md 파일을 추가하면:

```
bible/
├── characters.md
├── ...
├── world.md          # 사용자 추가 (판타지 세계관)
└── timeline.md       # 사용자 추가 (사건 타임라인)
```

- world.md, timeline.md는 파서에 정의되지 않은 파일
- 하지만 Writer 프롬프트에 "Additional Context"로 자동 포함됨
- 새 파일 종류를 코드에 등록하지 않아도 됨

### 파싱 흐름 (Writer 실행 시)

```
write 5 실행 →

1. chapters.md 파싱 → 5화 계획 추출
2. characters.md 파싱 → 전체 캐릭터 정보
3. relationships.md 파싱 → 관계도
4. emotion.md 파싱 → 5화가 속한 감정 단계 확인
5. style.md 파싱 → 필체/문체 규칙
6. tone.md 파싱 → 톤/분위기 규칙
7. constraints.md 파싱 → 금지 사항
8. (있다면) 커스텀 .md 파일들 → 추가 맥락

→ 전부 조합해서 프롬프트의 user 메시지 생성
```

---

## 11. 기술 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| 언어 | Python 3.11+ | AI 생태계, 타이핑, 비동기 |
| CLI | Typer | 타입 힌트 기반, 자동 help 생성 |
| HTTP | httpx | 비동기 + 스트리밍 |
| 콘솔 | Rich | 컬러 출력, 진행률, 트리 |
| 검증 | Pydantic | 설정/데이터 검증 |
| 저장 | 파일 시스템 | DB 없음, git 친화적 |
| 테스트 | pytest | 표준 |
| 패키징 | uv | 빠른 설치 |

---

## 11. 개발 로드맵

### Phase 1: MVP (핵심 — 글을 쓸 수 있는 상태)
- [ ] config: 프로젝트 설정 로드/저장
- [ ] bible: bible.md 파싱
- [ ] llm/provider: OpenAI 호환 API 클라이언트
- [ ] llm/prompts: 기본 프롬프트 + craft rules
- [ ] writer: 1화 생성 (bible → 프롬프트 → API → 파일)
- [ ] cli: init, config, write, read, list
- → 목표: bible.md를 넣고 1화를 쓸 수 있다

### Phase 2: Memory (연재 가능)
- [ ] memory: 챕터별 자동 요약
- [ ] writer: 이전 챕터 요약 주입
- [ ] cli: write next, context, status
- → 목표: 14화까지 맥락 유지하며 연재

### Phase 3: Editor (수정)
- [ ] editor: 챕터 재생성
- [ ] editor: 추가 지시사항 (--instruction)
- [ ] cli: rewrite, edit, export
- → 목표: 마음에 안 드는 화를 다시 쓸 수 있다

### Phase 4: Polish (완성도)
- [ ] reviewer: 선택적 품질 피드백
- [ ] bible: 템플릿 (romance, scifi, mystery)
- [ ] bible: validate (누락/충돌 검사)
- [ ] cli: status (감정 곡선 시각화)
- → 목표: 실사용 가능한 도구

### Phase 5: Web UI (선택적)
- [ ] FastAPI 백엔드
- [ ] Next.js 프론트엔드 (에디터, 챕터 관리)
- → 목표: 터미널이 아닌 웹에서 작업
