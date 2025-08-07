import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "../hooks/use-language";
import { ThemeProvider } from "../components/theme-provider";

export const metadata: Metadata = {
  title: "Point Estimation Tool",
  description: "A collaborative planning poker tool for agile teams",
  generator: "v0.dev",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
