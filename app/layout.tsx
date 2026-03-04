import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const poppins = localFont({
  variable: "--font-poppins",
  display: "swap",
  src: [
    { path: "../public/fonts/Poppins-Thin.ttf", weight: "100", style: "normal" },
    {
      path: "../public/fonts/Poppins-ThinItalic.ttf",
      weight: "100",
      style: "italic",
    },
    {
      path: "../public/fonts/Poppins-ExtraLight.ttf",
      weight: "200",
      style: "normal",
    },
    {
      path: "../public/fonts/Poppins-ExtraLightItalic.ttf",
      weight: "200",
      style: "italic",
    },
    { path: "../public/fonts/Poppins-Light.ttf", weight: "300", style: "normal" },
    {
      path: "../public/fonts/Poppins-LightItalic.ttf",
      weight: "300",
      style: "italic",
    },
    {
      path: "../public/fonts/Poppins-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    { path: "../public/fonts/Poppins-Italic.ttf", weight: "400", style: "italic" },
    {
      path: "../public/fonts/Poppins-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/Poppins-MediumItalic.ttf",
      weight: "500",
      style: "italic",
    },
    {
      path: "../public/fonts/Poppins-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/fonts/Poppins-SemiBoldItalic.ttf",
      weight: "600",
      style: "italic",
    },
    { path: "../public/fonts/Poppins-Bold.ttf", weight: "700", style: "normal" },
    {
      path: "../public/fonts/Poppins-BoldItalic.ttf",
      weight: "700",
      style: "italic",
    },
    {
      path: "../public/fonts/Poppins-ExtraBold.ttf",
      weight: "800",
      style: "normal",
    },
    {
      path: "../public/fonts/Poppins-ExtraBoldItalic.ttf",
      weight: "800",
      style: "italic",
    },
    {
      path: "../public/fonts/Poppins-Black.ttf",
      weight: "900",
      style: "normal",
    },
    {
      path: "../public/fonts/Poppins-BlackItalic.ttf",
      weight: "900",
      style: "italic",
    },
  ],
});

const helvetica = localFont({
  variable: "--font-helvetica",
  display: "swap",
  src: [
    { path: "../public/fonts/Helvetica.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/Helvetica-Oblique.ttf", weight: "400", style: "italic" },
    { path: "../public/fonts/Helvetica-Bold.ttf", weight: "700", style: "normal" },
    {
      path: "../public/fonts/Helvetica-BoldOblique.ttf",
      weight: "700",
      style: "italic",
    },
  ],
});

export const metadata: Metadata = {
  title: "AVHatco Designer",
  description: "A polished product customization experience.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} ${helvetica.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
