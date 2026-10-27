import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { TabBar } from "@/components/TabBar";
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
    { media: "(prefers-color-scheme: light)", color: "#f4f5ef" },
    { media: "(prefers-color-scheme: dark)", color: "#141a17" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} h-full antialiased`}>
      <body className="min-h-full pb-20">
        {children}
        <TabBar />
      </body>
    </html>
  );
}
