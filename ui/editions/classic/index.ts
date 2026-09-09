import type { EditionDefinition } from "../contracts";
import { ClassicShell } from "./ClassicShell";
import {
  ClassicMediaScreen,
  ClassicMonthScreen,
  ClassicOpenScreen,
  ClassicReadingScreen,
  ClassicReviewScreen,
  ClassicSettingsScreen,
  ClassicSparkCapture,
  ClassicSparkScreen,
  ClassicTodoPanel,
  ClassicTodayScreen,
} from "./screens";
import { classicNavigation } from "./ClassicNavigation";

export const classicEdition: EditionDefinition = {
  id: "classic",
  name: "Classic",
  apiVersion: 1,
  defaultThemeId: "graphite-amber",
  supportedThemeIds: ["graphite-amber"],
  homeRoute: "today",
  Shell: ClassicShell,
  screens: {
    today: ClassicTodayScreen,
    spark: ClassicSparkScreen,
    month: ClassicMonthScreen,
    open: ClassicOpenScreen,
    review: ClassicReviewScreen,
    reading: ClassicReadingScreen,
    media: ClassicMediaScreen,
    settings: ClassicSettingsScreen,
  },
  navigation: classicNavigation,
  auxiliaryRenderers: {
    todoPanel: ClassicTodoPanel,
    sparkCapture: ClassicSparkCapture,
  },
};
