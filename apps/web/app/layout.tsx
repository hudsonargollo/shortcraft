import type { ReactNode } from "react";
import "./(studio)/globals.css";

export const metadata = {
  title: "Shortcraft Studio",
  description: "Turn a script into a narrated animated video — script, shots, references, storyboard, render.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
