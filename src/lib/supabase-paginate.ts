// Pagination .range() pour contourner la limite Supabase (1000 lignes/query).
// Usage : const rows = await fetchAll(supabase.from("availabilities").select("user_id, avail_date, slot").gte("avail_date", a).lte("avail_date", b));
export async function fetchAll<T = any>(builder: any, batch = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += batch) {
    const { data, error } = await builder.range(from, from + batch - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < batch) break;
  }
  return out;
}
