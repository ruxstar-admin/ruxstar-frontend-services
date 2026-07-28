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
  listAdminUsersPaged,
  getAdminUserDetail,
  getAdminMetrics,
  getAdminRevenue,
  listAdminBusinesses,
  listAdminBookings,
  listAdminEvents,
  listAdminEventRegistrations,
  listAdminPrintOrders,
  listAdminPayments,
  listAdminWithdrawals,
  listAdminTickets,
  getAdminUserActivity,
  listMyTickets,
  getVendorLedger,
  listBusinesses,
  listCustomerBookings,
  listMyEventRegistrations,
  listMyPrintOrders,
  listPrintShops,
  listNotifications,
  listPublicBusinesses,
  listPublicEvents,
  listPublicCreatorOffers,
  listMyCreatorBookings,
  listVendorCreatorBookings,
  listVendorCreatorOffers,
  listVendorBookings,
  listVendorEvents,
  listVendorPrintOrders,
  type AdminCatalogCategory,
  type AdminCatalogType,
  type AdminUser,
  type AdminVendorKycRow,
  type AdminListParams,
  type AdminPage,
  type AdminMetrics,
  type AdminUserDetail,
  type AdminBusiness,
  type AdminBooking,
  type AdminEvent,
  type AdminEventRegistration,
  type AdminPrintOrder,
  type AdminPayment,
  type Withdrawal,
  type AdminRevenue,
  type AdminUserActivity,
  type SupportRole,
  type SupportTicket,
  type VendorLedger,
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
  type CreatorOffer,
  type CreatorBooking,
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
  publicCreatorOffers: "swr/public/creator-offers",
  vendorEvents: "swr/vendor/events",
  myEventRegistrations: "swr/user/event-registrations",
  adminKyc: "swr/admin/kyc",
  adminStaff: "swr/admin/staff",
  adminCatalog: "swr/admin/catalog",
  adminMetrics: "swr/admin/metrics",
  adminRevenue: "swr/admin/revenue",
  adminUsers: "swr/admin/users",
  adminUserDetail: "swr/admin/user",
  adminBusinesses: "swr/admin/businesses",
  adminBookings: "swr/admin/bookings",
  adminEvents: "swr/admin/events",
  adminRegistrations: "swr/admin/registrations",
  adminPrintOrders: "swr/admin/print-orders",
  adminPayments: "swr/admin/payments",
  adminWithdrawals: "swr/admin/withdrawals",
  adminTickets: "swr/admin/support-tickets",
  adminUserActivity: "swr/admin/user-activity",
  customerTickets: "swr/user/support-tickets",
  vendorTickets: "swr/vendor/support-tickets",
  vendorLedger: "swr/vendor/ledger",
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

