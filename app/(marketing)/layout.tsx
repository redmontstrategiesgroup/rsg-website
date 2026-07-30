import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SmoothScroll } from "@/components/SmoothScroll";
import { CookieConsent } from "@/components/CookieConsent";
import { DeferredChrome } from "@/components/DeferredChrome";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { SkipLink } from "@/components/SkipLink";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SmoothScroll />
      <SkipLink />
      <Navbar />
      {/*
        Skip-link target. tabIndex={-1} makes it programmatically focusable so
        the jump moves focus, not just scroll position — without it, the next
        Tab would return to the top of the nav in most browsers.
      */}
      <div id="main-content" tabIndex={-1} className="focus:outline-none">
        {children}
      </div>
      <Footer />
      <CookieConsent />
      {/* Chat + email prompt, loaded on demand — see DeferredChrome. */}
      <DeferredChrome />
      <AnalyticsTracker />
    </>
  );
}
