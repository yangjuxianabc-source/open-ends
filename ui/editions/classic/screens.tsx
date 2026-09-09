import { TodayPage } from "@/features/tasks/components/TodayPage";
import { SparkPage } from "@/features/spark/components/SparkPage";
import { MonthPage } from "@/features/calendar/components/MonthPage";
import { OpenPage } from "@/features/open-items/components/OpenPage";
import { ReviewPage } from "@/features/reviews/components/ReviewPage";
import { ReadingPage } from "@/features/reading/components/ReadingPage";
import { MediaPage } from "@/features/media/components/MediaPage";
import { SettingsPage } from "@/features/user-settings/components/SettingsPage";
import { SparkCaptureShell } from "@/features/desktop-shell/components/SparkCaptureShell";
import { TodoPanel } from "@/features/desktop-shell/components/TodoPanel";
export function ClassicTodayScreen() { return <TodayPage />; }
export function ClassicSparkScreen() { return <SparkPage />; }
export function ClassicMonthScreen() { return <MonthPage />; }
export function ClassicOpenScreen() { return <OpenPage />; }
export function ClassicReviewScreen() { return <ReviewPage />; }
export function ClassicReadingScreen() { return <ReadingPage />; }
export function ClassicMediaScreen() { return <MediaPage />; }
export function ClassicSettingsScreen() { return <SettingsPage />; }
export function ClassicTodoPanel() { return <TodoPanel />; }
export function ClassicSparkCapture() { return <SparkCaptureShell />; }
