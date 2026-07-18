# Essai — AI-assisted fiction writing framework

> **essai** = **essay** + **AI**. 글쓰기에 AI를 더하다.

## 아키텍처

```
┌──────────────────────────────────────────────────┐
│                    Essai CLI / Web                │
├──────────────────────────────────────────────────┤
│                                                   │
│   Bible ──── Writer ──── Memory ──── Editor      │
│     │           │           │           │         │
│     │     LLM Provider       │       Reviewer     │
│     │           │            │          │         │
│  settings    prompts      context    quality      │
│  characters  craft        summary    metrics      │
│  plot        generation   retrieval  feedback     │
│  chapters    streaming               rewrite      │
│                                                   │
├──────────────────────────────────────────────────┤
│              Storage (filesystem)                 │
│  project.json · bible.md · chapters/ · memory/    │
└──────────────────────────────────────────────────┘
```

### 핵심 모듈

**Bible** (설정 관리)
- bible/ 폴더에 파일별로 분리: characters.md, relationships.md, emotion.md, chapters.md, style.md, tone.md, constraints.md
- AI 에이전트와 대화하면서 각 파일을 개별적으로 채움
- Markdown + YAML frontmatter, git 친화적

**Writer** (챕터 생성)
- bible + 이전 챕터 요약을 context로 주입
- 모델 API 호출 (OpenAI 호환)
- streaming 지원
- reasoning 비활성화 옵션

**Memory** (맥락 유지)
- 챕터별 자동 요약 생성
- 다음 챕터 작성 시 관련 맥락만 선택적 주입
- 토큰 예산 관리

**Editor** (수정)
- 챕터별 재생성
- 부분 수정 (특정 문단만)
- 이전 챕터에 영향 안 주는 격리 구조

**Reviewer** (선택적)
- 작가가 기준 커스텀
- 또는 끌 수 있음 (기본 OFF)
- 점수가 아닌 피드백 제공

## 디렉토리 구조

```
essai/
├── README.md
├── LICENSE                   # MIT
├── pyproject.toml            # Python 패키지 설정
├── essai/
│   ├── __init__.py
│   ├── cli.py                # CLI 진입점 (click/typer)
│   ├── config.py             # 설정 관리
│   ├── bible.py              # Bible 파싱/관리
│   ├── writer.py             # 챕터 생성
│   ├── memory.py             # 맥락/요약 관리
│   ├── editor.py             # 챕터 수정/재생성
│   ├── reviewer.py           # 품질 검토 (선택적)
│   ├── llm/
│   │   ├── __init__.py
│   │   ├── provider.py       # OpenAI 호환 API 클라이언트
│   │   └── prompts.py        # 프롬프트 빌더 (craft rules 포함)
│   └── storage/
│       ├── __init__.py
│       └── project.py        # 파일 시스템 저장소
├── tests/
│   ├── test_bible.py
│   ├── test_writer.py
│   ├── test_memory.py
│   └── test_provider.py
└── docs/
    └── architecture.md
```

### 프로젝트 구조 (사용자 관점)

```
my-novel/
├── essai.json                # 프로젝트 설정 (모델, 언어 등)
├── bible/                    # 설정서 (파일별 분리)
│   ├── characters.md
│   ├── relationships.md
│   ├── emotion.md
│   ├── chapters.md
│   ├── style.md
│   ├── tone.md
│   └── constraints.md
├── chapters/
│   ├── 001.md                # 1화
│   ├── 002.md                # 2화
│   └── ...
├── memory/                   # 자동 생성
│   ├── 001.json              # 1화 요약
│   └── ...
└── exports/                  # 내보낸 파일
```

## 기술 스택

- **언어**: Python 3.11+
- **CLI**: Typer (click 기반, 타입 힌트)
- **LLM**: httpx (OpenAI 호환 API)
- **저장소**: 파일 시스템 (JSON + Markdown)
- **테스트**: pytest
- **패키징**: uv 또는 pip

## CLI 명령어 설계

```bash
# 프로젝트 초기화
essai init my-novel

# 설정
essai config set model glm-5.1
essai config set api-key $GLM_API_KEY
essai config set base-url https://api.z.ai/api/coding/paas/v4

# Bible 관리
essai bible show               # 현재 설정 출력
essai bible edit               # 에디터에서 bible.md 열기

# 챕터 작성
essai write 1                  # 1화 생성
essai write next               # 다음 화 생성
essai write 5 --from-chapter 3 # 5화를 3화 context로 생성

# 챕터 수정
essai edit 3                   # 3화 수정 (재생성)
essai edit 3 --section "옥상"  # 특정 부분만 수정

# 검토 (선택적)
essai review 5                 # 5화 품질 검토
essai review --custom-rules ./my-rules.md

# 상태 확인
essai status                   # 프로젝트 현황
essai list                     # 챕터 목록 + 글자수

# 내보내기
essai export --format md       # 전체 Markdown
essai export --format txt      # 일반 텍스트
```

## 핵심 설계 원칙

1. **파일이 곧 데이터** — 데이터베이스 없음. Markdown과 JSON만
2. **git 친화적** — 모든 파일이 텍스트. diff로 변경 추적 가능
3. **프롬프트가 분리됨** — prompts.py에서 관리, 사용자가 수정 가능
4. **모델 독립** — reasoning 켜기/끄기, temperature, max_tokens 전부 설정 가능
5. **점진적 적용** — Bible만 쓰고 직접 써도 됨. Writer 안 써도 됨

## 라이선스

MIT
