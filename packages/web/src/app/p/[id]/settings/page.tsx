import { SettingsClient } from "@/components/SettingsClient.js";

export const dynamic = "force-dynamic";

interface PageProps {
	params: Promise<{ id: string }>;
}

export default async function SettingsPage({ params }: PageProps) {
	const { id } = await params;
	return <SettingsClient projectId={id} />;
}
