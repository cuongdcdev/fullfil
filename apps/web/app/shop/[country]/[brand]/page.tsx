import { ProductScreen } from "@/components/shop/product";
import { ShopNotFoundError, ShopUpstreamError, shopCatalog } from "@/lib/server/v3/shop";
import { notFound } from "next/navigation";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ country: string; brand: string }>;
}) {
  const { country, brand } = await params;
  let catalog: Awaited<ReturnType<typeof shopCatalog>>;
  try {
    catalog = await shopCatalog(country);
  } catch (error) {
    if (error instanceof ShopNotFoundError) notFound();
    // The client shows a plain retry action when the first catalog load fails.
    if (error instanceof ShopUpstreamError) {
      return <ProductScreen country={country} brandName={brand} />;
    }
    throw error;
  }
  const listed = catalog.categories.some((category) => category.brands.some((item) =>
    item.slug === brand || item.brand_name === brand));
  if (!listed) notFound();
  return <ProductScreen country={country} brandName={brand} />;
}
