/** Indian states and union territories — used by the business address picker. */
export const INDIAN_STATES: string[] = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

export type ResolvedLocation = {
  state?: string;
  city?: string;
  area?: string;
};

/** Find the closest matching official state/UT name from free-form text. */
export function matchIndianState(raw?: string): string | undefined {
  if (!raw) return undefined;
  const needle = raw.trim().toLowerCase();
  if (!needle) return undefined;
  return INDIAN_STATES.find(
    (s) => s.toLowerCase() === needle || needle.includes(s.toLowerCase()),
  );
}

/** Reverse-geocode coordinates to state/city/area via OpenStreetMap (no API key). */
export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<ResolvedLocation> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Could not detect your location.");
  const data = (await res.json()) as { address?: Record<string, string> };
  const a = data.address ?? {};
  const city = a.city || a.town || a.village || a.municipality || a.county || "";
  const area = a.suburb || a.neighbourhood || a.road || a.hamlet || "";
  return {
    state: matchIndianState(a.state) ?? a.state,
    city,
    area,
  };
}
