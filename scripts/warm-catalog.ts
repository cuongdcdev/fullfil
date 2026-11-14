/** Warm the live shop cache through the public API. Usage: pnpm tsx scripts/warm-catalog.ts https://your-host */
export {};
const base = process.argv[2];
if (!base || !/^https?:\/\//.test(base)) {
  throw new Error("Pass the shop server URL, for example https://your-host");
}

const headers = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};
const root = new URL("/api/v3/shop/", base);
const countriesResponse = await fetch(new URL("countries", root), { headers });
if (!countriesResponse.ok) throw new Error(`Countries request failed (${countriesResponse.status})`);
const countries = await countriesResponse.json() as { code: string }[];
for (const country of countries) {
  const url = new URL("catalog", root);
  url.searchParams.set("country", country.code);
  const response = await fetch(url, { headers });
  console.log(`${country.code}: ${response.ok ? "ready" : `failed (${response.status})`}`);
  if (!response.ok) process.exitCode = 1;
}
