import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GardenGuard Monitor - Durian Report",
  description: "Garden monitoring and reporting system for tracking plant health, watering, and issues across multiple gardens.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
