import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Watch Store",
    template: "%s | Watch Store",
  },
  description: "Premium watches, Pakistan-wide.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Skip link — visually hidden until focused, standard
            accessibility pattern for keyboard users to bypass
            repeated header/nav content. Target #main-content must
            exist on every page that uses this layout. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[var(--color-gold)] focus:px-4 focus:py-2 focus:text-[var(--color-bg)]"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
