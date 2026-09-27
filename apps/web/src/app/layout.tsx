import type { ReactNode } from "react";
import "./globals.css";

// La mise en page complète (html, body) est dans app/[locale]/layout.tsx.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
