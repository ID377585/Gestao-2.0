export function privateCacheHeaders(seconds: number) {
  const ttl = Math.max(0, Math.floor(seconds));

  if (ttl <= 0) {
    return {
      "Cache-Control": "no-store",
    };
  }

  return {
    "Cache-Control": `private, max-age=${ttl}, stale-while-revalidate=${ttl}`,
  };
}
