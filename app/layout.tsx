import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PhotoBoothAI - AI-Powered Photo Booth on CameraOS",
  description: "Event-grade AI photobooth powered by MomentAI CameraOS. Capture, share and print with gesture recognition and local-first media preservation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
