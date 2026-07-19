import Sidebar from "../components/Sidebar";

export default function HomePage() {
	return (
		<div className="flex min-h-screen">
			<Sidebar />
			<main className="flex-1 p-8">
				<h1 className="text-2xl font-semibold text-neutral-100">
					Essai Dashboard
				</h1>
				<p className="mt-2 text-sm text-neutral-400">
					작업을 시작하려면 사이드바에서 항목을 선택하세요.
				</p>
			</main>
		</div>
	);
}
