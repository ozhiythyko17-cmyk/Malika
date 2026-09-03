import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "SkripsiKu — penyusun draft skripsi",
  description:
    "Satu prompt jadi draft skripsi lengkap; wajib direview mahasiswa sebelum diekspor.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
