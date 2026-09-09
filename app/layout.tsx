import type { Metadata } from "next";
import "./globals.css";
import "@/ui/themes/graphite-amber/tokens.css";
import "@/ui/editions/classic/classic.css";
import "@/ui/editions/classic/layout/classic-page-scaffold.css";
import "@/components/desktop/desktop-titlebar.css";
import "@/components/ui/ui.css";
import "@/components/ui/confirm-dialog.css";
import "@/components/ui/star-rating.css";
import "@/features/tasks/components/tasks.css";
import "@/features/tasks/components/today.css";
import "@/features/calendar/components/calendar.css";
import "@/features/open-items/components/open.css";
import "@/features/reviews/components/reviews.css";
import "@/features/reading/components/reading.css";
import "@/features/media/components/media.css";
import "@/features/spark/components/spark.css";
import "@/features/desktop-shell/components/desktop.css";
import { StoreProvider } from "@/lib/storage/store";
import { AppearanceProvider } from "@/ui/appearance/AppearanceProvider";
import { EditionBoundary } from "@/ui/editions/EditionBoundary";

export const metadata: Metadata = {
  title: "未了 Open Ends",
  description: "把未完成的事，也记进生活里。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-edition="classic" data-theme="graphite-amber">
      <body>
        <StoreProvider>
          <AppearanceProvider>
            <EditionBoundary>{children}</EditionBoundary>
          </AppearanceProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
