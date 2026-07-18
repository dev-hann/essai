# Validation System — 차후 작업 메모

> 2026-07-18 논의 결과. design.md 업데이트 전 참고용.

## 배경

my-first-novel 작성 중 발견된 일관성 문제:
- 공간: 도윤이 203호(2층)인데 산링이 301호(3층) → "벽 하나 사이" 성립 불가
- 소품: 도어락 건물인데 "열쇠" 등장
- 시간: H-1 비자 "1년"인데 실제 체류 6개월 (9월~3월)

이런 문제를 essai가 검증할 수 있어야 함.

## InkOS 분석 결과 (reference)

InkOS는 2계층 검증 사용:

1. Post-write Validator (정적, LLM 없음)
   - 텍스트 표면 검사: 금지 패턴, 피로 단어, 문단 형태, 서술 인칭
   - 비용 0, 결정론적
   - 한계: 구조적 일관성(호수, 소품, 타임라인)은 안 잡음

2. Continuity Auditor (LLM 기반)
   - 37개 감사 차원 (장르별 활성화)
   - current_state.md, pending_hooks.md 등 상태 파일과 챕터 교차 검사
   - 한계: 상태 파일이 생성물에서 파생 → 첫 오류 전파됨

소스 위치: ~/.volta/tools/image/packages/@actalk/inkos/.../inkos-core/dist/
- agents/continuity.js (LLM 감사자, 37차원)
- agents/post-write-validator.js (정적 검증)
- pipeline/chapter-truth-validation.js (검증 파이프라인)
- state/state-validator.js (상태 스키마 검증)

## essai 방향성

### 가져갈 것
- 2계층 구조 (정적 + LLM)
- 장르별 감사 차원 (genres/*.md auditDimensions 활용)
- 구조화된 감사 결과 (severity, repair_scope)
- Memory 확장 (상태 추적)

### 개선할 것 (InkOS 약점)
- 작가 정의 world.md → 검증 기준이 생성물이 아닌 작가 의도에서
- 정적 팩트 체크 추가 (호수 패턴, 금지 소품, 타임라인 산술)
- 37차원 → 8-10개로 축소, 현실 로맨스 맞춤
- 한국어 특화 정적 규칙

### 제안하는 essai 감사 차원
1. OOC (캐릭터 일관성)
2. 타임라인
3. 설정 충돌 (공간/소품)
4. 감정선 연속성
5. 언어 발전 (산링 한국어 실력 변화)
6. 페이싱
7. 정보 경계
8. 피로 단어 (정적 검증 연계)

### 제안하는 world.md 구조
```
## 공간
- 분식집: 1층 (101호)
- 도윤: 302호 (3층)
- 산링: 301호 (3층)

## 소품 규칙
- 출입: 도어락. 열쇠 ❌
- 통신: 카톡, 전화

## 타임라인
- 입국: 9월 / 귀국: 3월 / 총 6개월
- 비자: H-1, 체류 6개월
```

### 제안하는 Memory 확장
```typescript
interface ChapterMemory {
  // 기존 유지
  propsIntroduced: string[]
  propsUsed: string[]
  timelinePosition: { month: string, relativeTo: string }
  languageLevel?: Record<string, string>
}
```

## 작업 순서 (나중에)

1. design.md에 Validation 섹션 추가
2. core/validator/ 모듈 생성 (static-validator.ts)
3. core/bible/types.ts에 WorldData 추가
4. core/reviewer/ 모듈 구현 (LLM 감사자)
5. CLI: essai validate <chapter> 명령어
6. 한국어 정적 규칙 작성
7. my-first-novel로 E2E 테스트

## 관련 파일
- ~/Documents/writing/my-first-novel/consistency-checklist.md (수동 체크리스트)
- ~/Documents/writing/my-first-novel/genres/ko-real-romance.md (장르 정의, auditDimensions 포함)
