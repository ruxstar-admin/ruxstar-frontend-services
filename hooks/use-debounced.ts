import { useEffect, useState } from "react";

// Returns a debounced copy of `value` that only updates after `delay` ms of
// no changes. Handy for search inputs feeding server-side queries.
export default function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
