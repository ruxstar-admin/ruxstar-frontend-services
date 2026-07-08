/** Curated list of major Indian cities for service-area + order location pickers. */
export const INDIAN_CITIES: string[] = [
  "Mumbai",
  "Delhi",
  "Bengaluru",
  "Hyderabad",
  "Ahmedabad",
  "Chennai",
  "Kolkata",
  "Pune",
  "Jaipur",
  "Surat",
  "Lucknow",
  "Kanpur",
  "Nagpur",
  "Indore",
  "Thane",
  "Bhopal",
  "Visakhapatnam",
  "Vijayawada",
  "Patna",
  "Vadodara",
  "Ghaziabad",
  "Ludhiana",
  "Coimbatore",
  "Agra",
  "Madurai",
  "Nashik",
  "Faridabad",
  "Meerut",
  "Rajkot",
  "Varanasi",
  "Srinagar",
  "Aurangabad",
  "Amritsar",
  "Navi Mumbai",
  "Prayagraj",
  "Ranchi",
  "Jabalpur",
  "Gwalior",
  "Jodhpur",
  "Raipur",
  "Kota",
  "Guwahati",
  "Chandigarh",
  "Mysuru",
  "Bhubaneswar",
  "Kochi",
  "Thiruvananthapuram",
  "Dehradun",
  "Noida",
  "Gurugram",
  "Warangal",
  "Guntur",
  "Nellore",
  "Tirupati",
  "Mangaluru",
  "Hubballi",
  "Belagavi",
  "Salem",
  "Tiruchirappalli",
  "Jalandhar",
  "Bhilai",
  "Cuttack",
  "Siliguri",
  "Udaipur",
  "Ajmer",
];

/** Case-insensitive city search; returns up to `limit` matches. */
export function searchCities(query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return INDIAN_CITIES.slice(0, limit);
  const starts: string[] = [];
  const contains: string[] = [];
  for (const c of INDIAN_CITIES) {
    const lc = c.toLowerCase();
    if (lc.startsWith(q)) starts.push(c);
    else if (lc.includes(q)) contains.push(c);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Title-case a stored (often lowercased) city for display. */
export function prettyCity(city: string): string {
  return city
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
