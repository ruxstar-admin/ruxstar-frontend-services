import useSWR, { mutate as globalMutate } from "swr";
import {
  fetchAllAdminVendorKyc,
  getBusinessCatalog,
  getCustomerProfile,
  getPrintCatalog,
  getRuxstarCard,
  getVendorKycStatus,
  listAdminCategories,
  listAdminTypes,
  listAdminUsers,
  listBusinesses,
  listCustomerBookings,
  listMyEventRegistrations,
  listMyPrintOrders,
  listPrintShops,
  listNotifications,
  listPublicBusinesses,
  listPublicEvents,
  listVendorBookings,
  listVendorEvents,
  listVendorPrintOrders,
  type AdminCatalogCategory,
  type AdminCatalogType,
  type AdminUser,
  type AdminVendorKycRow,
  type AppNotification,
  type Business,
  type BusinessCatalog,
  type CustomerBooking,
  type CustomerProfile,
  type EventRegistration,
  type NotificationsResult,
  type PrintCategory,
  type PrintOrder,
  type PrintShop,
  type PublicBusinessSummary,
  type RuxEvent,
  type RuxstarCardData,
  type VendorBooking,
  type VendorKycStatus,
  type VendorPrintOrders,
} from "@/lib/api";

/** Shared polling options — pauses when tab is hidden, avoids focus bursts. */
export function pollOpts(intervalMs: number) {
  return {
    refreshInterval: () => (typeof document !== "undefined" && document.hidden ? 0 : intervalMs),
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshWhenHidden: false,
    keepPreviousData: true,
  } as const;
}

/**
 * Print-on-demand polling options — fast + revalidates on focus.
 * Focus revalidation is essential so status updates land instantly when the
 * customer returns from the payment gateway or switches back to the tab.
 */
export function podPollOpts(intervalMs = 8_000) {
  return {
    refreshInterval: () => (typeof document !== "undefined" && document.hidden ? 0 : intervalMs),
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshWhenHidden: false,
    keepPreviousData: true,
    dedupingInterval: 2_000,
  } as const;
}

export const swrKeys = {
  catalog: "swr/catalog/business",
  businesses: "swr/vendor/businesses",
  kyc: "swr/vendor/kyc/status",
  ruxstarCard: "swr/vendor/card",
  customerBookings: "swr/user/bookings",
  customerProfile: "swr/user/profile",
  publicBusinesses: "swr/public/businesses",
  vendorBookings: "swr/vendor/bookings",
  publicEvents: "swr/public/events",
  vendorEvents: "swr/vendor/events",
  myEventRegistrations: "swr/user/event-registrations",
  adminKyc: "swr/admin/kyc",
  adminStaff: "swr/admin/staff",
  adminCatalog: "swr/admin/catalog",
  printCatalog: "swr/catalog/print",
  myPrintOrders: "swr/pod/orders",
  vendorPrintOrders: "swr/pod/vendor/orders",
  notifications: "swr/notifications",
} as const;

export function invalidateBusinesses() {
  return globalMutate(swrKeys.businesses);
}

export function invalidatePublicBusinesses() {
  return globalMutate(swrKeys.publicBusinesses);
}

export function invalidateCustomerBookings() {
  return globalMutate(swrKeys.customerBookings);
}

export function invalidateKyc() {
  return globalMutate(swrKeys.kyc);
}

export function useBusinessCatalog() {
  return useSWR<BusinessCatalog>(swrKeys.catalog, getBusinessCatalog, {
    revalidateIfStale: false,
  });
}

export function useVendorBusinesses(enabled = true) {
  return useSWR<Business[]>(enabled ? swrKeys.businesses : null, listBusinesses);
}

export function useVendorKyc() {
  return useSWR<VendorKycStatus>(swrKeys.kyc, getVendorKycStatus);
}

export function useRuxstarCard(enabled = true) {
  return useSWR<RuxstarCardData>(enabled ? swrKeys.ruxstarCard : null, getRuxstarCard, {
    revalidateIfStale: false,
  });
}

export function usePublicBusinesses(enabled = true) {
  return useSWR<PublicBusinessSummary[]>(
    enabled ? swrKeys.publicBusinesses : null,
    listPublicBusinesses,
  );
}

export function useCustomerBookings(enabled = true) {
  return useSWR<CustomerBooking[]>(
    enabled ? swrKeys.customerBookings : null,
    listCustomerBookings,
  );
}

