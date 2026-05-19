import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ErrorReporter } from "@/components/ErrorReporter";
import { ToastProvider } from "@/components/Toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Assistant en communication patient — Cabinet Dr Alexis Delobaux",
  description:
    "Assistant en communication patient en temps réel pour le cabinet de chirurgie esthétique du Dr Alexis Delobaux.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={inter.variable}>
      <body>
        <ErrorReporter />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
