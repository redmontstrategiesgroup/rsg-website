import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ChatWidget } from "@/components/ChatWidget";
import { SmoothScroll } from "@/components/SmoothScroll";
import { CookieConsent } from "@/components/CookieConsent";
import { EmailCapture } from "@/components/EmailCapture";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SmoothScroll />
      <Navbar />
      {children}
      <Footer />
      <ChatWidget />
      <CookieConsent />
      <EmailCapture />
      <AnalyticsTracker />
    </>
  );
}
