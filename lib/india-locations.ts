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
  doorNo?: string;
  building?: string;
  street?: string;
  locality?: string;
  /** Combined precise line when structured fields are merged. */
  addressLine?: string;
  pincode?: string;
  formatted?: string;
};

type OsmAddress = Record<string, string>;

type BdcAdmin = { name?: string; description?: string; order?: number; adminLevel?: number };

type BigDataCloudReverse = {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  postcode?: string;
  localityInfo?: { administrative?: BdcAdmin[]; informative?: BdcAdmin[] };
};

type NominatimReverse = { display_name?: string; address?: OsmAddress };

type PhotonFeature = {
  properties?: Record<string, string>;
  geometry?: { coordinates?: [number, number] };
};

type PhotonReverse = { features?: PhotonFeature[] };

const POI_SNAP_MAX_METERS = 250;

/** Find the closest matching official state/UT name from free-form text. */
export function matchIndianState(raw?: string): string | undefined {
  if (!raw) return undefined;
  const needle = raw.trim().toLowerCase();
  if (!needle) return undefined;
  return INDIAN_STATES.find(
    (s) => s.toLowerCase() === needle || needle.includes(s.toLowerCase()),
  );
}

function sameText(a?: string, b?: string): boolean {
  return a?.trim().toLowerCase() === b?.trim().toLowerCase();
}

function uniqueParts(parts: (string | undefined)[], separator = ", "): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    const value = raw?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out.join(separator);
}

