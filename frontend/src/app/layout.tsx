import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import "./globals.css";
import "@/components/common/legacy/styles/shapes-tailwind.css";
import "@/components/common/legacy/styles/shapes.css";
import { ReduxProvider } from "@/lib/redux/provider";
import { DesktopLoginsSignups } from "./_DesktopLoginsSignups";
import Link from "next/link";
import MobileMenu from "@/components/MobileMenu";
import Footer from "./_Footer";
import NavbarShadow from "./_NavbarShadow";
import ProfileUpdater from "@/components/profile/ProfileUpdater";
import { Toaster } from "@/components/ui/sonner";
import MapHeader from "@/components/MapHeader";
import Script from 'next/script';
import ScrollHeader from "@/components/ScrollHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WAYO",
  description: "WAYO",
  icons: {
    icon: process.env.NEXT_PUBLIC_LOGO_WAYO,
    apple: process.env.NEXT_PUBLIC_LOGO_WAYO,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Load FontAwesome kit early so <i className="fas fa-..."> icons render */}
        <Script
          src="https://kit.fontawesome.com/a6e6a7638e.js"
          strategy="beforeInteractive"
          crossOrigin="anonymous"
        />
        <ReduxProvider>
          <ProfileUpdater />
          <NavbarShadow />
          {/* Navigation Header */}
          <ScrollHeader className="fixed w-full z-50" hideOnScrollDown={false}>
            <nav
              className="w-full backdrop-blur-[20px] border-b border-gray-200 transition-shadow duration-500"
              id="navbar"
            >
              <div className="container mx-auto px-3 sm:px-4 lg:px-6 max-w-7xl">
                <div className="flex justify-between h-14 sm:h-16 items-center">
                  {/* Left side: Logo and navigation links */}
                  <div className="flex items-center min-w-0 flex-1">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                      <Image
                        src={process.env.NEXT_PUBLIC_LOGO_WAYO || "/favicon.png"}
                        alt="WAYO Logo"
                        width={28}
                        height={28}
                        className="sm:w-8 sm:h-8 rounded-md"
                      />
                      <span className="font-semibold text-lg sm:text-xl">WAYO</span>
                    </Link>

                    {/* Desktop Navigation Links (map-aware) */}
                    <div className="ml-3 lg:ml-6">
                      <MapHeader />
                    </div>
                  </div>

                  {/* User navigation and mobile menu */}
                  <div className="flex items-center flex-shrink-0 ml-2">
                    {/* Desktop Auth Navigation */}
                    <div className="hidden lg:block">
                      <DesktopLoginsSignups />
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="lg:hidden">
                      <MobileMenu />
                    </div>
                  </div>
                </div>
              </div>
            </nav>
          </ScrollHeader>

          <main className="pt-16">{children}</main>

          {/* Footer */}
          {/* <Footer /> */}
          <Toaster />
        </ReduxProvider>
      </body>
    </html>
  );
}
