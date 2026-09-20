import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Taslaafa",
  description:
    "Proof that your delivery arrived, to the right person, on time.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F6F4F1",
  // No maximumScale: pinch-zoom stays available. A driver squinting at a
  // code in the sun should be able to zoom.
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