/** Join address segments and drop repeated comma-separated parts (case-insensitive). */
export function dedupeAddressParts(...segments: (string | undefined)[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const segment of segments) {
    if (!segment?.trim()) continue;
    for (const part of segment.split(/,\s*/)) {
      const value = part.trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
  }
  return out.join(", ");
}

function localityRemainder(
  addressLine: string,
  doorNo?: string,
  building?: string,
  street?: string,
): string {
  const consumed = new Set<string>();
  for (const segment of [doorNo, building, street]) {
    if (!segment?.trim()) continue;
    for (const part of segment.split(/,\s*/)) {
      const value = part.trim().toLowerCase();
      if (value) consumed.add(value);
    }
  }
  return addressLine
    .split(/,\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !consumed.has(part.toLowerCase()))
    .join(", ");
}

function resolveCity(a: OsmAddress, bdc?: BigDataCloudReverse): string {
  return (
    a.city ||
    a.town ||
    a.village ||
    a.municipality ||
    a.city_district ||
    a.county ||
    bdc?.city ||
    bdc?.locality ||
    ""
  ).trim();
}

function isAdminNoise(part: string, city: string, state: string, stateDistrict?: string): boolean {
  const p = part.trim();
  const pl = p.toLowerCase();
  if (!p) return true;
  if (pl === city.toLowerCase() || pl === state.toLowerCase()) return true;
  if (stateDistrict && sameText(part, stateDistrict)) return true;
  if (pl === "india") return true;
  if (/^\d{6}$/.test(p)) return true;
  if (/ mandal$/i.test(p)) return true;
  if (/ district$/i.test(p) && !/city district$/i.test(p)) return true;
  if (/^greater .+ municipal corporation/i.test(p)) return true;
  if (/^hyderabad metropolitan region$/i.test(p)) return true;
  return false;
}

/** Pull display_name parts before city/state/pincode admin noise. */
function parseDisplayNameParts(
  displayName: string,
  city: string,
  state: string,
  pincode: string,
  stateDistrict?: string,
): string[] {
  const parts = displayName
    .replace(/,\s*India\s*$/i, "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const keep: string[] = [];
  for (const part of parts) {
    if (isAdminNoise(part, city, state, stateDistrict)) continue;
    if (pincode && part === pincode) continue;
    if (state && sameText(part, state)) continue;
    keep.push(part);
  }
  return keep;
}

const DOOR_RE =
  /^\d+[a-zA-Z/-]?$|^(shop|flat|unit|door|plot|#|office|gate|floor)\s?.+/i;
const STREET_RE =
  /\b(road|street|lane|marg|way|avenue|highway|path|boulevard|drive|ring road|enclave road| rd\.?| st\.?)\b/i;
const BUILDING_RE =
  /\b(apartment|apartments|tower|towers|complex|heights|fountain head|fountain|plaza|mall|techno park|private limited|pvt\.?\s*ltd|works|bhavan|residency)\b/i;

/** Split comma-separated place parts into door / building / street / locality. */
function splitDisplayPartsIntoFields(parts: string[]): {
  doorNo: string;
  building: string;
  street: string;
  locality: string;
} {
  const rest = [...parts];
  let doorNo = "";
  let building = "";
  let street = "";

  if (rest[0] && DOOR_RE.test(rest[0])) {
    doorNo = rest.shift()!;
  }

  const streetIdx = rest.findIndex((part) => STREET_RE.test(part));
  if (streetIdx >= 0) {
    street = rest.splice(streetIdx, 1)[0]!;
  }

  if (doorNo && rest.length && /^\d/.test(doorNo)) {
    const candidate = rest[0];
    if (candidate && !STREET_RE.test(candidate)) {
      building = rest.shift()!;
    }
  } else {
    const buildingIdx = rest.findIndex((part) => BUILDING_RE.test(part));
    if (buildingIdx >= 0) {
      building = rest.splice(buildingIdx, 1)[0]!;
    }
  }

  return { doorNo, building, street, locality: rest.join(", ") };
}

function mergeField(...values: (string | undefined)[]): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** OSM sometimes packs door, building, and block into house_number. */
function parseCompoundHouseNumber(raw?: string): {
  doorNo: string;
  building: string;
  extra: string;
} {
  const text = raw?.trim() ?? "";
  if (!text) return { doorNo: "", building: "", extra: "" };
  if (!text.includes(",")) {
    return DOOR_RE.test(text) ? { doorNo: text, building: "", extra: "" } : { doorNo: "", building: text, extra: "" };
  }
  const parts = text.split(/,\s*/).map((p) => p.trim()).filter(Boolean);
  let doorNo = "";
  if (parts[0] && DOOR_RE.test(parts[0])) {
    doorNo = parts.shift()!;
  }
  return { doorNo, building: parts[0] ?? "", extra: parts.slice(1).join(", ") };
}

function isCoarseResult(
  a: OsmAddress,
  doorNo: string,
  building: string,
  street: string,
): boolean {
  if (doorNo || building || street || a.road || a.house_number) return false;
  return Boolean(a.neighbourhood || a.suburb || a.quarter || a.residential);
}

function osmPlaceFields(a: OsmAddress): { localityExtra: string } {
  return {
    localityExtra: uniqueParts([a.office, a.commercial, a.shop, a.amenity, a.industrial, a.quarter]),
  };
}

function isCompanyName(value: string): boolean {
  return /\b(private limited|pvt\.?\s*ltd|limited|llp|inc\.?)\b/i.test(value);
}

function buildAddressLineFromOsm(a: OsmAddress): string {
  const unit = uniqueParts([a.house_number, a.house_name], " ");
  const building = a.building && !sameText(a.building, a.house_name) ? a.building : undefined;
  const street = a.road || a.pedestrian || a.footway || a.cycleway || a.path;
  const locality = uniqueParts([
    a.neighbourhood,
    a.suburb,
    a.quarter,
    a.residential,
    a.commercial,
    a.industrial,
    a.hamlet,
  ]);
  return uniqueParts([unit, building, street, locality]);
}

function buildAddressLineFromBdc(bdc: BigDataCloudReverse): string {
  const admin = [...(bdc.localityInfo?.administrative ?? [])].sort(
    (a, b) => (b.order ?? 0) - (a.order ?? 0),
  );
  const wardish = admin
    .filter((item) => (item.order ?? 0) >= 13 && item.name?.trim())
    .map((item) => item.name!.trim());
  return uniqueParts([bdc.locality, ...wardish]);
}

function pickBestAddressLine(
  osm: OsmAddress,
  bdc: BigDataCloudReverse | undefined,
  displayName?: string,
  city?: string,
  state?: string,
  pincode?: string,
  stateDistrict?: string,
): string {
  const fromOsm = buildAddressLineFromOsm(osm);
  const fromBdc = bdc ? buildAddressLineFromBdc(bdc) : "";
  const fromDisplay =
    displayName && city && state
      ? parseDisplayNameParts(displayName, city, state, pincode ?? "", stateDistrict).join(", ")
      : "";

  const candidates = [fromDisplay, fromOsm, fromBdc].filter(Boolean);
  candidates.sort((a, b) => b.split(", ").length - a.split(", ").length);
  let line = candidates[0] ?? "";

  if (line.split(", ").length < 2) {
    line = uniqueParts([line, ...candidates.slice(1)]);
  }
  return line;
}

function formatFullAddress(parts: {
  addressLine?: string;
  city?: string;
  state?: string;
  pincode?: string;
}): string {
  return uniqueParts([parts.addressLine, parts.city, parts.state, parts.pincode]);
}

async function fetchNominatim(lat: number, lon: number): Promise<NominatimReverse> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1&zoom=18`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Ruxstar/1.0 (business onboarding; contact@ruxstar.com)",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error("Could not detect your location.");
  return (await res.json()) as NominatimReverse;
}

async function fetchPhotonReverse(lat: number, lon: number): Promise<PhotonReverse | null> {
  try {
    const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    return (await res.json()) as PhotonReverse;
  } catch {
    return null;
  }
}

function nearestPhotonCoords(
  photon: PhotonReverse | null,
  lat: number,
  lon: number,
): { lat: number; lon: number; distance: number } | null {
  const feature = photon?.features?.[0];
  const coords = feature?.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [featureLon, featureLat] = coords;
  const distance = haversineMeters(lat, lon, featureLat, featureLon);
  if (distance > POI_SNAP_MAX_METERS) return null;
  return { lat: featureLat, lon: featureLon, distance };
}

function buildFromOsmAddress(
  osmResult: NominatimReverse,
  city: string,
  state: string,
  pincode: string,
): {
  doorNo: string;
  building: string;
  street: string;
  locality: string;
  addressLine: string;
} {
  const a = osmResult.address ?? {};
  const displayParts = osmResult.display_name
    ? parseDisplayNameParts(osmResult.display_name, city, state, pincode, a.state_district)
    : [];

  const parsed = splitDisplayPartsIntoFields(displayParts);
  const compound = parseCompoundHouseNumber(a.house_number);
  const place = osmPlaceFields(a);

  const doorNo = mergeField(compound.doorNo, parsed.doorNo);
  const building = mergeField(
    compound.building,
    a.house_name && !sameText(a.house_name, doorNo) ? a.house_name : undefined,
    a.building && !sameText(a.building, doorNo) && !sameText(a.building, compound.building)
      ? a.building
      : undefined,
    parsed.building && !isCompanyName(parsed.building) ? parsed.building : undefined,
  );
  const street = mergeField(
    a.road,
    a.pedestrian,
    a.footway,
    a.cycleway,
    a.path,
    parsed.street,
  );

  const locality = dedupeAddressParts(
    compound.extra,
    localityRemainder(parsed.locality, doorNo, building, street),
    parsed.building && isCompanyName(parsed.building) ? parsed.building : undefined,
    a.neighbourhood,
    a.suburb,
    place.localityExtra,
  );

  const addressLine = dedupeAddressParts(doorNo, building, street, locality);

  return { doorNo, building, street, locality, addressLine };
}

async function fetchBigDataCloud(lat: number, lon: number): Promise<BigDataCloudReverse | null> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    return (await res.json()) as BigDataCloudReverse;
  } catch {
    return null;
  }
}

/** Server-side: merge OpenStreetMap + Photon POI snap + BigDataCloud. */
export async function resolveLocationFromProviders(
  lat: number,
  lon: number,
): Promise<ResolvedLocation> {
  const [initialOsm, photon, bdc] = await Promise.all([
    fetchNominatim(lat, lon),
    fetchPhotonReverse(lat, lon),
    fetchBigDataCloud(lat, lon),
  ]);

  let osmResult = initialOsm;
  const initialA = initialOsm.address ?? {};
  let city = resolveCity(initialA, bdc ?? undefined);
  let state =
    matchIndianState(initialA.state ?? bdc?.principalSubdivision) ??
    initialA.state ??
    bdc?.principalSubdivision;
  let pincode = (initialA.postcode || bdc?.postcode || "").trim();

  let fields = buildFromOsmAddress(osmResult, city, state, pincode);

  // Wi‑Fi / laptop GPS often lands on the street — snap to the nearest building POI.
  const snap = nearestPhotonCoords(photon, lat, lon);
  if (snap) {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    try {
      const refined = await fetchNominatim(snap.lat, snap.lon);
      const refinedA = refined.address ?? {};
      city = resolveCity(refinedA, bdc ?? undefined) || city;
      state = matchIndianState(refinedA.state ?? state) ?? refinedA.state ?? state;
      pincode = (refinedA.postcode || pincode || bdc?.postcode || "").trim();
      osmResult = refined;
      fields = buildFromOsmAddress(refined, city, state, pincode);
    } catch {
      // Keep the coarse GPS result if the refined lookup is rate-limited.
    }
  }

  const preciseLine =
    dedupeAddressParts(fields.doorNo, fields.building, fields.street, fields.locality) ||
    fields.addressLine;
  const formatted = dedupeAddressParts(preciseLine, city, state, pincode);

  return {
    state,
    city,
    doorNo: fields.doorNo || undefined,
    building: fields.building || undefined,
    street: fields.street || undefined,
    locality: fields.locality || undefined,
    addressLine: preciseLine,
    pincode: pincode || undefined,
    formatted,
  };
}

/** Client-side: call our API route so Nominatim works reliably. */
export async function reverseGeocode(lat: number, lon: number): Promise<ResolvedLocation> {
  const res = await fetch(
    `/api/geocode/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Could not detect your location.");
  }
  return (await res.json()) as ResolvedLocation;
}
