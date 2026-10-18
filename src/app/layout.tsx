import type { Metadata } from "next";
import { AuroraBackground } from "@/components/aurora-background";
import { AuthModal } from "@/components/auth-modal";
import { CommandPalette } from "@/components/command-palette";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { Providers } from "@/components/providers";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { NO_FLASH_THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "GenifySuite — dev utilities for building and testing software",
  description:
    "Card validation, test data, and dev utilities: password, UUID, QR, JSON, color, and IP tools in one toolbox.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-ink font-body text-paper">
        <Providers>
          <AuroraBackground />
          <div className="relative flex min-h-screen flex-col">
            <Navbar />
            <VerifyEmailBanner />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <CommandPalette />
          <AuthModal />
        </Providers>
      </body>
    </html>
  );
}
