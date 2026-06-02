import Link from "next/link";

const LINKS = [
  { href: "/",          label: "Inicio" },
  { href: "/youtube",   label: "YouTube" },
  { href: "/tiktok",    label: "TikTok" },
  { href: "/instagram", label: "Instagram" },
  { href: "/facebook",  label: "Facebook" },
  { href: "/twitter",   label: "Twitter / X" }
];

export default function PlatformNav({ active }: { active?: string }) {
  return (
    <nav className="mb-8 flex flex-wrap items-center justify-center gap-2 text-sm">
      {LINKS.map((l) => {
        const isActive = l.href === active;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-full px-3 py-1.5 border transition ${
              isActive
                ? "border-violet-400 bg-violet-500/20 text-white"
                : "border-white/10 bg-white/[0.02] text-white/70 hover:border-white/20 hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
