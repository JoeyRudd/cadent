import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
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
};

export const viewport: Viewport = {
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
      <body className="min-h-full pb-20">
        {children}
        <TabBar />
      </body>
    </html>
  );
}
