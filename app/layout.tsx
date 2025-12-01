// app/layout.tsx
import "./globals.css";

import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { getBrandForRequest } from "@/lib/brand-server";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandForRequest();
  const appTitle = brand?.titleText?.trim() || "Hive";

  return {
    title: {
      default: appTitle,
      template: `%s | ${appTitle}`,
    },
    // 🔥 Always use /icon – the route now reads sidebarIconUrl
    icons: {
      icon: [
        { url: "/icon", rel: "icon", type: "image/png" },
        { url: "/icon", rel: "shortcut icon", type: "image/png" },
      ],
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background t`ext-foreground antialiased">
        <ThemeProvider>
          {children}

          {/* Global toast portal */}
          <Toaster
            richColors
            closeButton
            position="top-right"
            toastOptions={{
              classNames: {
                toast: "text-sm",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
