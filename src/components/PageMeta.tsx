import { useEffect } from "react";
import { siteLinks } from "../content/siteLinks";

export default function PageMeta({ title, description }: { title: string; description: string }) {
  useEffect(() => {
    document.title = title;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.append(meta);
    }
    meta.content = description;

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = new URL(window.location.pathname, siteLinks.site).href;
  }, [description, title]);
  return null;
}
