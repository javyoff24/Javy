export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  domain: string;
};

const cache = new Map<string, { expiresAt: number; results: WebSearchResult[] }>();
const CACHE_TTL = 3 * 60 * 1000;
const MAX_CACHE = 100;

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function cleanText(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim();
}

function unwrapUrl(href: string): string | null {
  try {
    const parsed = new URL(decodeHtml(href), "https://duckduckgo.com");
    if (parsed.hostname.endsWith("duckduckgo.com") && parsed.pathname.startsWith("/l/")) {
      const target = parsed.searchParams.get("uddg");
      if (target) return unwrapUrl(target);
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (parsed.hostname.endsWith("duckduckgo.com")) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function parseResults(html: string, limit: number): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  const seen = new Set<string>();
  const blocks = html.match(/<div\b[^>]*class=["'][^"']*\bresult\b[^"']*["'][^>]*>[\s\S]*?(?=<div\b[^>]*class=["'][^"']*\bresult\b|$)/gi) || [];

  for (const block of blocks) {
    const linkMatch = block.match(/<a\b(?=[^>]*class=["'][^"']*\bresult__a\b)[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;
    const url = unwrapUrl(linkMatch[1]);
    const title = cleanText(linkMatch[2]);
    if (!url || !title || seen.has(url)) continue;

    const snippetMatch = block.match(/<(?:a|div|span)\b[^>]*class=["'][^"']*\bresult__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div|span)>/i);
    const snippet = snippetMatch ? cleanText(snippetMatch[1]) : "";
    let domain = "";
    try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch {}
    results.push({ title, url, snippet, domain });
    seen.add(url);
    if (results.length >= limit) break;
  }
  return results;
}

export function shouldSearchWeb(message: string): boolean {
  return /eng\s+so['’ʻʻ]?nggi|so['’ʻʻ]?nggi|oxirgi|yangilik|bugun|hozir|joriy|real[ -]?time|latest|breaking|today|current|recent|this week|right now|news|weather|ob[ -]?havo|valyuta|kursi?|exchange rate|stock price|narxi|narxlar|internetdan qidir|internetda top|web search|search the web/i.test(message);
}

export async function searchWeb(query: string, limit = 7): Promise<WebSearchResult[]> {
  const normalized = query.trim().replace(/\s+/g, " ").slice(0, 350);
  if (!normalized) return [];
  const key = normalized.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.results;
  if (cached) cache.delete(key);

  const recent = /latest|breaking|today|current|recent|news|eng\s+so['’ʻ]?nggi|so['’ʻ]?nggi|oxirgi|yangilik|bugun|hozir/i.test(normalized);
  const params = new URLSearchParams({ q: normalized, kl: "us-en" });
  if (recent) params.set("df", "w");

  const response = await fetch("https://html.duckduckgo.com/html/?" + params.toString(), {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9,uz;q=0.8",
    },
    signal: AbortSignal.timeout(9000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("DuckDuckGo HTTP " + response.status);
  const html = await response.text();
  const results = parseResults(html, Math.min(Math.max(limit, 1), 10));
  if (results.length) {
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL, results });
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value as string);
  }
  return results;
}
