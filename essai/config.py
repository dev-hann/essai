"""Configuration management for Essai projects."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import json


@dataclass
class LLMConfig:
    """LLM provider configuration."""

    base_url: str = ""
    api_key: str = ""
    model: str = ""
    temperature: float = 0.7
    max_tokens: int = 8000
    thinking_enabled: bool = False
    stream: bool = True


@dataclass
class ProjectConfig:
    """Essai project configuration."""

    name: str = ""
    language: str = "ko"  # 출력 언어 (프롬프트에서 처리, 코드에서 제한 없음)
    chapter_words: int = 3000
    llm: LLMConfig = field(default_factory=LLMConfig)

    @classmethod
    def load(cls, project_dir: str | Path) -> "ProjectConfig":
        """Load config from essai.json in the project directory."""
        path = Path(project_dir) / "essai.json"
        if not path.exists():
            return cls()
        data = json.loads(path.read_text(encoding="utf-8"))
        llm_data = data.pop("llm", {})
        return cls(llm=LLMConfig(**llm_data), **data)

    def save(self, project_dir: str | Path) -> None:
        """Save config to essai.json."""
        path = Path(project_dir) / "essai.json"
        data = {
            "name": self.name,
            "language": self.language,
            "chapter_words": self.chapter_words,
            "llm": {
                "base_url": self.llm.base_url,
                "api_key": "***",  # 마스킹
                "model": self.llm.model,
                "temperature": self.llm.temperature,
                "max_tokens": self.llm.max_tokens,
                "thinking_enabled": self.llm.thinking_enabled,
                "stream": self.llm.stream,
            },
        }
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    @classmethod
    def from_env(cls) -> "ProjectConfig":
        """Load config from environment variables."""
        import os

        return cls(
            llm=LLMConfig(
                base_url=os.getenv("ESSAI_BASE_URL", ""),
                api_key=os.getenv("ESSAI_API_KEY", ""),
                model=os.getenv("ESSAI_MODEL", ""),
                thinking_enabled=os.getenv("ESSAI_THINKING", "false").lower() == "true",
            )
        )
