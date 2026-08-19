import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WP Pro | Email Outreach & AI Integration Sender",
  description: "Personalized cold outreach app for WP Pro selling AI Business Integration, Web Site Design, SEO, and Paid Ads.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-wppro-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
