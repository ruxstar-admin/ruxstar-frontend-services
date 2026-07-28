type CashfreeMode = "sandbox" | "production";

type CashfreeCheckout = {
  checkout: (opts: { paymentSessionId: string; redirectTarget?: string }) => Promise<void>;
};

declare global {
  interface Window {
    Cashfree?: (opts: { mode: CashfreeMode }) => CashfreeCheckout;
  }
}

const SDK_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";

let sdkLoad: Promise<void> | null = null;

function loadCashfreeSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Payments run in the browser only."));
  if (window.Cashfree) return Promise.resolve();
  if (sdkLoad) return sdkLoad;
  sdkLoad = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SDK_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Could not load payment SDK.")));
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load payment SDK."));
    document.body.appendChild(script);
  });
  return sdkLoad;
}

/** Opens Cashfree hosted checkout (redirects away from our page on pay). */
export async function openCashfreeCheckout(
  paymentSessionId: string,
  // The API reports the gateway mode as a plain string; anything other than
  // "production" falls back to sandbox below.
  mode: string = "sandbox",
): Promise<void> {
  if (!paymentSessionId) throw new Error("Missing payment session.");
  await loadCashfreeSdk();
  const factory = window.Cashfree;
  if (!factory) throw new Error("Payment SDK unavailable.");
  const cashfree = factory({ mode: mode === "production" ? "production" : "sandbox" });
  await cashfree.checkout({ paymentSessionId, redirectTarget: "_self" });
}
