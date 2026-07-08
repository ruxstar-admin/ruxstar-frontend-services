"use client";

import { NotificationsList } from "@/components/notifications-list";
import { customerNotificationHref } from "@/lib/notification-links";

export default function CustomerNotificationsPage() {
  return <NotificationsList getHref={customerNotificationHref} />;
}
