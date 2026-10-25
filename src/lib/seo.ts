// Search and sharing tags for the public pages of the app (welcome, log in, sign up).
// The app lives at https://app.kashopay.com; the showcase site is https://kashopay.com.
const APP_ORIGIN = "https://app.kashopay.com";
const SITE_ORIGIN = "https://kashopay.com";

export function publicPageHead(opts: { title: string; description: string; path: string }) {
  const url = `${APP_ORIGIN}${opts.path}`;
  return {
    meta: [
      { title: opts.title },
      { name: "description", content: opts.description },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { property: "og:site_name", content: "Kasho Pay" },
      { property: "og:locale", content: "fr_HT" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: opts.title },
      { property: "og:description", content: opts.description },
      { property: "og:url", content: url },
      { property: "og:image", content: `${SITE_ORIGIN}/img/og.jpg` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: opts.title },
      { name: "twitter:description", content: opts.description },
      { name: "twitter:image", content: `${SITE_ORIGIN}/img/og.jpg` },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

/** Pages that must never be indexed (account, reset link, etc.). */
export const noIndexMeta = [{ name: "robots", content: "noindex, nofollow" }];
