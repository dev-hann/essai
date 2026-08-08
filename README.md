# Essai — essay + AI

> **essai** = **essay** + **AI**. 글쓰기에 AI를 더하다.

AI 소설 작성 프레임워크. 작가가 통제하는 글쓰기 — 모델 독립적, 언어 독립적, 장르 독립적.

## 빠른 시작

```bash
# 프로젝트 생성
essai init my-novel
cd my-novel

# 글로벌 기본값 설정 (모든 신규 프로젝트에 상속)
essai config set -g defaultBaseUrl https://api.z.ai/api/coding/paas/v4
essai config set -g defaultApiKey sk-...
essai config set -g defaultModel glm-5.1
essai config set -g defaultLanguage ko

# 또는 프로젝트별 설정 (essai.json에 직접 기록)
essai config set llm.model glm-5.1
essai config set llm.apiKey sk-...

# 성경(bible) 초기화 후 1장 작성
essai bible init romance
essai write next

# 웹 UI 실행 — http://localhost:7331
essai serve

# 또는 터미널 UI
essai tui
```

## 기술 스택

- **언어**: TypeScript (엄격 모드)
- **AI**: Vercel AI SDK (ai + @ai-sdk/openai-compatible)
- **CLI/TUI**: Commander.js + Ink 7 (React 19)
- **Web**: Next.js 15 (localhost:7331 via `essai serve`)
- **Validator**: 정적 일관성 검사 (`bible/world.md` 기반, LLM 없음)
- **모노레포**: pnpm workspaces + Turborepo
- **린트/타입**: Biome, TypeScript strict, Zod
- **CI**: GitHub Actions (build · typecheck · lint · test)

## 구조

```
essai/
├── packages/
│   ├── core/          # 코어 로직 (순수 TS, UI 의존성 제로)
│   ├── cli/           # CLI (Commander.js + Ink)
│   ├── tui/           # TUI (Ink, Phase 5)
│   └── web/           # Web (Next.js)
├── templates/          # Bible 템플릿
└── docs/               # 설계 문서
```

## CLI 명령

| 명령 | 설명 |
| --- | --- |
| `init [name]` | 새 essai 프로젝트 생성 |
| `config set <key> <value>` | 설정값 쓰기 (`-g`로 글로벌) |
| `config get <key>` | 설정값 읽기 |
| `config show` | 전체 `essai.json` 출력 |
| `write <chapter>` | 챕터 작성 (숫자 또는 `next`) |
| `read <chapter>` | 챕터 출력 |
| `list` | 작성된 챕터 목록 + 글자 수 |
| `status` | 프로젝트 진행 상황 |
| `context <chapter>` | 챕터 작성 시 주입될 컨텍스트 미리보기 |
| `rewrite <chapter>` | 챕터 처음부터 다시 생성 (덮어쓰기, `-i` 지시문, 자동 `.bak` 백업) |
| `review <chapter>` | 챕터 품질 피드백 (`-r` 커스텀 룰) |
| `validate <chapter>` | 정적 일관성 검사 (`bible/world.md` 기반, `--disable <rule>`로 특정 룰 끄기) |
| `export` | 모든 챕터를 단일 파일로 (`-f md\|txt`) |
| `serve` | 웹 UI 시작 (`-p`, `--start`) |
| `tui` | 터미널 UI (Ink) 시작 |
| `bible init/show/edit/validate/add` | `bible/` 폴더 관리 (`bible init <template> --agent`로 AI 대화형 생성) |

### `write` 플래그

- `-i, --instruction <text>` — 작가 지시문 추가
- `--raw` — 파이프라인 건너뛰고 글만 작성 (review/fix 생략)
- `--no-fix` — review는 수행하되 자동 수정은 생략

### `serve`

Next.js 웹 UI를 실행한다. 기본 포트 7331 — http://localhost:7331

- `-p, --port <port>` — 포트 지정
- `--start` — dev 대신 프로덕션 서버 (`next build` 선행 필요)

## 설정

각 프로젝트는 `essai.json`을 가진다. 공통 기본값은 글로벌 설정에서 가져온다.

### 글로벌 설정 (`~/.essai/config.json`)

LLM 기본값, 언어, 그리고 생성된 프로젝트 목록을 보관한다. `config set -g`로 편집하거나 직접 수정할 수 있다.

```jsonc
{
  "llm": {
    "model": "glm-5.1",
    "baseUrl": "https://api.example.com/v4",
    "apiKey": "sk-..."
  },
  "language": "ko",
  "chapterWords": 3000,
  "projects": [
    { "name": "my-novel", "path": "/path/to/my-novel", "id": "my-novel-abc123" }
  ]
}
```

#### 글로벌 키 (프로젝트 생성 시 신규 `essai.json`에 상속)

| 키 | 설명 |
| --- | --- |
| `defaultBaseUrl` | LLM API 엔드포인트 |
| `defaultApiKey` | LLM API 키 |
| `defaultModel` | 모델 이름 |
| `defaultLanguage` | 기본 출력 언어 (`ko`, `en`, `ja`, `zh` 등 — 코드에서 언어 목록 고정하지 않음) |
| `defaultChapterWords` | 챕터당 목표 글자 수 |
| `defaultTemperature` | 샘플링 온도 |

#### 프로젝트 키 (`essai.json` 직접 편집 또는 `config set <key>`)

| 키 | 설명 |
| --- | --- |
| `llm.baseUrl` / `llm.apiKey` / `llm.model` | LLM 설정 (글로벌보다 우선) |
| `llm.temperature` / `llm.maxTokens` / `llm.thinkingEnabled` | 생성 파라미터 |
| `language` | 출력 언어 |
| `chapterWords` | 챕터당 목표 글자 수 |

프로젝트별 `essai.json`이 글로벌 기본값보다 우선한다.

## 설계 문서

전체 설계는 [docs/design.md](docs/design.md)를 참고.

## 일관성 검사 (`bible/world.md`)

`bible/world.md`에 작가가 정의한 세계관을 두면 `essai validate <chapter>`가 정적(비-LLM) 검사를 수행한다. `docs/validation-future-work.md`의 제안 구현.

```markdown
# world.md 예시

## 공간
- 분식집: 1층 (101호)
- 도윤: 302호 (3층)
- 산링: 203호 (2층)

## 소품 규칙
- 출입: 도어락. 열쇠 ❌
- 통신: 카톡

## 타임라인
- 입국: 9월 / 귀국: 3월 / 총 6개월
```

검사 항목:
- **floor-consistency** — "벽 하나 사이" 인물이 다른 층에 살 때
- **forbidden-props** — `world.md`가 금지한 소품이 본문에 등장할 때
- **visa-duration** — 비자 종류 vs 체류 기간 불일치

```bash
$ essai validate 1
✗ [floor-consistency] Adjacency claim between "도윤" (floor 3) and "산링" (floor 2)
⚠ [forbidden-props] Text mixes "도어락" (keyless) with "열쇠" (key)
⚠ [visa-duration] Visa type matched (H-?1...) typically allows ~6 months, but text mentions 12 months
```
