import useSWR, { mutate as globalMutate } from "swr";
import {
  getBusinessCatalog,
  getCustomerProfile,
  getRuxstarCard,
  getVendorKycStatus,
  listBusinesses,
  listCustomerBookings,
  listPublicBusinesses,
  type Business,
  type BusinessCatalog,
  type CustomerBooking,
  type CustomerProfile,
  type PublicBusinessSummary,
  type RuxstarCardData,
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
