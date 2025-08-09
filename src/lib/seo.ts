export function setSEO(title: string, description?: string) {
  if (typeof document === "undefined") return;

  document.title = title;

  const ensureMeta = (selector: string, attrs: Record<string, string>) => {
    let el = document.head.querySelector(selector) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement("meta");
      Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
      document.head.appendChild(el!);
    }
    return el!;
  };

  if (description) {
    let desc = document.head.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!desc) {
      desc = document.createElement("meta");
      desc.setAttribute("name", "description");
      document.head.appendChild(desc);
    }
    desc.setAttribute("content", description);

    const ogDesc = ensureMeta('meta[property="og:description"]', { property: 'og:description' });
    ogDesc.setAttribute("content", description);
  }

  const ogTitle = ensureMeta('meta[property="og:title"]', { property: 'og:title' });
  ogTitle.setAttribute("content", title);

  let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", window.location.pathname || "/");
}
