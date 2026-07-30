import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { RevealObserver } from "@/components/RevealObserver";
import { PHONE_TEL, SITE_URL } from "@/lib/site";

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// og:image and twitter:image come from the file conventions
// app/opengraph-image.png and app/twitter-image.png, which apply to every
// route and survive per-page openGraph overrides.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title:
    "Redmont Strategies Group | Business & AI Consulting in Plymouth County, MA",
  description:
    "Redmont Strategies Group is a business consulting and AI strategy firm serving service businesses across Plymouth County and the South Shore of Massachusetts.",
  // NOTE: no `alternates.canonical` here — Next.js inherits layout metadata,
  // which would canonicalize every page to the homepage. Each page sets its own.
  robots: { index: true, follow: true },
  openGraph: {
    title:
      "Redmont Strategies Group | Business & AI Consulting in Plymouth County, MA",
    description:
      "Business consulting and AI strategy for service businesses across Plymouth County and the South Shore of Massachusetts.",
    url: SITE_URL,
    siteName: "Redmont Strategies Group",
    locale: "en_US",
    type: "website",
  },
  // Card type only: twitter:title/description deliberately unset so each
  // page's og:title/og:description are used, instead of one site-wide title.
  twitter: {
    card: "summary_large_image",
  },
};

// Organization schema. Publishes the phone number and service area only —
// deliberately no PostalAddress and no openingHours (RSG keeps its street
// address and business hours private).
const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Redmont Strategies Group",
  url: SITE_URL,
  logo: `${SITE_URL}/brand/rsg-mark.png`,
  description:
    "Business consulting and AI strategy for service and retail businesses across Plymouth County and the South Shore of Massachusetts.",
  telephone: PHONE_TEL,
  areaServed: [
    { "@type": "AdministrativeArea", name: "Plymouth County, Massachusetts" },
    { "@type": "AdministrativeArea", name: "South Shore, Massachusetts" },
  ],
  contactPoint: {
    "@type": "ContactPoint",
    telephone: PHONE_TEL,
    contactType: "sales",
    areaServed: "US",
    availableLanguage: "English",
  },
};

const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Redmont Strategies Group",
  url: SITE_URL,
  publisher: { "@type": "Organization", name: "Redmont Strategies Group" },
};

/**
 * Runs synchronously as the first thing in <body>, before anything paints.
 *
 * Scroll reveals are a desktop flourish: this opts the document in only on a
 * wide viewport whose user welcomes motion. Phones never set the flag, so
 * [data-reveal] content stays visible and no observer or animation JS runs.
 *
 * The timer is a failsafe. If the flag is set but RevealObserver never boots
 * — a chunk fails to load, hydration errors — it strips the flag and the page
 * paints in full rather than leaving the body invisible.
 */
const REVEAL_BOOTSTRAP = `(function(){try{var d=document.documentElement;
if(!matchMedia('(min-width:1024px)').matches)return;
if(!matchMedia('(prefers-reduced-motion: no-preference)').matches)return;
d.dataset.reveal='on';
setTimeout(function(){if(!('revealReady' in d.dataset))d.removeAttribute('data-reveal')},2500)}catch(e){}})()`;

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
      <body>
        <script dangerouslySetInnerHTML={{ __html: REVEAL_BOOTSTRAP }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_SCHEMA) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_SCHEMA) }}
        />
        {children}
        <RevealObserver />
      </body>
    </html>
  );
}
