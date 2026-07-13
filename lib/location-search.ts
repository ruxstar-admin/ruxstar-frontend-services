"use client";

import { useEffect, useState } from "react";
import { INDIAN_CITIES } from "@/lib/cities";

export type PlaceSuggestion = {
  /** Stored + matched value (lowercased), e.g. "ramapuram, krishna". */
  value: string;
  /** Primary display, e.g. "Ramapuram". */
  label: string;
  /** Secondary display, e.g. "Krishna, Andhra Pradesh · 521001". */
  sublabel?: string;
};

type IndiaPostOffice = {
  Name?: string;
  District?: string;
  State?: string;
  Pincode?: string;
};

type IndiaPostResponse = {
  Status?: string;
  PostOffice?: IndiaPostOffice[] | null;
}[];

type ReverseGeocode = {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
};

/**
 * Detects the user's current city via the browser Geolocation API + a free,
 * key-less reverse-geocode. Rejects if permission is denied/unavailable so the
 * caller can silently fall back to showing all shops.
 */
export async function detectCurrentCity(): Promise<string> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Location not supported");
  }
  // Some embedded/webview browsers never fire the geolocation callback (the
  // permission prompt just hangs), so race a hard timeout as a safety net.
  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Location timed out")), 9000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timer);
        resolve(p);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  });
  const { latitude, longitude } = pos.coords;
  const res = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
  );
  if (!res.ok) throw new Error("Could not resolve location");
  const data = (await res.json()) as ReverseGeocode;
  const city = (data.city || data.locality || data.principalSubdivision || "").trim();
  if (!city) throw new Error("Could not resolve city");
  return city;
}

function curatedMatches(query: string): PlaceSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: PlaceSuggestion[] = [];
  const contains: PlaceSuggestion[] = [];
  for (const c of INDIAN_CITIES) {
    const lc = c.toLowerCase();
    if (lc.startsWith(q)) starts.push({ value: lc, label: c, sublabel: "City" });
    else if (lc.includes(q)) contains.push({ value: lc, label: c, sublabel: "City" });
  }
  return [...starts, ...contains].slice(0, 8);
}

function sameSuggestions(a: PlaceSuggestion[], b: PlaceSuggestion[]) {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item.value === b[i]?.value);
}

const apiCache = new Map<string, PlaceSuggestion[]>();

async function fetchIndiaPost(query: string, signal: AbortSignal): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const cacheKey = q.toLowerCase();
  const cached = apiCache.get(cacheKey);
  if (cached) return cached;

  const numeric = /^\d{3,6}$/.test(q);
  const url = numeric
    ? `https://api.postalpincode.in/pincode/${encodeURIComponent(q)}`
    : `https://api.postalpincode.in/postoffice/${encodeURIComponent(q)}`;

  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as IndiaPostResponse;
  const offices = data?.[0]?.PostOffice;
  if (!Array.isArray(offices)) return [];

  const seen = new Set<string>();
  const out: PlaceSuggestion[] = [];
  for (const po of offices) {
    const name = (po.Name || "").trim();
    const district = (po.District || "").trim();
    const state = (po.State || "").trim();
    if (!name) continue;
    const value = (district ? `${name}, ${district}` : name).toLowerCase();
    if (seen.has(value)) continue;
    seen.add(value);
    const bits = [district, state].filter(Boolean).join(", ");
    out.push({
      value,
      label: name,
      sublabel: [bits, po.Pincode].filter(Boolean).join(" · "),
    });
    if (out.length >= 12) break;
  }
  apiCache.set(cacheKey, out);
  return out;
}

/**
 * Debounced place search that merges curated major cities with live India Post
 * results (post offices / villages / towns). Falls back gracefully to the
 * curated list if the network/API is unavailable.
 */
export function usePlaceSearch(query: string, enabled = true) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setSuggestions((prev) => (prev.length ? [] : prev));
      setLoading(false);
      return;
    }

    const curated = curatedMatches(query);
    const q = query.trim();

    const merge = (remote: PlaceSuggestion[]) => {
      const seen = new Set(curated.map((c) => c.value));
      const merged = [...curated];
      for (const r of remote) {
        if (!seen.has(r.value)) {
          seen.add(r.value);
          merged.push(r);
        }
      }
      return merged;
    };

    const apply = (next: PlaceSuggestion[]) => {
      setSuggestions((prev) => (sameSuggestions(prev, next) ? prev : next));
    };

    if (q.length < 2) {
      apply([]);
      setLoading(false);
      return;
    }

    // Cache hit → render instantly, no debounce/network.
    const cached = apiCache.get(q.toLowerCase());
    if (cached) {
      apply(merge(cached));
      setLoading(false);
      return;
    }

    // Show curated immediately while the API is in flight.
    apply(curated);

    // Skip slow external API when curated cities already match well.
    const strongCurated = curated.filter((c) => c.label.toLowerCase().startsWith(q.toLowerCase()));
    if (strongCurated.length >= 2) {
      setLoading(false);
      return;
    }

    if (q.length < 3) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const remote = await fetchIndiaPost(q, controller.signal);
        apply(merge(remote));
      } catch {
        // Keep curated matches on error/abort.
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, enabled]);

  return { suggestions, loading };
}
