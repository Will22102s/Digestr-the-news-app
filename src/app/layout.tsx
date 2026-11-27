import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Digestr — AI & Cybersecurity, edited for you",
    template: "%s · Digestr",
  },
  description:
    "A minimalist daily reader for artificial intelligence and cybersecurity. Browse live headlines or generate one calm, cited briefing.",
  applicationName: "Digestr",
  authors: [{ name: "Digestr" }],
  keywords: [
    "AI news",
    "cybersecurity news",
    "RSS reader",
    "AI briefing",
    "daily digest",
  ],
  openGraph: {
    title: "Digestr",
    description:
      "One calm, cited briefing for AI and cybersecurity — or browse the live feed.",
    type: "website",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#111215",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-obsidian text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
