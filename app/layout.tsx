// app/layout.tsx
import "./globals.css";

import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { getBrandForRequest } from "@/lib/brand-server";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandForRequest();
  const appTitle = brand?.titleText?.trim() || "Hive";

  return {
    title: {
      default: appTitle,
      template: `%s | ${appTitle}`,
    },
    icons: brand?.faviconUrl
      ? {
          icon: [
            { url: brand.faviconUrl, rel: "icon" },
            { url: brand.faviconUrl, rel: "shortcut icon" },
          ],
        }
      : undefined,
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
