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
bible.md 구조:
- 캐릭터 (이름, 나이, 성격, 말투, 관계)
- 세계관 (배경, 장소, 시간)
- 감정 곡선 (단계별 감정 변화)
- 챕터 계획 (각 화의 핵심 장면과 목표)
- 금지 사항 ("이 설정은 추가하지 마", "이 톤은 유지해")
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

3. Bible 작성
   $ essai bible edit
   → 에디터가 열리고, 작가가 직접 설정을 작성
   → 또는 기존 설정(bible.md)을 복사해 넣음
   → 템플릿 제공: $ essai bible init --template romance

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

**Bible**
- bible.md를 읽고 파싱
- 캐릭터, 감정 곡선, 챕터 계획을 구조화된 데이터로 제공
- 작성 중인 챕터에 해당하는 챕터 계획만 추출
- 템플릿 제공 (로맨스, SF, 미스터리 등 — 단, 템플릿일 뿐 강제 아님)

**Writer**
- Bible + Memory를 조합해서 프롬프트 생성
- LLM Provider에 요청
- 스트리밍 응답을 chapters/NNN.md에 저장
- craft rules (Show don't tell, AI 흔적 제거 등)를 프롬프트에 포함

**Memory**
- 챕터 작성 완료 후 자동 요약 생성
- 요약: 핵심 사건, 감정 변화, 새로 등장한 정보, 미회수 복선
- 다음 챕터 작성 시 최근 N개 요약 + 현재 감정 단계만 주입
- 토큰 예산 내에서 맥락 선택

**LLM Provider**
- OpenAI 호환 API (/v1/chat/completions)
- 스트리밍 지원
- reasoning 켜기/끄기 (GLM-5.x, o1 등)
- 모델 종속적이지 않음 — 어떤 모델이든 동일 인터페이스

### 데이터 흐름 (1화 작성 예시)

```
작가: $ essai write 1

1. Bible에서 1화 챕터 계획 추출
   → "계약 통역 첫 만남, 산링 경계, 세 명 축복..."

2. Memory 확인
   → 이전 챕터 없음 (1화이므로)

3. 프롬프트 조합:
   system: craft rules + "bible에 정의된 설정만 따를 것"
   user:   bible 전체 + 1화 챕터 계획 + "한국어로 작성"

4. LLM Provider → GLM API 스트리밍 호출

5. 응답을 chapters/001.md에 저장

6. Memory: 1화 요약 자동 생성 → memory/001.json에 저장

7. 작가에게 완료 알림
```

### 데이터 흐름 (5화 작성 예시)

```
작가: $ essai write 5

1. Bible에서 5화 챕터 계획 추출

2. Memory에서 1~4화 요약 로드
   → 토큰 예산에 맞게 최근 3개 요약만 선택

3. 프롬프트 조합:
   system: craft rules
   user:   bible 캐릭터/설정 요약 + 1~4화 요약 + 5화 계획

4. LLM 호출 → chapters/005.md 저장

5. Memory: 5화 요약 생성
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
│   ├── config.py              # 설정 관리
│   ├── bible.py               # Bible 파싱/관리
│   ├── writer.py              # 챕터 생성
│   ├── memory.py              # 맥락/요약 관리
│   ├── editor.py              # 챕터 수정/재생성
│   ├── reviewer.py            # 품질 검토 (선택적, 기본 OFF)
│   └── llm/
│       ├── __init__.py
│       ├── provider.py        # OpenAI 호환 API 클라이언트
│       └── prompts.py         # 프롬프트 빌더 + craft rules
├── templates/                  # Bible 템플릿
│   ├── romance.md
│   ├── scifi.md
│   ├── mystery.md
│   └── blank.md
└── tests/
```

### 사용자 프로젝트 (작가의 소설)

```
my-novel/
├── essai.json                  # 프로젝트 설정
├── bible.md                    # 설정서 (작가가 직접 작성)
├── chapters/
│   ├── 001.md                  # 1화
│   ├── 002.md                  # 2화
│   └── ...
├── memory/                     # 자동 생성 (건드릴 필요 없음)
│   ├── 001.json                # 1화 요약
│   ├── 002.json                # 2화 요약
│   └── context.json            # 현재 스토리 상태
└── exports/                    # 내보낸 파일
    └── full.md
```

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
essai bible init [--template romance]  Bible 템플릿 생성
essai bible show                       현재 설정 출력 (트리 구조)
essai bible edit                       에디터에서 bible.md 열기
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

### 7-1. 파일이 곧 데이터
데이터베이스 없음. 전부 Markdown과 JSON. git으로 버전 관리 가능.
작가가 파일을 직접 열어보고 수정할 수 있음.

### 7-2. 점진적 적용
```
Level 0: Bible만 쓴다 → 직접 글을 쓴다 (AI 안 씀)
Level 1: Bible + Writer → 챕터를 AI가 쓴다
Level 2: Bible + Writer + Memory → 긴 연재도 맥락 유지
Level 3: Bible + Writer + Memory + Reviewer → 품질 검토까지
```
모든 단계가 선택적이다.

### 7-3. 프롬프트 분리
프롬프트는 llm/prompts.py에서 관리. 사용자가 수정 가능.
craft rules (Show don't tell, AI 흔적 제거 등)도 파일로 분리.

### 7-4. 모델 독립
OpenAI 호환 API면 모든 모델이 동일하게 작동.
reasoning 모델(GLM-5.x, o1)과 비-reasoning 모델(GLM-5.1, GPT-4o) 모두 지원.

### 7-5. 언어/장르 자유
코드에 언어나 장르를 하드코딩하지 않음.
언어는 config의 language 필드 → 프롬프트에 주입.
장르는 bible.md의 작성 내용 → 프롬프트에 주입.

---

## 8. 기술 스택

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

## 9. 개발 로드맵

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
