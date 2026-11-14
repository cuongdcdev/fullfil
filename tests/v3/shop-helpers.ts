import {
  brandVariantsFromMcp,
  catalogFromBrands,
  type ShopBrand,
  type ShopBrandDetail,
  type ShopCatalog,
} from "../../apps/web/lib/server/v3/shop";

/** Variants of every listed brand, grouped by product category (test convenience). */
export function variantsByCategory(country: string, listing: unknown, groups: unknown) {
  const catalog = catalogFromBrands(country, listing);
  const categories = new Map<string, ShopBrand[]>();
  for (const listed of catalog.categories.flatMap((category) => category.brands)) {
    for (const variant of brandVariantsFromMcp(listed, groups)) {
      categories.set(variant.category, [...(categories.get(variant.category) ?? []), variant]);
    }
  }
  return {
    country,
    categories: [...categories].map(([category, brands]) => ({ category, brands })),
  };
}

/** A `brand` dependency for shopQuote/shopEstimate that serves the given variants. */
export function brandFn(country: string, legacy: { categories: { brands: ShopBrand[] }[] }) {
  return async (_country: string, slugOrName: string): Promise<ShopBrandDetail> => {
    const variants = legacy.categories.flatMap((category) => category.brands)
      .filter((item) => item.slug === slugOrName || item.brand_name === slugOrName);
    const first = variants[0];
    return {
      country, slug: first?.slug ?? slugOrName, brand_name: first?.brand_name ?? slugOrName,
      logo_url: first?.logo_url ?? "", category: first?.category ?? "", variants,
    };
  };
}

export function listingsOf(catalog: ShopCatalog) {
  return catalog.categories.flatMap((category) => category.brands);
}
