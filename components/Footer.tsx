import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-10 text-center text-xs text-white/40">
      <div className="space-x-4">
        <Link href="/privacy" className="hover:text-white/70">
          Privacidad
        </Link>
        <Link href="/terms" className="hover:text-white/70">
          Terminos
        </Link>
      </div>
      <p className="mt-3">
        Solo para uso personal. Respeta los derechos de autor de cada plataforma.
      </p>
    </footer>
  );
}
