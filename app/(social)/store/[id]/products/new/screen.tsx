"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { ButtonLink } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { useStoreDesk } from "@/components/store/desk";
import { ProductForm } from "@/components/store/ProductForm";
import { newIdempotencyKey } from "@/lib/api/client";
import { createProduct, setProductPhoto, storeRules } from "@/lib/api/store";
import vendor from "@/components/vendor/vendor.module.css";

/** The owner adds a product: its words, options and variant table, and a photo. */
export function NewProductScreen({ id }: { id: string }) {
  const router = useRouter();
  const { stores, store } = useStoreDesk(id);
  const rules = useLoad(() => storeRules());
  const key = useRef(newIdempotencyKey());

  if (stores.data && !store?.owner) {
    return (
      <Empty title="Only the owner adds products">
        <p>You can change products and stock the owner lets you.</p>
        <ButtonLink href={`/store/${id}/products`} variant="secondary">
          Products
        </ButtonLink>
      </Empty>
    );
  }
  if (rules.error && !rules.data) return <Failed error={rules.error} onRetry={rules.reload} />;
  if (!rules.data || !stores.data) return <Loading rows={6} />;
  return (
    <div className={vendor.page}>
      <Back href={`/store/${id}/products`}>Products</Back>
      <h1 className={vendor.title}>Add a product</h1>
      <ProductForm
        product={null}
        rules={rules.data}
        canPhoto
        onSave={async (body, _changed, photo) => {
          const made = await createProduct(id, body, key.current);
          key.current = newIdempotencyKey();
          // The product is made; a photo that fails can be added again from its page.
          if (photo) await setProductPhoto(made.id, photo).catch(() => undefined);
          router.replace(`/store/${id}/products`);
        }}
      />
    </div>
  );
}
