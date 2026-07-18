# Essai — essay + AI

> **essai** = **essay** + **AI**. 글쓰기에 AI를 더하다.

AI 소설 작성 프레임워크. 작가가 통제하는 글쓰기 — 모델 독립적, 언어 독립적, 장르 독립적.

## 기술 스택

- **언어**: TypeScript (엄격 모드)
- **AI**: Vercel AI SDK (ai + @ai-sdk/openai-compatible)
- **CLI/TUI**: Commander.js + Ink
- **Web**: Next.js (Phase 5)
- **모노레포**: pnpm workspaces + Turborepo
- **린트/타입**: Biome, TypeScript strict, Zod

## 구조

```
essai/
├── packages/
│   ├── core/          # 코어 로직 (순수 TS, UI 의존성 제로)
│   ├── cli/           # CLI (Commander.js + Ink)
│   ├── tui/           # TUI (Ink, Phase 5)
│   └── web/           # Web (Next.js, Phase 5)
├── templates/          # Bible 템플릿
└── docs/               # 설계 문서
```

## 설계 문서

전체 설계는 [docs/design.md](docs/design.md)를 참고.
