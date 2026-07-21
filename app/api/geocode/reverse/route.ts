import { resolveLocationFromProviders } from "@/lib/india-locations";

export const dynamic = "force-dynamic";

/** Server-side reverse geocode (Nominatim blocks most browser calls). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json({ error: "lat and lon are required" }, { status: 400 });
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return Response.json({ error: "invalid coordinates" }, { status: 400 });
  }

  try {
    const location = await resolveLocationFromProviders(lat, lon);
    return Response.json(location);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not detect location";
    return Response.json({ error: message }, { status: 502 });
  }
}