export function useCustomerProfile(enabled = true) {
  return useSWR<CustomerProfile>(enabled ? swrKeys.customerProfile : null, getCustomerProfile);
}

export function useVendorBookings(enabled = true) {
  return useSWR<VendorBooking[]>(
    enabled ? swrKeys.vendorBookings : null,
    () => listVendorBookings(),
    pollOpts(45_000),
  );
}

export function usePublicEvents(enabled = true) {
  return useSWR<RuxEvent[]>(enabled ? swrKeys.publicEvents : null, listPublicEvents);
}

export function useVendorEvents(enabled = true) {
  return useSWR<RuxEvent[]>(enabled ? swrKeys.vendorEvents : null, listVendorEvents);
}

export function useMyEventRegistrations(enabled = true) {
  return useSWR<EventRegistration[]>(
    enabled ? swrKeys.myEventRegistrations : null,
    listMyEventRegistrations,
  );
}

export function invalidateVendorEvents() {
  return globalMutate(swrKeys.vendorEvents);
}

export function invalidateMyEventRegistrations() {
  return globalMutate(swrKeys.myEventRegistrations);
}

/* --------------------------------- Admin --------------------------------- */

export function useAdminVendorKyc(enabled = true) {
  return useSWR<AdminVendorKycRow[]>(
    enabled ? swrKeys.adminKyc : null,
    fetchAllAdminVendorKyc,
    { revalidateOnFocus: true, keepPreviousData: true },
  );
}

export function invalidateAdminKyc() {
  return globalMutate(swrKeys.adminKyc);
}

export function useAdminStaff(enabled = true) {
  return useSWR<AdminUser[]>(enabled ? swrKeys.adminStaff : null, async () => {
    const [admins, employees] = await Promise.all([
      listAdminUsers("admin"),
      listAdminUsers("employee"),
    ]);
    const byId = new Map<string, AdminUser>();
    for (const u of [...admins, ...employees]) {
      byId.set(u._id ?? u.id ?? u.mobile ?? crypto.randomUUID(), u);
    }
    return [...byId.values()];
  });
}

export function invalidateAdminStaff() {
  return globalMutate(swrKeys.adminStaff);
}

export type AdminCatalog = {
  categories: AdminCatalogCategory[];
  types: AdminCatalogType[];
};

export function useAdminCatalog(enabled = true) {
  return useSWR<AdminCatalog>(
    enabled ? swrKeys.adminCatalog : null,
    async () => {
      const [categories, types] = await Promise.all([
        listAdminCategories(),
        listAdminTypes(),
      ]);
      return { categories, types };
    },
    { keepPreviousData: true },
  );
}

export function invalidateAdminCatalog() {
  return globalMutate(swrKeys.adminCatalog);
}

/* --------------------------- Print on demand --------------------------- */

export function usePrintCatalog(enabled = true) {
  return useSWR<PrintCategory[]>(enabled ? swrKeys.printCatalog : null, getPrintCatalog, {
    revalidateIfStale: false,
  });
}

// Passing an empty city returns every live shop for the category (all areas),
// so the customer UI can fall back to "all shops" instead of blocking.
export function useAvailablePrintShops(categoryId: string | null, city: string, enabled = true) {
  const ready = enabled && !!categoryId;
  return useSWR<PrintShop[]>(
    ready ? ["pod-shops", categoryId, city.trim().toLowerCase()] : null,
    () => listPrintShops(categoryId as string, city),
    { keepPreviousData: true, revalidateOnFocus: true },
  );
}

export function useMyPrintOrders(enabled = true) {
  return useSWR<PrintOrder[]>(enabled ? swrKeys.myPrintOrders : null, listMyPrintOrders, podPollOpts(15_000));
}

export function invalidateMyPrintOrders() {
  return globalMutate(swrKeys.myPrintOrders);
}

export function useVendorPrintOrders(enabled = true) {
  return useSWR<VendorPrintOrders>(
    enabled ? swrKeys.vendorPrintOrders : null,
    listVendorPrintOrders,
    podPollOpts(15_000),
  );
}

export function invalidateVendorPrintOrders() {
  return globalMutate(swrKeys.vendorPrintOrders);
}

/* ----------------------------- Notifications ---------------------------- */

export function useNotifications(enabled = true) {
  return useSWR<NotificationsResult>(
    enabled ? swrKeys.notifications : null,
    listNotifications,
    pollOpts(30_000),
  );
}

export function invalidateNotifications() {
  return globalMutate(swrKeys.notifications);
}

export type { AppNotification };
