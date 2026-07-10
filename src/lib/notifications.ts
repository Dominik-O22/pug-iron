import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import {
  planReminderOccurrences,
  reminderContent,
  type ReminderSettings
} from "../logic/reminders";

// When the app is open it already is the reminder; suppress foreground presentation.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false
  })
});

export async function hasNotificationPermission(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();

  return granted;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { granted } = await Notifications.requestPermissionsAsync();

  return granted;
}

// Overlapping syncs could cancelAll then both schedule, duplicating notifications.
let syncQueue: Promise<void> = Promise.resolve();

export function syncReminders(input: {
  settings: ReminderSettings;
  next: "A" | "B" | "P";
  trainedToday: boolean;
}): Promise<void> {
  syncQueue = syncQueue.then(() => runSync(input));

  return syncQueue;
}

async function runSync({
  settings,
  next,
  trainedToday
}: {
  settings: ReminderSettings;
  next: "A" | "B" | "P";
  trainedToday: boolean;
}): Promise<void> {
  // Reminders are best-effort; a notification API failure must never break session flow.
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    if (!settings.enabled || !(await hasNotificationPermission())) {
      return;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("reminders", {
        name: "Reminders",
        importance: Notifications.AndroidImportance.DEFAULT
      });
    }

    const content = reminderContent(next);

    for (const date of planReminderOccurrences(settings, new Date(), trainedToday)) {
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          channelId: "reminders"
        }
      });
    }
  } catch (error: unknown) {
    console.warn("Failed to sync reminders", error);
  }
}
