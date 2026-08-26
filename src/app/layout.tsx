import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Report Sender",
  description: "Send diagnostic report PDFs to employees over WhatsApp",
};

const clerkAppearance = {
  variables: {
    colorPrimary: "oklch(0.523 0.196 258.3)",
    colorText: "oklch(0.145 0 0)",
    colorTextSecondary: "oklch(0.556 0 0)",
    colorBackground: "oklch(1 0 0)",
    colorInputBackground: "oklch(1 0 0)",
    colorInputText: "oklch(0.145 0 0)",
    borderRadius: "0.5rem",
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  },
  elements: {
    card: "shadow-sm border border-border",
    footerAction: "hidden",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider appearance={clerkAppearance} afterSignOutUrl="/sign-in">
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </ClerkProvider>
      </body>
    </html>
  );
}
