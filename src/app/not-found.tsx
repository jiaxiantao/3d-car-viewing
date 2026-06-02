import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-white">页面不存在</h1>
      <p className="text-sm text-slate-400">请返回 3D 看车主页继续体验。</p>
      <Link
        href="/"
        className="rounded-full bg-cyan-200 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-100"
      >
        返回首页
      </Link>
    </main>
  );
}
