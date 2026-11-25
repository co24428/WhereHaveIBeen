import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "WhereHaveIBeen",
  description: "Mark where you went and where you will go.",
  appleWebApp: { capable: true, title: "WHIB", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <NextIntlClientProvider>
          <NavBar />
          <main className="flex-1 flex flex-col">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
