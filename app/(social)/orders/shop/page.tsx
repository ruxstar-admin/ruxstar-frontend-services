import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ order?: string }> };

/** The checkout page sends the customer back here with `?order=<id>`. */
export default async function ShopOrdersReturn({ searchParams }: Props) {
  const { order } = await searchParams;
  if (order && /^[a-f\d]{24}$/i.test(order)) redirect(`/orders/shop/${order}?fresh=1`);
  redirect("/orders?tab=shops");
}
