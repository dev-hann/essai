import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import type { LlmConfigData } from "../config/schema.js";

const PROVIDER_NAME = "essai";

export function createModel(config: LlmConfigData): LanguageModel {
	const provider = createOpenAICompatible({
		name: PROVIDER_NAME,
		baseURL: config.baseUrl,
		apiKey: config.apiKey,
		// @ts-expect-error — AI SDK doesn't formally type providerOptions here
		options: config.thinkingEnabled ? {} : { thinking: { type: "disabled" } },
	});
	return provider.languageModel(config.model);
}
