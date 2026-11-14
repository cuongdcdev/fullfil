export function rankBrands<T extends { brand_name: string }>(brands: T[], query: string): T[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return brands;
  const ranked = brands.flatMap((brand, index) => {
    const name = brand.brand_name.toLocaleLowerCase();
    const rank = name === needle ? 0 : name.startsWith(needle) ? 1
      : name.split(/[^\p{L}\p{N}]+/u).some((word) => word.startsWith(needle)) ? 2
        : name.includes(needle) ? 3 : -1;
    return rank < 0 ? [] : [{ brand, index, rank }];
  });
  return ranked.sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((item) => item.brand);
}
