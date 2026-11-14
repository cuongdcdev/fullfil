import { ShopOrderScreen } from "@/components/shop/order";

export default async function ShopOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ShopOrderScreen id={id} />;
}
