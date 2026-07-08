"use client";

import { NotificationsList } from "@/components/notifications-list";
import { vendorNotificationHref } from "@/lib/notification-links";

export default function VendorNotificationsPage() {
  return <NotificationsList getHref={vendorNotificationHref} />;
}
