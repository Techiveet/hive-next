// app/layout.tsx

import "./globals.css";

import { ConnectionPopup } from "@/components/offline/connection-popup";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { getBrandForRequest } from "@/lib/brand-server";
import { startBackupScheduler } from "@/lib/backup-scheduler";

// ✅ Online/Offline popup (Sonner-based)


/* -------------------------
   Metadata
-------------------------- */
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandForRequest();
  const appTitle = brand?.titleText?.trim() || "Hive";

  return {
    title: {
      default: appTitle,
      template: `%s | ${appTitle}`,
    },
    icons: {
      icon: [
        { url: "/icon", rel: "icon", type: "image/png" },
        { url: "/icon", rel: "shortcut icon", type: "image/png" },
      ],
    },
    manifest: "/manifest.json",
  };
}

/* -------------------------
   Server-only init (prod)
-------------------------- */
if (process.env.NODE_ENV === "production") {
  startBackupScheduler();
}

/* -------------------------
   Root Layout
-------------------------- */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          {/* ✅ Beautiful online/offline popup (toast-style) */}
          <ConnectionPopup />

          {children}

          {/* ✅ Global toast portal */}
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