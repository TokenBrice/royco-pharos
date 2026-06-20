import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Source_Serif_4 } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/roycopharos/theme-toggle";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-serif", display: "swap" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

const themeScript = `(function(){try{var t=localStorage.getItem('rp-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='light';}})();`;

export const metadata: Metadata = {
  title: "RoycoPharos",
  description: "Risk-first Royco Dawn tranche scoring powered by Pharos safety data.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} ${mono.variable}`}
      data-theme="light"
      suppressHydrationWarning
    >
      <body>
        <Script id="rp-theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <header className="site-header">
          <Link className="brand" href="/" aria-label="RoycoPharos overview">
            <span className="brand-mark" aria-hidden="true" />
            <span>RoycoPharos</span>
          </Link>
          <div className="header-right">
            <nav aria-label="Primary">
              <Link href="/">Overview</Link>
              <Link href="/methodology">Methodology</Link>
              <Link href="/health">Health</Link>
            </nav>
            <ThemeToggle />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
