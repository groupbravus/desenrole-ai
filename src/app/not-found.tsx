import Link from "next/link";

export default function NotFound() {
  return (
    <html lang="pt-BR">
      <body
        style={{
          background: "#0a0a0b",
          color: "#f5f5f4",
          display: "grid",
          placeItems: "center",
          minHeight: "100dvh",
          fontFamily: "system-ui",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 64, fontWeight: 700, margin: 0 }}>404</p>
          <Link href="/" style={{ color: "#e6a23c" }}>
            Voltar ao início
          </Link>
        </div>
      </body>
    </html>
  );
}
