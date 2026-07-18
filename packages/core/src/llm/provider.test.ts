import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	languageModel: vi.fn(),
}));

vi.mock("@ai-sdk/openai-compatible", () => ({
	createOpenAICompatible: vi.fn(() => ({
		languageModel: mocks.languageModel,
	})),
}));

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LlmConfigData } from "../config/schema.js";
import { createModel } from "./provider.js";

function sampleLlm(overrides: Partial<LlmConfigData> = {}): LlmConfigData {
	return {
		baseUrl: "https://api.example.com/v4",
		apiKey: "secret-key",
		model: "glm-5.1",
		temperature: 0.7,
		maxTokens: 8000,
		thinkingEnabled: false,
		...overrides,
	};
}

describe("createModel", () => {
	beforeEach(() => {
		vi.mocked(createOpenAICompatible).mockClear();
		mocks.languageModel.mockClear();
		mocks.languageModel.mockReturnValue({ modelId: "glm-5.1" });
	});

	it("creates the provider with name essai, baseURL and apiKey from config", () => {
		createModel(sampleLlm());

		expect(createOpenAICompatible).toHaveBeenCalledWith({
			name: "essai",
			baseURL: "https://api.example.com/v4",
			apiKey: "secret-key",
		});
	});

	it("requests the model id configured in llm.model", () => {
		createModel(sampleLlm({ model: "gpt-4o" }));

		expect(mocks.languageModel).toHaveBeenCalledWith("gpt-4o");
	});

	it("returns the model instance produced by the provider", () => {
		const instance = { modelId: "glm-5.1" };
		mocks.languageModel.mockReturnValue(instance);

		expect(createModel(sampleLlm())).toBe(instance);
	});
});
