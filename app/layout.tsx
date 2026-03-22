import type { Metadata } from "next";
import { Geist_Mono, Noto_Serif_JP } from "next/font/google";
import "./globals.css";
import DevAbortErrorSilencer from "./app/_components/DevAbortErrorSilencer";

const notoSerifJp = Noto_Serif_JP({
  variable: "--font-noto-serif-jp",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "Tetsuryū-Kai",
    template: "%s | Tetsuryū-Kai",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu" suppressHydrationWarning>
      <body
        className={`${notoSerifJp.variable} ${geistMono.variable} relative min-h-screen bg-black text-white antialiased`}
      >
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "url('/yakuza-bg.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          />
          <div className="absolute inset-0 bg-black/76" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(120,10,10,0.24),transparent_34%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(70,0,0,0.16),transparent_28%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.18)_70%,rgba(0,0,0,0.46)_100%)]" />
        </div>

        <div className="relative z-10">
          <DevAbortErrorSilencer />
          {children}
        </div>
      </body>
    </html>
  );
}