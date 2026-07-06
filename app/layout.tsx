import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Body / UI
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

// Techy geometric display
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

// Mono for labels, indices, data microtype
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://redmontstrategies.com"),
  title: "Redmont Strategies Group | Business Consulting for the AI Era",
  description:
    "Redmont Strategies Group helps service businesses modernize operations, improve lead conversion, and build smarter systems for growth. Strategy first. Technology second. Execution always.",
  keywords: [
    "business consulting",
    "AI strategy",
    "operations consulting",
    "lead conversion",
    "business systems",
    "AI implementation",
    "CRM systems",
    "service business growth",
  ],
  openGraph: {
    title: "Redmont Strategies Group | Business Consulting for the AI Era",
    description:
      "Strategy first. Technology second. Execution always. RSG helps service businesses modernize operations, improve lead conversion, and implement AI with a real business purpose.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrains.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
