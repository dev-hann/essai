import { promises as fs } from "node:fs";
import path from "node:path";
import { ProjectConfig, projectConfigSchema } from "@essai/core";
import { type NextRequest, NextResponse } from "next/server";
import { getProjectDir } from "../../../lib/projectDir";

export const dynamic = "force-dynamic";

export async function GET() {
	try {
		const config = await ProjectConfig.load(getProjectDir());
		return NextResponse.json(config.toJSON());
	} catch (err) {
		const message = err instanceof Error ? err.message : "load failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = (await req.json()) as Record<string, unknown>;
		const existing = await ProjectConfig.load(getProjectDir());
		const existingJson = existing.toJSON();

		const merged = {
			...existingJson,
			...body,
			llm: {
				...existingJson.llm,
				...((body.llm as Record<string, unknown> | undefined) ?? {}),
			},
		};

		if (merged.llm.apiKey === "***") {
			merged.llm.apiKey = existingJson.llm.apiKey;
		}

		const parsed = projectConfigSchema.parse(merged);
		const config = new ProjectConfig(parsed);
		const dir = getProjectDir();

		const file = path.join(dir, "essai.json");
		const payload = { ...config.toJSON(), llm: { ...config.llm } };
		await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");

		return NextResponse.json({ ok: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : "save failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
