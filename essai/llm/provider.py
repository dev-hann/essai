"""LLM provider — OpenAI-compatible API client with streaming support."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import AsyncIterator, Optional

import httpx

from .config import LLMConfig


@dataclass
class ChatMessage:
    role: str  # "system" | "user" | "assistant"
    content: str


@dataclass
class LLMResponse:
    content: str
    reasoning: str = ""
    usage: dict = None


class LLMProvider:
    """OpenAI-compatible API client. Works with GLM, GPT, Claude (via proxy), local models."""

    def __init__(self, config: LLMConfig):
        self.config = config
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=10.0),
        )

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }

    def _payload(
        self,
        messages: list[ChatMessage],
        *,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stream: bool = True,
    ) -> dict:
        payload = {
            "model": self.config.model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": temperature if temperature is not None else self.config.temperature,
            "max_tokens": max_tokens if max_tokens is not None else self.config.max_tokens,
            "stream": stream and self.config.stream,
        }
        # reasoning 비활성화 (GLM-5.x 등 thinking 모델용)
        if not self.config.thinking_enabled:
            payload["thinking"] = {"type": "disabled"}
        return payload

    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> LLMResponse:
        """Non-streaming chat completion."""
        payload = self._payload(messages, temperature=temperature, max_tokens=max_tokens, stream=False)
        resp = await self.client.post(
            f"{self.config.base_url}/chat/completions",
            headers=self._headers(),
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        msg = data["choices"][0]["message"]
        return LLMResponse(
            content=msg.get("content", ""),
            reasoning=msg.get("reasoning_content", ""),
            usage=data.get("usage", {}),
        )

    async def stream_chat(
        self,
        messages: list[ChatMessage],
        *,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> AsyncIterator[str]:
        """Streaming chat completion. Yields content chunks."""
        payload = self._payload(messages, temperature=temperature, max_tokens=max_tokens, stream=True)
        async with self.client.stream(
            "POST",
            f"{self.config.base_url}/chat/completions",
            headers=self._headers(),
            json=payload,
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str.strip() == "[DONE]":
                    break
                try:
                    chunk = json.loads(data_str)
                    delta = chunk["choices"][0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield content
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue

    async def close(self):
        await self.client.aclose()
