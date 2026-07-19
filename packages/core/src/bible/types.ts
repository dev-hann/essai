export type Character = Record<string, string>;

export interface Relationship {
	from: string;
	to: string;
	description: string;
}

export interface EmotionStage {
	stage: number;
	name: string;
	chapters: string;
	emotions: Record<string, string>;
}

export interface ChapterPlan {
	number: number;
	title: string;
	scenes: string[];
}

export interface BibleData {
	characters: Record<string, Character>;
	relationships: Relationship[];
	emotion: EmotionStage[];
	chapters: Map<number, ChapterPlan>;
	style: string[];
	tone: string[];
	constraints: string[];
	additionalContext: Record<string, string>;
}
