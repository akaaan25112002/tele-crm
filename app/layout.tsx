import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata = {
  title: "Tele CRM",
  description: "Tele CRM MVP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}