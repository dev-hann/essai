import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import type { LlmConfigData } from "../config/schema.js";

const PROVIDER_NAME = "essai";

export function createModel(config: LlmConfigData): LanguageModel {
	const provider = createOpenAICompatible({
		name: PROVIDER_NAME,
		baseURL: config.baseUrl,
		apiKey: config.apiKey,
	});
	return provider.languageModel(config.model);
}

/**
 * Provider options used to disable thinking/reasoning on models that support it
 * (e.g. GLM-5.x). When `thinkingEnabled` is true we return undefined so the
 * provider's default behavior applies.
 */
export function thinkingProviderOptions(
	config: LlmConfigData,
): { thinking: { type: "disabled" } } | undefined {
	return config.thinkingEnabled
		? undefined
		: { thinking: { type: "disabled" } };
}
