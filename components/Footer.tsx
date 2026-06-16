import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-10 text-center text-xs text-white/40">
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        <Link href="/blog" className="hover:text-white/70">Blog</Link>
        <Link href="/sobre" className="hover:text-white/70">Sobre nosotros</Link>
        <Link href="/contacto" className="hover:text-white/70">Contacto</Link>
        <Link href="/privacy" className="hover:text-white/70">Privacidad</Link>
        <Link href="/terms" className="hover:text-white/70">Terminos</Link>
      </div>
      <p className="mt-3">
        Solo para uso personal. Respeta los derechos de autor de cada plataforma.
      </p>
    </footer>
  );
}
