import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { Suspense } from "react";

import { OfflineBanner } from "@/components/OfflineBanner";
import { RefreshOnReturn } from "@/components/RefreshOnReturn";
import { TabBar } from "@/components/TabBar";
import { APPLY_SAVED_THEME, BAR_COLORS } from "@/lib/theme";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cadent",
  description: "Today's run, this week against the plan, and a safety check on the plan.",
  // Installed to the home screen it opens full screen, with the status bar left as the system draws it.
  appleWebApp: { capable: true, title: "Cadent", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BAR_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: BAR_COLORS.dark },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the inline script may set data-theme before React hydrates.
    <html lang="en" className={`${figtree.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPLY_SAVED_THEME }} />
      </head>
      <body className="min-h-full pb-tabbar">
        <Suspense>
          <RefreshOnReturn />
        </Suspense>
        <OfflineBanner />
        {children}
        <TabBar />
      </body>
    </html>
  );
}
