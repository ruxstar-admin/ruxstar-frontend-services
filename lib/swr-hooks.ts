import useSWR, { mutate as globalMutate } from "swr";
import {
  getBusinessCatalog,
  getCustomerProfile,
  getRuxstarCard,
  getVendorKycStatus,
  listBusinesses,
  listCustomerBookings,
  listMyEventRegistrations,
  listPublicBusinesses,
  listPublicEvents,
  listVendorBookings,
  listVendorEvents,
  type Business,
  type BusinessCatalog,
  type CustomerBooking,
  type CustomerProfile,
  type EventRegistration,
  type PublicBusinessSummary,
  type RuxEvent,
  type RuxstarCardData,
  type VendorBooking,
  type VendorKycStatus,
} from "@/lib/api";

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
  return useSWR<VendorBooking[]>(enabled ? swrKeys.vendorBookings : null, () =>
    listVendorBookings(),
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
