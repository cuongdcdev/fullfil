import { CryptorefillsClient, CryptorefillsRpcError, requiredString } from "../../apps/shopper/src/cryptorefills";
import { OneClickClient } from "../../apps/shopper/src/oneclick";
import { quoteOrder } from "../../apps/shopper/src/quote";

const syntheticBeneficiary = "+84900000001";
const syntheticRecipient = "0x0000000000000000000000000000000000000001";

async function main(): Promise<void> {
  // shop.ts imports the backend SQLite store. Keep this read-only check in memory.
  process.env.DATABASE_URL = "file::memory:";
  process.env.FULFIL_MODE = "live";
  const { shopCatalog } = await import("../../apps/web/lib/server/v3/shop");
  const cryptorefills = new CryptorefillsClient();
  const catalog = await shopCatalog("VN", cryptorefills);
  const brands = catalog.categories.flatMap((category) => category.brands);
  const products = brands.flatMap((brand) => brand.products.map((product) => ({
    brand: brand.brand_name,
    denomination: product.denomination,
    cost_usdc: product.cost_usdc,
  })));
  console.log(JSON.stringify({
    country: catalog.country,
    brand_count: brands.length,
    product_count: products.length,
    sample: products.slice(0, 5),
  }));

  const delivery = {
    brand_name: "Viettel Mobile Credits",
    country_code: "VN",
    denomination: "20000 VND",
    beneficiary_account: syntheticBeneficiary,
  };
  const oneClick = new OneClickClient(fetch, "");
  try {
    const quote = await quoteOrder({
      validateOrder: async () => ({
        coin_amount: requiredString(await cryptorefills.validateOrder(delivery), "coin_amount"),
      }),
      dryQuote: (amount) => oneClick.quote({
        dry: true,
        amount,
        recipient: syntheticRecipient,
        refundTo: "nearfullfil.near",
      }),
    });
    console.log(JSON.stringify({ product: "Viettel Mobile Credits 20000 VND", quote }));
  } catch (error) {
    if (error instanceof CryptorefillsRpcError) {
      console.error(`validateOrder rejected synthetic beneficiary: ${error.detail}`);
    } else {
      console.error(`Read-only quote failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(`Read-only catalog failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
