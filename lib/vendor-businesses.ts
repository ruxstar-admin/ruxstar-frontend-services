export type VendorBusiness = {
  id: string;
  name: string;
  category: string;
  phone: string;
  address: string;
  description: string;
  createdAt: string;
};

function storageKey(userId: string) {
  return `ruxstar_vendor_businesses_${userId}`;
}

export function loadVendorBusinesses(userId: string): VendorBusiness[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as VendorBusiness[]) : [];
  } catch {
    return [];
  }
}

export function saveVendorBusinesses(userId: string, list: VendorBusiness[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(list));
}

export const emptyBusinessForm = {
  name: "",
  category: "",
  phone: "",
  address: "",
  description: "",
};
