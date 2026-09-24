/** True for https URLs on Giphy's own hosts — the only GIFs chat accepts. */
export function isAllowedGiphyUrl(content: string): boolean {
  try {
    const url = new URL(content);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "giphy.com" || host === "i.giphy.com") return true;
    // media*.giphy.com (e.g. media0.giphy.com, media1.giphy.com)
    return /^media\d*\.giphy\.com$/.test(host);
  } catch {
    return false;
  }
}