export function useVendorKyc(enabled = true) {
  return useSWR<VendorKycStatus>(enabled ? swrKeys.kyc : null, getVendorKycStatus);
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

export function usePublicCreatorOffers(enabled = true) {
  return useSWR<CreatorOffer[]>(
    enabled ? swrKeys.publicCreatorOffers : null,
    listPublicCreatorOffers,
  );
}

export function useMyCreatorBookings(enabled = true) {
  return useSWR<CreatorBooking[]>(
    enabled ? "swr/my/creator-bookings" : null,
    listMyCreatorBookings,
  );
}

export function invalidateMyCreatorBookings() {
  return globalMutate("swr/my/creator-bookings");
}

export function useVendorCreatorBookings(enabled = true, businessId?: string) {
  const key = businessId
    ? `swr/vendor/creator-bookings/${businessId}`
    : "swr/vendor/creator-bookings";
  return useSWR<CreatorBooking[]>(
    enabled ? key : null,
    () => listVendorCreatorBookings(businessId),
    pollOpts(45_000),
  );
}

export function invalidateVendorCreatorBookings() {
  return globalMutate(
    (k) => typeof k === "string" && k.startsWith("swr/vendor/creator-bookings"),
    undefined,
    { revalidate: true },
  );
}

export function useVendorCreatorOffers(enabled = true, businessId?: string) {
  const key = businessId
    ? `swr/vendor/creator-offers/${businessId}`
    : "swr/vendor/creator-offers";
  return useSWR<CreatorOffer[]>(enabled ? key : null, () => listVendorCreatorOffers(businessId));
}

export function invalidateVendorCreatorOffers() {
  return globalMutate(
    (k) => typeof k === "string" && k.startsWith("swr/vendor/creator-offers"),
    undefined,
    { revalidate: true },
  );
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

/* ----------------------- Admin super portal (data) ---------------------- */

// Revalidate every SWR key that starts with the given prefix (all param variants).
function invalidatePrefix(prefix: string) {
  return globalMutate(
    (key) =>
      key === prefix ||
      (Array.isArray(key) && typeof key[0] === "string" && key[0].startsWith(prefix)),
    undefined,
    { revalidate: true },
  );
}

export function useAdminMetrics(enabled = true) {
  return useSWR<AdminMetrics>(enabled ? swrKeys.adminMetrics : null, getAdminMetrics, pollOpts(60_000));
}

export function useAdminRevenue(days = 30, enabled = true) {
  return useSWR<AdminRevenue>(
    enabled ? [swrKeys.adminRevenue, days] : null,
    () => getAdminRevenue(days),
    pollOpts(60_000),
  );
}

export function useAdminUsersList(params: AdminListParams, enabled = true) {
  return useSWR<AdminPage<AdminUser>>(
    enabled ? [swrKeys.adminUsers, JSON.stringify(params)] : null,
    () => listAdminUsersPaged(params),
    { keepPreviousData: true },
  );
}

export function useAdminUserDetail(id: string | null, enabled = true) {
  return useSWR<AdminUserDetail>(
    enabled && id ? [swrKeys.adminUserDetail, id] : null,
    () => getAdminUserDetail(id as string),
    { keepPreviousData: true },
  );
}

export function useAdminBusinesses(params: AdminListParams, enabled = true) {
  return useSWR<AdminPage<AdminBusiness>>(
    enabled ? [swrKeys.adminBusinesses, JSON.stringify(params)] : null,
    () => listAdminBusinesses(params),
    { keepPreviousData: true },
  );
}

export function useAdminBookings(params: AdminListParams, enabled = true) {
  return useSWR<AdminPage<AdminBooking>>(
    enabled ? [swrKeys.adminBookings, JSON.stringify(params)] : null,
    () => listAdminBookings(params),
    { keepPreviousData: true },
  );
}

export function useAdminEvents(params: AdminListParams, enabled = true) {
  return useSWR<AdminPage<AdminEvent>>(
    enabled ? [swrKeys.adminEvents, JSON.stringify(params)] : null,
    () => listAdminEvents(params),
    { keepPreviousData: true },
  );
}

export function useAdminEventRegistrations(params: AdminListParams, enabled = true) {
  return useSWR<AdminPage<AdminEventRegistration>>(
    enabled ? [swrKeys.adminRegistrations, JSON.stringify(params)] : null,
    () => listAdminEventRegistrations(params),
    { keepPreviousData: true },
  );
}

export function useAdminPrintOrders(params: AdminListParams, enabled = true) {
  return useSWR<AdminPage<AdminPrintOrder>>(
    enabled ? [swrKeys.adminPrintOrders, JSON.stringify(params)] : null,
    () => listAdminPrintOrders(params),
    { keepPreviousData: true },
  );
}

export function useAdminPayments(params: AdminListParams, enabled = true) {
  return useSWR<AdminPage<AdminPayment>>(
    enabled ? [swrKeys.adminPayments, JSON.stringify(params)] : null,
    () => listAdminPayments(params),
    { keepPreviousData: true },
  );
}

export function invalidateAdminUsers() {
  return Promise.all([invalidatePrefix(swrKeys.adminUsers), invalidatePrefix(swrKeys.adminUserDetail)]);
}
export function invalidateAdminBusinesses() {
  return invalidatePrefix(swrKeys.adminBusinesses);
}
export function invalidateAdminBookings() {
  return invalidatePrefix(swrKeys.adminBookings);
}
export function invalidateAdminEvents() {
  return invalidatePrefix(swrKeys.adminEvents);
}
export function invalidateAdminPrintOrders() {
  return invalidatePrefix(swrKeys.adminPrintOrders);
}
export function invalidateAdminPayments() {
  return invalidatePrefix(swrKeys.adminPayments);
}

export function useAdminWithdrawals(
  params?: { status?: string; vendorId?: string; page?: number; limit?: number },
  enabled = true,
) {
  return useSWR<{ items: Withdrawal[]; total: number }>(
    enabled ? [swrKeys.adminWithdrawals, JSON.stringify(params ?? {})] : null,
    () => listAdminWithdrawals(params),
    { keepPreviousData: true, revalidateOnFocus: true },
  );
}
export function invalidateAdminWithdrawals() {
  return invalidatePrefix(swrKeys.adminWithdrawals);
}

export function useAdminTickets(params: AdminListParams, enabled = true) {
  return useSWR<AdminPage<SupportTicket>>(
    enabled ? [swrKeys.adminTickets, JSON.stringify(params)] : null,
    () => listAdminTickets(params),
    { keepPreviousData: true, revalidateOnFocus: true },
  );
}
export function invalidateAdminTickets() {
  return invalidatePrefix(swrKeys.adminTickets);
}

export function useAdminUserActivity(id: string | null, enabled = true) {
  return useSWR<AdminUserActivity>(
    enabled && id ? [swrKeys.adminUserActivity, id] : null,
    () => getAdminUserActivity(id as string),
    { keepPreviousData: true },
  );
}

/* ----------------------------- Support tickets -------------------------- */

export function useMyTickets(role: SupportRole, enabled = true) {
  const key = role === "vendor" ? swrKeys.vendorTickets : swrKeys.customerTickets;
  return useSWR<SupportTicket[]>(
    enabled ? key : null,
    () => listMyTickets(role),
    { revalidateOnFocus: true, keepPreviousData: true },
  );
}
export function invalidateMyTickets(role: SupportRole) {
  return globalMutate(role === "vendor" ? swrKeys.vendorTickets : swrKeys.customerTickets);
}

/* --------------------------- Vendor payment ledger ---------------------- */

export function useVendorLedger(enabled = true) {
  return useSWR<VendorLedger>(
    enabled ? swrKeys.vendorLedger : null,
    getVendorLedger,
    pollOpts(45_000),
  );
}
export function invalidateVendorLedger() {
  return globalMutate(swrKeys.vendorLedger);
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
