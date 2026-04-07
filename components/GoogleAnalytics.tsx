"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

type GtagWindow = Window & {
  gtag?: (...args: unknown[]) => void;
};

/**
 * Google Analytics 4 (gtag.js). Configura `NEXT_PUBLIC_GA_MEASUREMENT_ID` (ID tipo G-XXXXXXXXXX).
 * Envía page_view en la carga inicial y en cada cambio de ruta (App Router).
 */
export function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!GA_ID || typeof window === "undefined") return;
    const gtag = (window as GtagWindow).gtag;
    if (!gtag) return;
    const qs = searchParams?.toString();
    const pagePath = qs ? `${pathname}?${qs}` : pathname;
    gtag("event", "page_view", {
      page_path: pagePath,
      page_title: document.title,
      page_location: `${window.location.origin}${pagePath}`,
    });
  }, [pathname, searchParams]);

  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { send_page_view: false });
        `}
      </Script>
    </>
  );
}
