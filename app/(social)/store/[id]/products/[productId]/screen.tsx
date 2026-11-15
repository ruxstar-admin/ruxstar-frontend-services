"use client";

import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { useStoreDesk } from "@/components/store/desk";
import { ProductForm } from "@/components/store/ProductForm";
import { ApiError } from "@/lib/api/client";
import {
  deleteProduct,
  deskProducts,
  deskUpdateProduct,
  removeProductPhoto,
  setProductPhoto,
  storeRules,
  vendorProduct,
  type ProductPatch,
  type VendorProduct,
} from "@/lib/api/store";
import vendor from "@/components/vendor/vendor.module.css";

/** Pages of the desk list a team member's product is looked for in; the desk has no one-product route. */
const SCAN_PAGES = 20;

/** The owner reads it from their own route; someone on the team finds it in the shop's product list. */
async function loadProduct(shopId: string, productId: string): Promise<VendorProduct> {
  try {
    return await vendorProduct(productId);
  } catch (err) {
    if (!(err instanceof ApiError && (err.status === 403 || err.status === 404))) throw err;
    let cursor: string | undefined;
    for (let page = 0; page < SCAN_PAGES; page++) {
      const { items, nextCursor } = await deskProducts(shopId, {}, cursor);
      const found = items.find((p) => p.id === productId);
      if (found) return found;
      if (!nextCursor) break;
      cursor = nextCursor;
    }
    throw err;
  }
}

/** One product for the owner and the team who may change products: the form and variant table; the photo and deleting are the owner's. */
export function EditProductScreen({ id, productId }: { id: string; productId: string }) {
  const router = useRouter();
  const { stores, store, can } = useStoreDesk(id);
  const product = useLoad(() => loadProduct(id, productId), productId);
  const rules = useLoad(() => storeRules());
  const owner = !!store?.owner;

  if (stores.data && !can("store.products")) {
    return (
      <Empty title="Not open to you">
        <p>The owner hasn’t let you change products here.</p>
        <ButtonLink href={`/store/${id}/products`} variant="secondary">
          Products
        </ButtonLink>
      </Empty>
    );
  }
  const error = product.error ?? rules.error;
  if (error && !(product.data && rules.data)) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      return (
        <Empty title="Product not found">
          <p>It may have been deleted.</p>
          <ButtonLink href={`/store/${id}/products`} variant="secondary">
            Products
          </ButtonLink>
        </Empty>
      );
    }
    return (
      <Failed
        error={error}
        onRetry={() => {
          if (product.error) product.reload();
          if (rules.error) rules.reload();
        }}
      />
    );
  }
  if (!product.data || !rules.data || !stores.data) return <Loading rows={6} />;
  const p = product.data;
  return (
    <div className={vendor.page}>
      <Back href={`/store/${id}/products`}>Products</Back>
      <h1 className={vendor.title}>{p.title}</h1>
      <ProductForm
        product={p}
        rules={rules.data}
        canPhoto={owner}
        onSave={async (body, changedTable) => {
          const words: ProductPatch = { title: body.title, description: body.description, hsn: body.hsn, gstRateBps: body.gstRateBps, status: body.status };
          await deskUpdateProduct(p.id, changedTable ? body : words);
          router.push(`/store/${id}/products`);
        }}
        onPhoto={
          owner
            ? async (file) => {
                product.setData(file ? await setProductPhoto(p.id, file) : await removeProductPhoto(p.id));
              }
            : undefined
        }
        onDelete={
          owner
            ? async () => {
                await deleteProduct(p.id);
                router.replace(`/store/${id}/products`);
              }
            : undefined
        }
      />
    </div>
  );
}
