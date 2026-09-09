import type { IconSlot, ThemeIconDefinition } from "../contracts";

export const GRAPHITE_AMBER_ICONS: Record<IconSlot, ThemeIconDefinition> = {
  brand: { viewBox: "0 0 24 24", paths: ["M17 5a7 7 0 1 0 1.3 8.7", "M17 5l3-1.3M18.3 13.7l3 1.6"] },
  today: { viewBox: "0 0 24 24", paths: ["M3 11.5 12 4l9 7.5M5.5 10.5V20h13v-9.5M9.5 20v-6h5v6"] },
  spark: { viewBox: "0 0 24 24", paths: ["M12 3.5 13.9 9l5.6 1.8-5.6 1.9-1.9 5.8-1.9-5.8-5.6-1.9L10.1 9 12 3.5M19 16l.8 2.3L22 19l-2.2.7L19 22l-.8-2.3L16 19l2.2-.7L19 16"] },
  month: { viewBox: "0 0 24 24", paths: ["M3.5 5h17v15a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2zM7 3v4M17 3v4M3.5 9h17M7 13h2M11 13h2M15 13h2M7 16h2M11 16h2"] },
  monthDone: { viewBox: "0 0 24 24", paths: ["M12 3.5a8.5 8.5 0 1 0 8.5 8.5", "m7.5 12 3 3 6.5-7"] },
  monthOpen: { viewBox: "0 0 24 24", paths: ["M18.5 6.5A8.5 8.5 0 1 0 20.5 13", "M12 7v5l3 2"] },
  monthRescheduled: { viewBox: "0 0 24 24", paths: ["M5 8h11.5M14 5l3 3-3 3", "M19 16H7.5M10 13l-3 3 3 3"] },
  open: { viewBox: "0 0 24 24", paths: ["M5 7h14M5 12h10M5 17h7"] },
  review: { viewBox: "0 0 24 24", paths: ["M4 12a8 8 0 1 0 2.3-5.7L4 8.5M4 4v4.5h4.5M12 8v5l3 2"] },
  reading: { viewBox: "0 0 24 24", paths: ["M4 5.5C7 4 9.3 4 12 6v14c-2.7-2-5-2-8-.5zM20 5.5C17 4 14.7 4 12 6v14c2.7-2 5-2 8-.5z"] },
  media: { viewBox: "0 0 24 24", paths: ["M4 6.5h16v11H4zM8 6.5V4m8 2.5V4M7 21h10M9 17.5v3.5m6-3.5V21"] },
  settings: { viewBox: "0 0 24 24", paths: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.5 1a7 7 0 0 0-2-1.2L14 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.5-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.5-1a7 7 0 0 0 2 1.2L10 21h4l.4-2.6a7 7 0 0 0 2-1.2l2.5 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z"] },
  focus: { viewBox: "0 0 24 24", paths: ["m12 3 2.1 6.3 6.4 2.2-6.4 2.2L12 20l-2.1-6.3-6.4-2.2 6.4-2.2L12 3"] },
  complete: { viewBox: "0 0 24 24", paths: ["m5 12.5 4 4L19 7"] },
  restore: { viewBox: "0 0 24 24", paths: ["M5 8V4m0 0h4M5 4a8 8 0 1 1-1 10"] },
  archive: { viewBox: "0 0 24 24", paths: ["M4 7h16v13H4zM3 4h18v3H3zM9 11h6"] },
};
