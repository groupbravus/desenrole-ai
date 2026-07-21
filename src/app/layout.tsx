import type { ReactNode } from "react";
import "./globals.css";

// O layout raiz apenas repassa. O <html> real vive em [locale]/layout
// para carregar o atributo lang correto.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
