import type { ReactNode } from "react";
import "./global.css";

export const metadata = {
  title: "Dr. Herlon Moura — Angiologist",
  description: "Vascular medicine specialist. Diagnostic imaging, endovascular care, and long-term follow-up.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
