/* AI Visibility Scorecard — Pro Report ($9).
   Turns the twenty ticks from the free scorecard into a fix plan written for one
   platform, a saved baseline, and a dated reminder to run the scorecard again.
   Everything is derived from the buyer's own ticks, in their own browser. */
(function () {
  "use strict";

  var JB = window.JB;
  if (!JB || !JB.pro) return;
  var esc = JB.pro.escapeHtml;

  var SITE = "https://yoursite.com";

  var PLATFORMS = {
    "next":      { label: "Next.js (App Router)",     note: "Paths are from your project root. Anything in public/ is served from the site root, so public/robots.txt becomes /robots.txt." },
    "wordpress": { label: "WordPress",                note: "PHP goes in your child theme's functions.php — never the parent theme, an update overwrites it. Root files go beside wp-config.php." },
    "shopify":   { label: "Shopify",                  note: "Theme code lives under Online Store → Themes → ⋯ → Edit code. Duplicate the theme before you edit it so you can roll back in one click." },
    "static":    { label: "Plain HTML / static host", note: "Root files sit beside index.html. Netlify, Vercel, Cloudflare Pages and S3 all serve them as-is after a redeploy." }
  };

  var SECTION_NAMES = ["Access & discovery", "Machine-readable context", "Content clarity", "Technical delivery", "Identity & corroboration"];

  /* Search/index agents are distinct from training crawlers and user-triggered
     fetchers. This starting point removes accidental access blocks only when
     that matches the publisher's policy; it does not promise retrieval. */
  var SEARCH_AGENTS = [
    "OAI-SearchBot",
    "Claude-SearchBot",
    "PerplexityBot"
  ];

  function aiRobotsBlock() {
    return "# AI search/index agents — review against your publisher policy\n" +
      SEARCH_AGENTS.map(function (a) { return "User-agent: " + a + "\nAllow: /"; }).join("\n\n") +
      "\n\n# Training crawlers and user-triggered fetchers are separate policy choices.";
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function isoDate(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  /* ============================================================
     reading the free scorecard
     ============================================================ */

  function sectionName(v) {
    if (typeof v === "number") return SECTION_NAMES[v] || ("Section " + (v + 1));
    return String(v || "");
  }

  /* Fallback used when the page has not exposed window.JBScorecard — reads the
     same .check-row markup the free tool renders, so the report still builds. */
  function domSnapshot() {
    var host = document.getElementById("checks");
    if (!host) return null;
    var rows = Array.prototype.slice.call(host.querySelectorAll(".check-row"));
    if (!rows.length) return null;

    var sections = SECTION_NAMES.map(function (n) {
      return { name: n, checked: 0, count: 0, raw: 0, max: 0 };
    });
    var missing = [], passed = [], raw = 0, max = 0, checked = 0;

    rows.forEach(function (row) {
      var input = row.querySelector("input");
      var w = parseFloat(row.getAttribute("data-w")) || 0;
      var si = parseInt(row.getAttribute("data-sec"), 10) || 0;
      var sec = sections[si] || sections[0];
      sec.count += 1; sec.max += w; max += w;
      var item = {
        id: input ? input.getAttribute("data-id") : "",
        weight: w,
        section: sec.name,
        fix: row.getAttribute("data-fix") || ""
      };
      if (input && input.checked) {
        sec.checked += 1; sec.raw += w; raw += w; checked += 1;
        passed.push(item);
      } else {
        missing.push(item);
      }
    });

    missing.sort(function (a, b) { return b.weight - a.weight; });
    return {
      score: max ? Math.round(raw / max * 100) : 0,
      checkedCount: checked,
      total: rows.length,
      sections: sections,
      missing: missing,
      passed: passed
    };
  }

  function snapshot() {
    var api = window.JBScorecard;
    if (api) {
      if (Object.prototype.toString.call(api.SECTION_NAMES) === "[object Array]" && api.SECTION_NAMES.length) {
        SECTION_NAMES = api.SECTION_NAMES;
      }
      if (typeof api.snapshot === "function") {
        try {
          var s = api.snapshot();
          if (s && s.sections && s.missing && s.passed) {
            s.missing.forEach(function (m) { m.section = sectionName(m.section); });
            s.passed.forEach(function (p) { p.section = sectionName(p.section); });
            if (!s.total) s.total = s.missing.length + s.passed.length;
            return s;
          }
        } catch (e) { /* fall through to reading the page directly */ }
      }
    }
    return domSnapshot();
  }

  function gradeFor(score) {
    var api = window.JBScorecard;
    if (api && typeof api.gradeFor === "function") {
      try {
        var g = api.gradeFor(score);
        if (g && g.label) return g;
      } catch (e) { /* fall through */ }
    }
    if (score < 40) return { label: "Needs foundations" };
    if (score < 65) return { label: "Developing" };
    if (score < 85) return { label: "Prepared" };
    return { label: "Strong foundation" };
  }

  function maxRawOf(snap) {
    return snap.sections.reduce(function (n, s) { return n + (s.max || 0); }, 0);
  }

  /* ============================================================
     the fix library — one entry per check id in the free scorecard

     code[platform] is a real, working snippet. Where a check has no code fix
     (a content task or an off-site task) `offsite` says so plainly and the
     steps carry the concrete action instead. Nothing is faked to fill a slot.
     `effort` breaks ties in the ordering: 1 = paste a file today,
     2 = writing you do yourself, 3 = work that depends on other people.
     ============================================================ */

  var ORG_JSON =
    "{\n" +
    '  "@context": "https://schema.org",\n' +
    '  "@type": "LocalBusiness",\n' +
    '  "name": "Your Business LLC",\n' +
    '  "url": "' + SITE + '",\n' +
    '  "logo": "' + SITE + '/logo.png",\n' +
    '  "email": "hello@yoursite.com",\n' +
    '  "telephone": "+1-555-000-0000",\n' +
    '  "address": {\n' +
    '    "@type": "PostalAddress",\n' +
    '    "streetAddress": "123 Main St, Suite 4",\n' +
    '    "addressLocality": "Portland",\n' +
    '    "addressRegion": "OR",\n' +
    '    "postalCode": "97201",\n' +
    '    "addressCountry": "US"\n' +
    "  },\n" +
    '  "sameAs": [\n' +
    '    "https://www.linkedin.com/company/your-business",\n' +
    '    "https://www.instagram.com/yourbusiness"\n' +
    "  ]\n" +
    "}";

  var FIXES = {

    /* ---------- 1 · Access & discovery ---------- */

    robots: {
      title: "robots.txt reflects your crawler policy",
      why: "robots.txt communicates crawl preferences to compliant agents. Access remains a publisher choice and does not guarantee crawling, indexing, ranking, or citation.",
      verify: "curl -s " + SITE + "/robots.txt",
      effort: 1,
      steps: [
        "If a robots.txt already exists, merge these blocks into it — do not replace the file, you may already have rules that matter.",
        "Publish allow rules only when they match your policy. Training crawlers and user-triggered fetchers are separate choices from search/index agents.",
        "Keep the Sitemap: line pointing at a sitemap that actually loads.",
        "Load the file in a private window afterwards. If it downloads instead of displaying, your host is sending the wrong content type — ask them for text/plain."
      ],
      code: {
        next: {
          label: "public/robots.txt",
          text: "User-agent: *\nAllow: /\n\n" + aiRobotsBlock() + "\n\nSitemap: " + SITE + "/sitemap.xml\n\n" +
            "# Note: if you also have app/robots.ts, Next.js serves that instead and\n" +
            "# this file is ignored. Pick one."
        },
        wordpress: {
          label: "wp-content/themes/your-child-theme/functions.php",
          text: "<?php\n" +
            "/**\n" +
            " * Appends AI-crawler rules to the robots.txt WordPress generates.\n" +
            " * This filter only runs when there is NO physical robots.txt file at the\n" +
            " * site root. If you have uploaded one, edit that file instead.\n" +
            " */\n" +
            "add_filter( 'robots_txt', function ( $output ) {\n" +
            "\t$agents = array(\n" +
            "\t\t'" + SEARCH_AGENTS.join("',\n\t\t'") + "',\n" +
            "\t);\n\n" +
            "\t$output .= \"\\n# AI search/index agents — review against your publisher policy\\n\";\n" +
            "\tforeach ( $agents as $agent ) {\n" +
            "\t\t$output .= \"User-agent: {$agent}\\nAllow: /\\n\\n\";\n" +
            "\t}\n" +
            "\t$output .= 'Sitemap: ' . home_url( '/wp-sitemap.xml' ) . \"\\n\";\n\n" +
            "\treturn $output;\n" +
            "}, 10, 1 );"
        },
        shopify: {
          label: "Templates → Add a new template → robots.txt  (creates templates/robots.txt.liquid)",
          text: "{% for group in robots.default_groups %}\n" +
            "  {{- group.user_agent }}\n" +
            "  {%- for rule in group.rules -%}\n" +
            "    {{ rule }}\n" +
            "  {%- endfor -%}\n" +
            "  {%- if group.sitemap != blank -%}\n" +
            "    {{ group.sitemap }}\n" +
            "  {%- endif %}\n" +
            "{% endfor %}\n\n" +
            aiRobotsBlock()
        },
        "static": {
          label: "robots.txt  (beside index.html)",
          text: "User-agent: *\nAllow: /\n\n" + aiRobotsBlock() + "\n\nSitemap: " + SITE + "/sitemap.xml\n"
        }
      }
    },

    sitemap: {
      title: "sitemap.xml exists and is linked",
      why: "A sitemap gives supported crawlers a current URL inventory and can improve discovery efficiency. Inclusion still does not guarantee crawling, indexing, ranking, or citation.",
      verify: "open " + SITE + "/sitemap.xml — every URL in it should load",
      effort: 1,
      steps: [
        "List only pages you want found. Drop tag archives, thin pages, and anything set to noindex.",
        "Add the matching Sitemap: line to robots.txt.",
        "Submit the sitemap once in Google Search Console so you get told when a URL fails."
      ],
      code: {
        next: {
          label: "app/sitemap.ts  (served at /sitemap.xml)",
          text: "import type { MetadataRoute } from \"next\";\n\n" +
            "const base = \"" + SITE + "\";\n\n" +
            "export default function sitemap(): MetadataRoute.Sitemap {\n" +
            "  return [\n" +
            "    { url: `${base}/`,         lastModified: new Date(), changeFrequency: \"weekly\",  priority: 1 },\n" +
            "    { url: `${base}/about`,    lastModified: new Date(), changeFrequency: \"monthly\", priority: 0.8 },\n" +
            "    { url: `${base}/services`, lastModified: new Date(), changeFrequency: \"monthly\", priority: 0.8 },\n" +
            "    { url: `${base}/contact`,  lastModified: new Date(), changeFrequency: \"yearly\",  priority: 0.5 },\n" +
            "  ];\n" +
            "}"
        },
        wordpress: {
          label: "robots.txt line — WordPress 5.5+ already publishes /wp-sitemap.xml",
          text: "Sitemap: " + SITE + "/wp-sitemap.xml\n\n" +
            "# If Yoast or Rank Math is active they replace the core sitemap with\n" +
            "# /sitemap_index.xml — point the line at whichever one actually loads."
        },
        shopify: {
          label: "No code needed — Shopify generates /sitemap.xml for you",
          text: "# Confirm it loads and is not blocked:\n" +
            "curl -s " + SITE + "/sitemap.xml | head -20\n\n" +
            "# If it 404s, the store is still password-protected, or the pages are not\n" +
            "# published to the Online Store sales channel. Fix that, not the file."
        },
        "static": {
          label: "sitemap.xml  (beside index.html)",
          text: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
            "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n" +
            "  <url><loc>" + SITE + "/</loc><lastmod>" + isoDate(new Date()) + "</lastmod></url>\n" +
            "  <url><loc>" + SITE + "/about/</loc><lastmod>" + isoDate(new Date()) + "</lastmod></url>\n" +
            "  <url><loc>" + SITE + "/services/</loc><lastmod>" + isoDate(new Date()) + "</lastmod></url>\n" +
            "  <url><loc>" + SITE + "/contact/</loc><lastmod>" + isoDate(new Date()) + "</lastmod></url>\n" +
            "</urlset>"
        }
      }
    },

    llms: {
      title: "llms.txt at your site root",
      why: "llms.txt is an open proposal for a curated site map whose support varies by provider. Google says it does not use llms.txt for search visibility or rankings, so treat it as optional context rather than a universal signal.",
      verify: "open " + SITE + "/llms.txt — it should display as plain text, not download",
      effort: 1,
      steps: [
        "Keep it short. Four to twelve links beats fifty.",
        "Use absolute URLs and verify that each one resolves to the intended public page.",
        "Keep the file accurate after a redesign, migration, or product change.",
        "The free llms.txt Generator on this site writes the file for you if you would rather not hand-write it."
      ],
      code: {
        next: { label: "public/llms.txt  (served at /llms.txt)", text: null },
        wordpress: { label: "llms.txt uploaded to the site root, beside wp-config.php", text: null },
        shopify: { label: "Content → Files (upload llms.txt), then Online Store → Navigation → URL Redirects: /llms.txt → the uploaded file URL", text: null },
        "static": { label: "llms.txt  (beside index.html)", text: null }
      },
      sharedCode:
        "# Your Business LLC\n\n" +
        "> One sentence: what you do, who you do it for, and where.\n\n" +
        "A short paragraph a stranger could read out loud and understand. No jargon,\n" +
        "no slogans, no acronyms.\n\n" +
        "## Key pages\n" +
        "- [Home](" + SITE + "/): what we do, in plain words.\n" +
        "- [About](" + SITE + "/about): who runs it and why.\n" +
        "- [Contact](" + SITE + "/contact): email, phone, and hours.\n\n" +
        "## Products & services\n" +
        "- [Service name](" + SITE + "/services/service-name): what it includes and what it costs.\n\n" +
        "## Contact\n" +
        "- [hello@yoursite.com](mailto:hello@yoursite.com)\n"
    },

    ssr: {
      title: "Text works without JavaScript",
      why: "Keeping essential content in the initial HTML improves compatibility with crawlers, assistive technology, link previews, and constrained clients without assuming every provider renders JavaScript the same way.",
      verify: "curl -s " + SITE + "/ | grep -i \"your headline\"  — no match means the text is not in the HTML",
      effort: 1,
      steps: [
        "Run the curl check above on your three most important pages, not just the home page.",
        "Anything that fails is content to move into the server-rendered HTML.",
        "Interactive extras — a booking widget, a map, a gallery — can stay client-side. It is the words that have to be in the source."
      ],
      code: {
        next: {
          label: "app/page.tsx — keep copy in Server Components",
          text: "// No \"use client\" at the top of this file, so everything here is rendered\n" +
            "// on the server and lands in the HTML before any JavaScript runs.\n" +
            "import InteractiveGallery from \"./interactive-gallery\"; // this child is the client one\n\n" +
            "export default function Home() {\n" +
            "  return (\n" +
            "    <main>\n" +
            "      <h1>What you do, in one line a stranger understands</h1>\n" +
            "      <p>Who it is for, where you work, and what it costs.</p>\n" +
            "      <InteractiveGallery />\n" +
            "    </main>\n" +
            "  );\n" +
            "}"
        }
      },
      platformNotes: {
        wordpress: "WordPress renders on the server by default. The usual culprits are page-builder blocks, JS sliders, and \"animate on scroll\" wrappers that ship an empty container. Run the curl check to find them.",
        shopify: "Liquid renders on the server. The usual culprits are app-injected sections — review widgets, upsell blocks — that load their text over JavaScript afterwards.",
        "static": "A static page already passes unless you are templating with JavaScript on the client. If your pages are assembled by a JS framework at runtime, pre-render them at build time instead."
      }
    },

    /* ---------- 2 · Structured data ---------- */

    org: {
      title: "Organization schema on the homepage",
      why: "Organization structured data declares explicit identity fields in a machine-readable form. It can support eligible search features, but it is a hint rather than proof of identity, trust, ranking, or citation.",
      verify: "view-source on your home page and search for \"@type\":\"LocalBusiness\", then run the URL through search.google.com/test/rich-results",
      effort: 1,
      steps: [
        "Use LocalBusiness if you have a physical address or serve an area; use Organization if you do not.",
        "Every value must match what a visitor can see on the page. Schema that contradicts the page is worse than no schema.",
        "One Organization block per site, on the home page. Repeating it on every page adds nothing."
      ],
      code: {
        next: {
          label: "app/layout.tsx",
          text: "const org = " + ORG_JSON + ";\n\n" +
            "export default function RootLayout({ children }: { children: React.ReactNode }) {\n" +
            "  return (\n" +
            "    <html lang=\"en\">\n" +
            "      <body>\n" +
            "        <script\n" +
            "          type=\"application/ld+json\"\n" +
            "          dangerouslySetInnerHTML={{ __html: JSON.stringify(org).replace(/</g, '\\\\u003c') }}\n" +
            "        />\n" +
            "        {children}\n" +
            "      </body>\n" +
            "    </html>\n" +
            "  );\n" +
            "}"
        },
        wordpress: {
          label: "wp-content/themes/your-child-theme/functions.php",
          text: "<?php\n" +
            "add_action( 'wp_head', function () {\n" +
            "\tif ( ! is_front_page() ) {\n" +
            "\t\treturn;\n" +
            "\t}\n\n" +
            "\t$org = array(\n" +
            "\t\t'@context'  => 'https://schema.org',\n" +
            "\t\t'@type'     => 'LocalBusiness',\n" +
            "\t\t'name'      => get_bloginfo( 'name' ),\n" +
            "\t\t'url'       => home_url( '/' ),\n" +
            "\t\t'email'     => 'hello@yoursite.com',\n" +
            "\t\t'telephone' => '+1-555-000-0000',\n" +
            "\t\t'address'   => array(\n" +
            "\t\t\t'@type'           => 'PostalAddress',\n" +
            "\t\t\t'streetAddress'   => '123 Main St, Suite 4',\n" +
            "\t\t\t'addressLocality' => 'Portland',\n" +
            "\t\t\t'addressRegion'   => 'OR',\n" +
            "\t\t\t'postalCode'      => '97201',\n" +
            "\t\t\t'addressCountry'  => 'US',\n" +
            "\t\t),\n" +
            "\t\t'sameAs'    => array(\n" +
            "\t\t\t'https://www.linkedin.com/company/your-business',\n" +
            "\t\t),\n" +
            "\t);\n\n" +
            "\techo '<script type=\"application/ld+json\">'\n" +
            "\t\t. wp_json_encode( $org, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG )\n" +
            "\t\t. '<\/script>' . \"\\n\";\n" +
            "} );"
        },
        shopify: {
          label: "layout/theme.liquid — just before </head>",
          text: "{%- if request.page_type == 'index' -%}\n" +
            "  <script type=\"application/ld+json\">\n" +
            "  {\n" +
            "    \"@context\": \"https://schema.org\",\n" +
            "    \"@type\": \"LocalBusiness\",\n" +
            "    \"name\": {{ shop.name | json }},\n" +
            "    \"url\": {{ shop.url | json }},\n" +
            "    \"email\": {{ shop.email | json }},\n" +
            "    \"address\": {\n" +
            "      \"@type\": \"PostalAddress\",\n" +
            "      \"streetAddress\": {{ shop.address.street | json }},\n" +
            "      \"addressLocality\": {{ shop.address.city | json }},\n" +
            "      \"addressRegion\": {{ shop.address.province | json }},\n" +
            "      \"postalCode\": {{ shop.address.zip | json }},\n" +
            "      \"addressCountry\": {{ shop.address.country | json }}\n" +
            "    },\n" +
            "    \"sameAs\": [\n" +
            "      \"https://www.instagram.com/yourbusiness\"\n" +
            "    ]\n" +
            "  }\n" +
            "  <\/script>\n" +
            "{%- endif -%}"
        },
        "static": {
          label: "index.html — inside <head>",
          text: "<script type=\"application/ld+json\">\n" + ORG_JSON + "\n<\/script>"
        }
      }
    },

    offer: {
      title: "Offer / Product schema on offer pages",
      why: "Offer or Product structured data can represent eligible offer details in a machine-readable form. It does not guarantee a rich result, quotation, ranking, recommendation, or correct downstream reuse.",
      verify: "view-source on an offer page and search for \"@type\":\"Offer\", then run it through search.google.com/test/rich-results",
      effort: 1,
      steps: [
        "The price in the schema must be the price shown on the page. If you do not publish prices, leave the offers block out rather than inventing a number.",
        "One block per offer page — not one giant block on the home page.",
        "Use Product for physical goods, Service for work you perform."
      ],
      code: {
        next: {
          label: "app/services/[slug]/page.tsx",
          text: "const service = {\n" +
            "  \"@context\": \"https://schema.org\",\n" +
            "  \"@type\": \"Service\",\n" +
            "  name: \"Full-day coverage\",\n" +
            "  description: \"What is included, in the same words as the page.\",\n" +
            "  provider: { \"@type\": \"LocalBusiness\", name: \"Your Business LLC\" },\n" +
            "  areaServed: \"Portland, OR\",\n" +
            "  offers: {\n" +
            "    \"@type\": \"Offer\",\n" +
            "    price: \"2400\",\n" +
            "    priceCurrency: \"USD\",\n" +
            "    availability: \"https://schema.org/InStock\",\n" +
            "    url: \"" + SITE + "/services/full-day\",\n" +
            "  },\n" +
            "};\n\n" +
            "export default function Page() {\n" +
            "  return (\n" +
            "    <>\n" +
            "      <script\n" +
            "        type=\"application/ld+json\"\n" +
            "        dangerouslySetInnerHTML={{ __html: JSON.stringify(service).replace(/</g, '\\\\u003c') }}\n" +
            "      />\n" +
            "      {/* the page itself */}\n" +
            "    </>\n" +
            "  );\n" +
            "}"
        },
        wordpress: {
          label: "Edit the offer page → add a Custom HTML block at the bottom",
          text: "<script type=\"application/ld+json\">\n" +
            "{\n" +
            "  \"@context\": \"https://schema.org\",\n" +
            "  \"@type\": \"Service\",\n" +
            "  \"name\": \"Full-day coverage\",\n" +
            "  \"description\": \"What is included, in the same words as the page.\",\n" +
            "  \"provider\": { \"@type\": \"LocalBusiness\", \"name\": \"Your Business LLC\" },\n" +
            "  \"areaServed\": \"Portland, OR\",\n" +
            "  \"offers\": {\n" +
            "    \"@type\": \"Offer\",\n" +
            "    \"price\": \"2400\",\n" +
            "    \"priceCurrency\": \"USD\",\n" +
            "    \"availability\": \"https://schema.org/InStock\",\n" +
            "    \"url\": \"" + SITE + "/services/full-day\"\n" +
            "  }\n" +
            "}\n" +
            "<\/script>"
        },
        shopify: {
          label: "sections/main-product.liquid — Dawn and most modern themes already do this",
          text: "{%- comment -%}\n" +
            "  Check first: search the theme for `structured_data`. If it is already\n" +
            "  there, this check is a false negative — tick it and move on.\n" +
            "{%- endcomment -%}\n" +
            "<script type=\"application/ld+json\">\n" +
            "  {{ product | structured_data }}\n" +
            "<\/script>"
        },
        "static": {
          label: "The offer page — inside <head>",
          text: "<script type=\"application/ld+json\">\n" +
            "{\n" +
            "  \"@context\": \"https://schema.org\",\n" +
            "  \"@type\": \"Product\",\n" +
            "  \"name\": \"Product name\",\n" +
            "  \"description\": \"What it is, in the same words as the page.\",\n" +
            "  \"image\": \"" + SITE + "/images/product.jpg\",\n" +
            "  \"brand\": { \"@type\": \"Brand\", \"name\": \"Your Business LLC\" },\n" +
            "  \"offers\": {\n" +
            "    \"@type\": \"Offer\",\n" +
            "    \"price\": \"38.00\",\n" +
            "    \"priceCurrency\": \"USD\",\n" +
            "    \"availability\": \"https://schema.org/InStock\",\n" +
            "    \"url\": \"" + SITE + "/products/product-name\"\n" +
            "  }\n" +
            "}\n" +
            "<\/script>"
        }
      }
    },

    faqschema: {
      title: "FAQ schema with real questions",
      why: "FAQ structured data can describe visible question-and-answer content when provider guidelines allow it. It does not guarantee display, summarization, citation, or reuse.",
      verify: "view-source and search for \"FAQPage\", then run the URL through search.google.com/test/rich-results",
      effort: 1,
      steps: [
        "Every question and answer in the markup must also be visible on the page. Hidden-only FAQ markup breaks Google's guidelines and can get the page's rich results removed.",
        "Use the questions customers actually send you — pricing, turnaround, area covered, what happens if something goes wrong.",
        "Answer in full sentences. A one-word answer is not quotable."
      ],
      code: {
        next: {
          label: "app/page.tsx (or wherever the FAQ lives)",
          text: "const faq = {\n" +
            "  \"@context\": \"https://schema.org\",\n" +
            "  \"@type\": \"FAQPage\",\n" +
            "  mainEntity: [\n" +
            "    {\n" +
            "      \"@type\": \"Question\",\n" +
            "      name: \"How much does it cost?\",\n" +
            "      acceptedAnswer: { \"@type\": \"Answer\", text: \"The same answer that is printed on the page.\" },\n" +
            "    },\n" +
            "    {\n" +
            "      \"@type\": \"Question\",\n" +
            "      name: \"What areas do you cover?\",\n" +
            "      acceptedAnswer: { \"@type\": \"Answer\", text: \"The same answer that is printed on the page.\" },\n" +
            "    },\n" +
            "  ],\n" +
            "};\n\n" +
            "// render alongside the visible FAQ:\n" +
            "<script type=\"application/ld+json\" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq).replace(/</g, '\\\\u003c') }} />"
        },
        wordpress: {
          label: "Edit the FAQ page → Custom HTML block, below the visible questions",
          text: "<script type=\"application/ld+json\">\n" +
            "{\n" +
            "  \"@context\": \"https://schema.org\",\n" +
            "  \"@type\": \"FAQPage\",\n" +
            "  \"mainEntity\": [\n" +
            "    {\n" +
            "      \"@type\": \"Question\",\n" +
            "      \"name\": \"How much does it cost?\",\n" +
            "      \"acceptedAnswer\": { \"@type\": \"Answer\", \"text\": \"The same answer that is printed on the page.\" }\n" +
            "    },\n" +
            "    {\n" +
            "      \"@type\": \"Question\",\n" +
            "      \"name\": \"What areas do you cover?\",\n" +
            "      \"acceptedAnswer\": { \"@type\": \"Answer\", \"text\": \"The same answer that is printed on the page.\" }\n" +
            "    }\n" +
            "  ]\n" +
            "}\n" +
            "<\/script>"
        },
        shopify: {
          label: "templates/page.faq.liquid (or the section that renders your FAQ)",
          text: "<script type=\"application/ld+json\">\n" +
            "{\n" +
            "  \"@context\": \"https://schema.org\",\n" +
            "  \"@type\": \"FAQPage\",\n" +
            "  \"mainEntity\": [\n" +
            "    {\n" +
            "      \"@type\": \"Question\",\n" +
            "      \"name\": \"How long does shipping take?\",\n" +
            "      \"acceptedAnswer\": { \"@type\": \"Answer\", \"text\": \"The same answer that is printed on the page.\" }\n" +
            "    },\n" +
            "    {\n" +
            "      \"@type\": \"Question\",\n" +
            "      \"name\": \"What is your return policy?\",\n" +
            "      \"acceptedAnswer\": { \"@type\": \"Answer\", \"text\": \"The same answer that is printed on the page.\" }\n" +
            "    }\n" +
            "  ]\n" +
            "}\n" +
            "<\/script>"
        },
        "static": {
          label: "The FAQ page — inside <head>",
          text: "<script type=\"application/ld+json\">\n" +
            "{\n" +
            "  \"@context\": \"https://schema.org\",\n" +
            "  \"@type\": \"FAQPage\",\n" +
            "  \"mainEntity\": [\n" +
            "    {\n" +
            "      \"@type\": \"Question\",\n" +
            "      \"name\": \"How much does it cost?\",\n" +
            "      \"acceptedAnswer\": { \"@type\": \"Answer\", \"text\": \"The same answer that is printed on the page.\" }\n" +
            "    }\n" +
            "  ]\n" +
            "}\n" +
            "<\/script>"
        }
      }
    },

    person: {
      title: "Person schema for your founder",
      why: "Person structured data can declare a founder relationship and relevant profiles. It is a machine-readable hint, not independent proof that a person, organization, or profile is authentic.",
      verify: "view-source on your about page and search for \"@type\":\"Person\"",
      effort: 1,
      steps: [
        "Only list sameAs profiles that are genuinely yours and publicly reachable.",
        "Put it on the about page — the page that names the person — not the home page.",
        "If more than one person runs the business, add one block each rather than inventing a single figurehead."
      ],
      code: {
        next: {
          label: "app/about/page.tsx",
          text: "const person = {\n" +
            "  \"@context\": \"https://schema.org\",\n" +
            "  \"@type\": \"Person\",\n" +
            "  name: \"Jane Doe\",\n" +
            "  jobTitle: \"Founder\",\n" +
            "  worksFor: { \"@type\": \"Organization\", name: \"Your Business LLC\" },\n" +
            "  url: \"" + SITE + "/about\",\n" +
            "  sameAs: [\n" +
            "    \"https://www.linkedin.com/in/janedoe\",\n" +
            "  ],\n" +
            "};\n\n" +
            "<script type=\"application/ld+json\" dangerouslySetInnerHTML={{ __html: JSON.stringify(person).replace(/</g, '\\\\u003c') }} />"
        },
        wordpress: {
          label: "Edit the about page → Custom HTML block",
          text: "<script type=\"application/ld+json\">\n" +
            "{\n" +
            "  \"@context\": \"https://schema.org\",\n" +
            "  \"@type\": \"Person\",\n" +
            "  \"name\": \"Jane Doe\",\n" +
            "  \"jobTitle\": \"Founder\",\n" +
            "  \"worksFor\": { \"@type\": \"Organization\", \"name\": \"Your Business LLC\" },\n" +
            "  \"url\": \"" + SITE + "/about\",\n" +
            "  \"sameAs\": [\"https://www.linkedin.com/in/janedoe\"]\n" +
            "}\n" +
            "<\/script>"
        },
        shopify: {
          label: "templates/page.about.liquid",
          text: "<script type=\"application/ld+json\">\n" +
            "{\n" +
            "  \"@context\": \"https://schema.org\",\n" +
            "  \"@type\": \"Person\",\n" +
            "  \"name\": \"Jane Doe\",\n" +
            "  \"jobTitle\": \"Founder\",\n" +
            "  \"worksFor\": { \"@type\": \"Organization\", \"name\": {{ shop.name | json }} },\n" +
            "  \"url\": \"{{ shop.url }}/pages/about\",\n" +
            "  \"sameAs\": [\"https://www.linkedin.com/in/janedoe\"]\n" +
            "}\n" +
            "<\/script>"
        },
        "static": {
          label: "about.html — inside <head>",
          text: "<script type=\"application/ld+json\">\n" +
            "{\n" +
            "  \"@context\": \"https://schema.org\",\n" +
            "  \"@type\": \"Person\",\n" +
            "  \"name\": \"Jane Doe\",\n" +
            "  \"jobTitle\": \"Founder\",\n" +
            "  \"worksFor\": { \"@type\": \"Organization\", \"name\": \"Your Business LLC\" },\n" +
            "  \"url\": \"" + SITE + "/about\",\n" +
            "  \"sameAs\": [\"https://www.linkedin.com/in/janedoe\"]\n" +
            "}\n" +
            "<\/script>"
        }
      }
    },

    /* ---------- 3 · Content signals ---------- */

    questions: {
      title: "Headings written as real questions",
      why: "Descriptive headings make page structure easier for people, assistive technology, and automated systems to interpret. Use questions where they fit naturally, not as a rigid ranking tactic.",
      offsite: "content",
      effort: 2,
      steps: [
        "Open your two highest-traffic pages and read the H2s out loud.",
        "Rewrite each one as the question a customer would type. Keep the answer directly underneath, in the first sentence.",
        "Pull the wording from your own inbox — the questions people actually send you beat any keyword list.",
        "Keep one H1 per page. The questions are H2s."
      ],
      template: {
        label: "Rewrite pattern — left is what most sites have, right is what to publish",
        text: "Pricing                  →  How much does it cost?\n" +
          "Our process              →  What happens after I book?\n" +
          "Service area             →  Do you cover my area?\n" +
          "Turnaround               →  How long does it take?\n" +
          "Guarantee                →  What if I am not happy with it?\n" +
          "About us                 →  Who actually does the work?"
      }
    },

    plain: {
      title: "Plain language, no insider jargon",
      why: "Plain language reduces ambiguity for people and automated summaries. It improves clarity without promising that any provider will summarize, cite, or recommend the page.",
      offsite: "content",
      effort: 2,
      steps: [
        "Write one sentence that says what you do, who for, and where. Put it in the first paragraph of the home page.",
        "Delete every acronym a first-time visitor would not know, or expand it on first use.",
        "Read the page to someone outside your industry. Anywhere they pause is a rewrite.",
        "Cut adjectives that carry no information — leading, innovative, world-class, cutting-edge."
      ],
      template: {
        label: "The one sentence to get right — fill this in and put it up top",
        text: "We are a ____________________ in ____________________.\n" +
          "We help ____________________ do ____________________.\n" +
          "Prices start at ____________________.\n\n" +
          "Example shape (not a claim about anyone):\n" +
          "\"We are a two-person wedding photography studio in Portland, Oregon.\n" +
          " We shoot full-day weddings for couples who want the day documented,\n" +
          " not directed. Packages start at $2,400.\""
      }
    },

    contact: {
      title: "Contact info on every page",
      why: "Clear, current contact details help people verify how to reach the business. Publish only channels you actively maintain and avoid assuming a provider will surface them.",
      verify: "view-source on any page and search for mailto: and tel:",
      effort: 1,
      steps: [
        "Put email and phone in the footer template so every page inherits them.",
        "Use real mailto: and tel: links — plain text is harder to extract and useless on a phone.",
        "Use the same formatting everywhere. This is the same string your Organization schema and your Google Business Profile should carry."
      ],
      code: {
        next: {
          label: "app/layout.tsx — inside the footer",
          text: "<footer>\n" +
            "  <address style={{ fontStyle: \"normal\" }}>\n" +
            "    Your Business LLC<br />\n" +
            "    123 Main St, Suite 4, Portland, OR 97201<br />\n" +
            "    <a href=\"mailto:hello@yoursite.com\">hello@yoursite.com</a>{\" · \"}\n" +
            "    <a href=\"tel:+15550000000\">(555) 000-0000</a>\n" +
            "  </address>\n" +
            "</footer>"
        },
        wordpress: {
          label: "wp-content/themes/your-child-theme/footer.php",
          text: "<footer>\n" +
            "\t<address style=\"font-style:normal\">\n" +
            "\t\tYour Business LLC<br>\n" +
            "\t\t123 Main St, Suite 4, Portland, OR 97201<br>\n" +
            "\t\t<a href=\"mailto:hello@yoursite.com\">hello@yoursite.com</a> ·\n" +
            "\t\t<a href=\"tel:+15550000000\">(555) 000-0000</a>\n" +
            "\t</address>\n" +
            "</footer>"
        },
        shopify: {
          label: "sections/footer.liquid",
          text: "<address style=\"font-style:normal\">\n" +
            "  {{ shop.name }}<br>\n" +
            "  {{ shop.address.summary }}<br>\n" +
            "  <a href=\"mailto:{{ shop.email }}\">{{ shop.email }}</a> ·\n" +
            "  <a href=\"tel:+15550000000\">(555) 000-0000</a>\n" +
            "</address>"
        },
        "static": {
          label: "The footer of every page (or your shared include)",
          text: "<footer>\n" +
            "  <address style=\"font-style:normal\">\n" +
            "    Your Business LLC<br>\n" +
            "    123 Main St, Suite 4, Portland, OR 97201<br>\n" +
            "    <a href=\"mailto:hello@yoursite.com\">hello@yoursite.com</a> ·\n" +
            "    <a href=\"tel:+15550000000\">(555) 000-0000</a>\n" +
            "  </address>\n" +
            "</footer>"
        }
      }
    },

    about: {
      title: "A clear about page",
      why: "A clear about page provides a stable first-party account of the business for people and automated systems. Providers still choose whether and how to use it.",
      offsite: "content",
      effort: 2,
      steps: [
        "Publish it at /about and link it from the main navigation and the footer.",
        "Answer who, what, where, and since when in the first paragraph. Story goes below that, not above it.",
        "Name a real person. An about page with no human in it reads as a shell to both people and machines.",
        "Once it exists, add it to llms.txt and to your sitemap."
      ],
      template: {
        label: "Page outline — each heading answers one question",
        text: "H1   About Your Business LLC\n\n" +
          "     First paragraph, four sentences:\n" +
          "       1. What you do and who for.\n" +
          "       2. Where you are and what area you cover.\n" +
          "       3. How long you have been doing it.\n" +
          "       4. What makes your version different — concretely, not adjectives.\n\n" +
          "H2   Who does the work\n" +
          "     Names, roles, one line each. A photo helps humans, not crawlers.\n\n" +
          "H2   How we work\n" +
          "     The actual steps, in order, from first contact to finished job.\n\n" +
          "H2   How much it costs\n" +
          "     A real number or a real range. \"Contact us for pricing\" answers nothing.\n\n" +
          "H2   How to reach us\n" +
          "     Email, phone, hours, address."
      }
    },

    /* ---------- 4 · Technical basics ---------- */

    canonical: {
      title: "Canonical URL on every page",
      why: "A canonical link identifies the preferred URL when substantially similar pages exist. Search systems may treat it as a hint, and it does not control citations or guarantee consolidation.",
      verify: "curl -s " + SITE + "/about | grep canonical",
      effort: 1,
      steps: [
        "Every canonical must be an absolute URL, and it must point at a page that returns 200.",
        "A page's canonical points at itself unless it is genuinely a duplicate of another page.",
        "Pick one host and stick to it — www or bare, https only, and be consistent about the trailing slash."
      ],
      code: {
        next: {
          label: "app/layout.tsx and each page.tsx",
          text: "// app/layout.tsx — set the base once\n" +
            "export const metadata = {\n" +
            "  metadataBase: new URL(\"" + SITE + "\"),\n" +
            "};\n\n" +
            "// app/about/page.tsx — one line per page\n" +
            "export const metadata = {\n" +
            "  alternates: { canonical: \"/about\" },\n" +
            "};"
        },
        wordpress: {
          label: "wp-content/themes/your-child-theme/header.php",
          text: "<!-- WordPress emits <link rel=\"canonical\"> for singular pages from wp_head().\n" +
            "     Custom themes sometimes drop this call. Make sure it is there,\n" +
            "     immediately before </head>: -->\n" +
            "<?php wp_head(); ?>\n" +
            "</head>\n\n" +
            "<!-- If Yoast or Rank Math is active, it takes over canonicals. Set them\n" +
            "     in the plugin's Advanced tab per page rather than in code. -->"
        },
        shopify: {
          label: "layout/theme.liquid — inside <head>",
          text: "<link rel=\"canonical\" href=\"{{ canonical_url }}\">"
        },
        "static": {
          label: "Every page — inside <head>",
          text: "<link rel=\"canonical\" href=\"" + SITE + "/about/\">"
        }
      }
    },

    meta: {
      title: "Open Graph + Twitter tags",
      why: "Open Graph and Twitter tags improve social link previews on platforms that support them. They are not a guarantee that an AI system will quote, rank, or cite the supplied text.",
      verify: "curl -s " + SITE + "/ | grep -E 'og:title|twitter:card'",
      effort: 1,
      steps: [
        "og:title and og:description are per page. A single site-wide pair is barely better than nothing.",
        "og:image should be an absolute URL, at least 1200x630, and under about 1 MB.",
        "og:url should match the canonical exactly."
      ],
      code: {
        next: {
          label: "app/about/page.tsx",
          text: "export const metadata = {\n" +
            "  title: \"About — Your Business LLC\",\n" +
            "  description: \"Who runs it, what we do, and where we work.\",\n" +
            "  alternates: { canonical: \"/about\" },\n" +
            "  openGraph: {\n" +
            "    title: \"About — Your Business LLC\",\n" +
            "    description: \"Who runs it, what we do, and where we work.\",\n" +
            "    url: \"/about\",\n" +
            "    siteName: \"Your Business LLC\",\n" +
            "    images: [\"/og.png\"],\n" +
            "    type: \"website\",\n" +
            "  },\n" +
            "  twitter: {\n" +
            "    card: \"summary_large_image\",\n" +
            "    title: \"About — Your Business LLC\",\n" +
            "    description: \"Who runs it, what we do, and where we work.\",\n" +
            "    images: [\"/og.png\"],\n" +
            "  },\n" +
            "};"
        },
        wordpress: {
          label: "wp-content/themes/your-child-theme/functions.php  (skip this if Yoast or Rank Math is active — they already do it)",
          text: "<?php\n" +
            "add_action( 'wp_head', function () {\n" +
            "\tif ( ! is_singular() ) {\n" +
            "\t\treturn;\n" +
            "\t}\n\n" +
            "\t$title = get_the_title();\n" +
            "\t$desc  = wp_strip_all_tags( get_the_excerpt() );\n" +
            "\t$url   = get_permalink();\n" +
            "\t$img   = get_the_post_thumbnail_url( null, 'full' );\n\n" +
            "\tprintf(\n" +
            "\t\t'<meta property=\"og:title\" content=\"%s\">' . \"\\n\" .\n" +
            "\t\t'<meta property=\"og:description\" content=\"%s\">' . \"\\n\" .\n" +
            "\t\t'<meta property=\"og:url\" content=\"%s\">' . \"\\n\" .\n" +
            "\t\t'<meta property=\"og:type\" content=\"article\">' . \"\\n\" .\n" +
            "\t\t'<meta name=\"twitter:card\" content=\"summary_large_image\">' . \"\\n\",\n" +
            "\t\tesc_attr( $title ),\n" +
            "\t\tesc_attr( $desc ),\n" +
            "\t\tesc_url( $url )\n" +
            "\t);\n\n" +
            "\tif ( $img ) {\n" +
            "\t\tprintf( '<meta property=\"og:image\" content=\"%s\">' . \"\\n\", esc_url( $img ) );\n" +
            "\t}\n" +
            "} );"
        },
        shopify: {
          label: "layout/theme.liquid — Dawn ships snippets/meta-tags.liquid; make sure it is rendered",
          text: "{%- comment -%} inside <head>, before </head> {%- endcomment -%}\n" +
            "{% render 'meta-tags' %}\n\n" +
            "{%- comment -%}\n" +
            "  If your theme has no meta-tags snippet, add these directly instead:\n" +
            "{%- endcomment -%}\n" +
            "<meta property=\"og:title\" content=\"{{ page_title | escape }}\">\n" +
            "<meta property=\"og:description\" content=\"{{ page_description | default: shop.description | escape }}\">\n" +
            "<meta property=\"og:url\" content=\"{{ canonical_url }}\">\n" +
            "<meta property=\"og:type\" content=\"website\">\n" +
            "<meta name=\"twitter:card\" content=\"summary_large_image\">"
        },
        "static": {
          label: "Every page — inside <head>",
          text: "<meta property=\"og:type\" content=\"website\">\n" +
            "<meta property=\"og:site_name\" content=\"Your Business LLC\">\n" +
            "<meta property=\"og:title\" content=\"About — Your Business LLC\">\n" +
            "<meta property=\"og:description\" content=\"Who runs it, what we do, and where we work.\">\n" +
            "<meta property=\"og:url\" content=\"" + SITE + "/about/\">\n" +
            "<meta property=\"og:image\" content=\"" + SITE + "/og.png\">\n" +
            "<meta name=\"twitter:card\" content=\"summary_large_image\">\n" +
            "<meta name=\"twitter:title\" content=\"About — Your Business LLC\">\n" +
            "<meta name=\"twitter:description\" content=\"Who runs it, what we do, and where we work.\">\n" +
            "<meta name=\"twitter:image\" content=\"" + SITE + "/og.png\">"
        }
      }
    },

    speed: {
      title: "Loads fast (under about 2.5s)",
      why: "Fast, stable pages improve user experience and reliable delivery. Treat performance thresholds as diagnostic targets, not guarantees of crawling, ranking, citation, or conversion.",
      verify: "run the page through pagespeed.web.dev and read the LCP number",
      effort: 1,
      steps: [
        "Measure first. Fix the largest contentful paint element — usually the hero image or a web font.",
        "Give every image explicit width and height so the layout does not jump.",
        "Lazy-load everything below the fold; never lazy-load the hero.",
        "Delete scripts you no longer use. Every third-party tag is someone else's server in your critical path."
      ],
      code: {
        next: {
          label: "Hero image and fonts",
          text: "import Image from \"next/image\";\nimport { Inter } from \"next/font/google\";\n\n" +
            "const inter = Inter({ subsets: [\"latin\"], display: \"swap\" });\n\n" +
            "// hero — priority, no lazy load\n" +
            "<Image src=\"/hero.jpg\" alt=\"…\" width={1600} height={900} priority sizes=\"100vw\" />\n\n" +
            "// below the fold — next/image lazy-loads by default, just drop `priority`\n" +
            "<Image src=\"/gallery-1.jpg\" alt=\"…\" width={800} height={600} sizes=\"(min-width: 768px) 50vw, 100vw\" />"
        },
        wordpress: {
          label: "wp-content/themes/your-child-theme/functions.php",
          text: "<?php\n" +
            "/**\n" +
            " * Stop shipping the block-library stylesheet on pages that use no blocks.\n" +
            " * Small, safe, and measurable on classic-theme sites.\n" +
            " */\n" +
            "add_action( 'wp_enqueue_scripts', function () {\n" +
            "\tif ( ! has_blocks() ) {\n" +
            "\t\twp_dequeue_style( 'wp-block-library' );\n" +
            "\t}\n" +
            "}, 100 );\n\n" +
            "// Then, outside code: install one caching plugin (not three), serve WebP,\n" +
            "// and deactivate plugins you are no longer using."
        },
        shopify: {
          label: "Any section that renders an image",
          text: "<img\n" +
            "  src=\"{{ image | image_url: width: 800 }}\"\n" +
            "  srcset=\"{{ image | image_url: width: 400 }} 400w,\n" +
            "          {{ image | image_url: width: 800 }} 800w,\n" +
            "          {{ image | image_url: width: 1200 }} 1200w\"\n" +
            "  sizes=\"(min-width: 750px) 50vw, 100vw\"\n" +
            "  width=\"{{ image.width }}\"\n" +
            "  height=\"{{ image.height }}\"\n" +
            "  alt=\"{{ image.alt | escape }}\"\n" +
            "  loading=\"lazy\">\n\n" +
            "{%- comment -%} Then audit installed apps — each one injects its own JS. {%- endcomment -%}"
        },
        "static": {
          label: "Images and fonts",
          text: "<!-- hero: eager, sized, preloaded -->\n" +
            "<link rel=\"preload\" href=\"/fonts/body-latin.woff2\" as=\"font\" type=\"font/woff2\" crossorigin>\n" +
            "<img src=\"/hero.webp\" width=\"1600\" height=\"900\" alt=\"…\" decoding=\"async\">\n\n" +
            "<!-- everything below the fold -->\n" +
            "<img src=\"/gallery-1.webp\" width=\"800\" height=\"600\" alt=\"…\" loading=\"lazy\" decoding=\"async\">"
        }
      }
    },

    mobile: {
      title: "Readable on a phone",
      why: "Responsive, accessible layouts help people use the site across screen sizes and input modes. Verify the real interface rather than assuming a passing score predicts provider behavior.",
      verify: "open the site on a real phone, then re-run pagespeed.web.dev on the Mobile tab",
      effort: 1,
      steps: [
        "Body text at 16px or larger. Anything smaller triggers zoom on iOS.",
        "Tap targets at least 44 by 44 CSS pixels, with space between them.",
        "Nothing should scroll sideways. If it does, something has a fixed width.",
        "Test on a real device, not just the browser's device toolbar."
      ],
      code: {
        next: {
          label: "app/layout.tsx",
          text: "// Next.js App Router adds the viewport meta from this export.\n" +
            "export const viewport = {\n" +
            "  width: \"device-width\",\n" +
            "  initialScale: 1,\n" +
            "};"
        },
        wordpress: {
          label: "wp-content/themes/your-child-theme/header.php — inside <head>",
          text: "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
        },
        shopify: {
          label: "layout/theme.liquid — inside <head>",
          text: "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
        },
        "static": {
          label: "Every page — inside <head>",
          text: "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
        }
      },
      template: {
        label: "Safety-net CSS — add once, fixes most sideways scrolling",
        text: "img, video, iframe, table, pre { max-width: 100%; height: auto; }\n" +
          "body { font-size: 16px; overflow-x: hidden; }\n" +
          "button, .btn, a.btn { min-height: 44px; min-width: 44px; }\n" +
          "* { overflow-wrap: anywhere; }"
      }
    },

    /* ---------- 5 · Authority ---------- */

    nap: {
      title: "Name, address, phone all match",
      why: "Consistent public business details reduce avoidable contradictions for people and automated systems. They do not establish identity on their own or guarantee inclusion.",
      offsite: "off-site",
      effort: 3,
      steps: [
        "Write the canonical version once, below, and treat it as the only correct one.",
        "Update it in this order: your site footer, your Organization schema, Google Business Profile, then every social and directory profile you can find.",
        "Search your own business name and click through the first two pages — old listings you forgot about are the usual source of the mismatch.",
        "Match the formatting exactly, punctuation included. 'Suite 4' and '#4' are not the same string."
      ],
      template: {
        label: "Your canonical record — fill this in, then make every listing identical",
        text: "Legal name : \n" +
          "Trading as : \n" +
          "Street     : \n" +
          "City/State : \n" +
          "Postcode   : \n" +
          "Phone      : \n" +
          "Email      : \n" +
          "Website    : \n\n" +
          "Places to update (tick as you go):\n" +
          "  [ ] Site footer          [ ] Organization schema\n" +
          "  [ ] Google Business      [ ] Apple Business Connect\n" +
          "  [ ] Facebook             [ ] Instagram bio\n" +
          "  [ ] LinkedIn             [ ] Yelp / industry directory\n" +
          "  [ ] Invoices & email signature"
      }
    },

    sameas: {
      title: "Profiles linked via sameAs",
      why: "sameAs declares related official profiles in structured data. It is a relationship hint, not proof of ownership, identity, authority, ranking, or citation.",
      verify: "view-source on your home page and search for \"sameAs\"",
      effort: 1,
      steps: [
        "List only profiles you actually control and that are publicly viewable.",
        "Use the canonical profile URL, not a share or tracking link.",
        "Add it to the Organization block you already have rather than creating a second block."
      ],
      code: {
        next: {
          label: "app/layout.tsx — inside the org object you already render",
          text: "const org = {\n" +
            "  \"@context\": \"https://schema.org\",\n" +
            "  \"@type\": \"LocalBusiness\",\n" +
            "  name: \"Your Business LLC\",\n" +
            "  url: \"" + SITE + "\",\n" +
            "  sameAs: [\n" +
            "    \"https://www.google.com/maps/place/your-listing\",\n" +
            "    \"https://www.linkedin.com/company/your-business\",\n" +
            "    \"https://www.instagram.com/yourbusiness\",\n" +
            "    \"https://www.facebook.com/yourbusiness\",\n" +
            "  ],\n" +
            "};"
        },
        wordpress: {
          label: "functions.php — add to the $org array you already output",
          text: "'sameAs' => array(\n" +
            "\t'https://www.google.com/maps/place/your-listing',\n" +
            "\t'https://www.linkedin.com/company/your-business',\n" +
            "\t'https://www.instagram.com/yourbusiness',\n" +
            "),"
        },
        shopify: {
          label: "layout/theme.liquid — inside the LocalBusiness block",
          text: "\"sameAs\": [\n" +
            "  \"https://www.google.com/maps/place/your-listing\",\n" +
            "  \"https://www.instagram.com/yourbusiness\",\n" +
            "  \"https://www.facebook.com/yourbusiness\"\n" +
            "]"
        },
        "static": {
          label: "index.html — inside the Organization block",
          text: "\"sameAs\": [\n" +
            "  \"https://www.google.com/maps/place/your-listing\",\n" +
            "  \"https://www.linkedin.com/company/your-business\",\n" +
            "  \"https://www.instagram.com/yourbusiness\"\n" +
            "]"
        }
      }
    },

    proof: {
      title: "Reviews or client proof on-site",
      why: "Authentic, permissioned proof helps people evaluate claims and makes supporting evidence available in the page content. It does not guarantee quotation, citation, or recommendation.",
      offsite: "content",
      effort: 3,
      steps: [
        "Collect real reviews first. There is no markup that substitutes for having them.",
        "Publish them as plain text on the page — name, date, and the actual words. If your review app renders over JavaScript, also print the text server-side.",
        "Only after they are visible on the page, mark them up as Review or AggregateRating.",
        "Never mark up a review that is not shown on the page, and never write one yourself. Both break Google's structured-data guidelines and can get your rich results pulled."
      ],
      template: {
        label: "Publish this shape, then mark it up — text first, schema second",
        text: "<article>\n" +
          "  <blockquote>The exact words the customer wrote, unedited.</blockquote>\n" +
          "  <p>— First name L., Portland · March 2026</p>\n" +
          "</article>\n\n" +
          "Once the text above is really on the page, this is the matching markup:\n\n" +
          "{\n" +
          "  \"@context\": \"https://schema.org\",\n" +
          "  \"@type\": \"Review\",\n" +
          "  \"itemReviewed\": { \"@type\": \"LocalBusiness\", \"name\": \"Your Business LLC\" },\n" +
          "  \"author\": { \"@type\": \"Person\", \"name\": \"First name L.\" },\n" +
          "  \"datePublished\": \"2026-03-14\",\n" +
          "  \"reviewBody\": \"The exact words the customer wrote, unedited.\",\n" +
          "  \"reviewRating\": { \"@type\": \"Rating\", \"ratingValue\": \"5\", \"bestRating\": \"5\" }\n" +
          "}"
      }
    },

    mentions: {
      title: "Mentioned on other sites",
      why: "Relevant, authentic third-party mentions can provide independent context. Their existence does not guarantee rankings, citations, recommendations, traffic, or any provider outcome.",
      offsite: "off-site",
      effort: 3,
      steps: [
        "Start with the listings you can claim today — they are free and they take an afternoon.",
        "Then work the relationships you already have: suppliers, partners, venues, and clients often have a page where they list who they work with. Ask.",
        "Anything earned — press, a podcast, a guest article — takes weeks. Start it now, in parallel, and do not wait on it.",
        "No one can promise you coverage or a mention. Treat this as a steady habit, not a task with a completion date."
      ],
      template: {
        label: "Target list — work down it, tick what lands",
        text: "Claim today (free, same-day):\n" +
          "  [ ] Google Business Profile\n" +
          "  [ ] Apple Business Connect\n" +
          "  [ ] Bing Places\n" +
          "  [ ] The main directory for your trade\n" +
          "  [ ] Local chamber of commerce or business association\n\n" +
          "Ask this week (people who already know you):\n" +
          "  [ ] Suppliers — \"do you have a stockists / partners page?\"\n" +
          "  [ ] Venues or businesses you work alongside\n" +
          "  [ ] Two past clients — a named case study on their site\n\n" +
          "Earn over months (no guarantees, start anyway):\n" +
          "  [ ] Local press — a real story, not a press release\n" +
          "  [ ] One industry podcast\n" +
          "  [ ] One guest article on a site your customers read"
      }
    }
  };

  /* ============================================================
     report
     ============================================================ */

  function selectedPlatform() {
    var sel = document.getElementById("proScorecardPlatform");
    return (sel && sel.value) || "static";
  }

  function pre(text) { return "<pre>" + esc(text) + "</pre>"; }

  function orderMissing(missing) {
    return missing.slice().sort(function (a, b) {
      if (b.weight !== a.weight) return b.weight - a.weight;
      var ea = (FIXES[a.id] && FIXES[a.id].effort) || 2;
      var eb = (FIXES[b.id] && FIXES[b.id].effort) || 2;
      return ea - eb;
    });
  }

  function fixCard(rank, item, platform, maxRaw) {
    var meta = FIXES[item.id];
    var impact = maxRaw ? Math.round(item.weight / maxRaw * 100) : 0;
    var p = PLATFORMS[platform] || PLATFORMS["static"];
    var out = '<div class="item">';

    out += '<p class="rank">' + esc("Fix " + (rank < 10 ? "0" + rank : rank) + " · +" + impact + " points · " + item.section) + "</p>";
    out += "<h3>" + esc(meta ? meta.title : item.id) + "</h3>";

    if (meta && meta.why) out += "<p>" + esc(meta.why) + "</p>";
    if (item.fix) out += "<p><strong>The short version:</strong> " + esc(item.fix) + "</p>";

    var code = meta && meta.code && meta.code[platform];
    if (code) {
      out += "<p><strong>" + esc(code.label) + "</strong></p>";
      out += pre(code.text !== null && code.text !== undefined ? code.text : (meta.sharedCode || ""));
    } else if (meta && meta.platformNotes && meta.platformNotes[platform]) {
      out += "<p><strong>On " + esc(p.label) + ":</strong> " + esc(meta.platformNotes[platform]) + "</p>";
    } else if (meta && meta.offsite) {
      out += "<p><strong>No snippet for this one</strong> — it is a " + esc(meta.offsite) +
        " task, and pasting code would not fix it. Here is the concrete work instead.</p>";
    }

    if (meta && meta.steps && meta.steps.length) {
      out += "<ol>" + meta.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>";
    }

    if (meta && meta.template) {
      out += "<p><strong>" + esc(meta.template.label) + "</strong></p>" + pre(meta.template.text);
    }

    if (meta && meta.verify) {
      out += "<p><strong>Check it worked:</strong> <code>" + esc(meta.verify) + "</code></p>";
    }

    return out + "</div>";
  }

  function reportHtml(snap, platform, recheck) {
    var p = PLATFORMS[platform] || PLATFORMS["static"];
    var g = gradeFor(snap.score);
    var maxRaw = maxRawOf(snap);
    var ordered = orderMissing(snap.missing);
    var pillClass = snap.score < 40 ? "bad" : (snap.score < 65 ? "warn" : (snap.score < 85 ? "" : "ok"));

    var body =
      "<h2>Where you stand</h2>" +
      '<p><span class="pill ' + pillClass + '">' + esc(snap.score + " / 100 · " + g.label) + "</span> &nbsp; " +
      esc(snap.checkedCount + " of " + snap.total + " checks ticked") + "</p>" +
      "<table><thead><tr><th>Section</th><th class=\"num\">Checks</th><th class=\"num\">Points</th></tr></thead><tbody>" +
      snap.sections.map(function (s) {
        return "<tr><td>" + esc(s.name) + "</td>" +
          '<td class="num">' + esc(s.checked + " / " + s.count) + "</td>" +
          '<td class="num">' + esc((Math.round(s.raw * 10) / 10) + " / " + (Math.round(s.max * 10) / 10)) + "</td></tr>";
      }).join("") +
      "</tbody></table>";

    if (ordered.length) {
      body +=
        "<h2>Your fix plan — " + esc(String(ordered.length)) + " open</h2>" +
        "<p>Ordered by points first, then by how fast the fix can actually land: a file you can paste today comes before writing you have to do, which comes before work that depends on other people. Written for <strong>" +
        esc(p.label) + "</strong>. " + esc(p.note) + "</p>" +
        ordered.map(function (item, i) { return fixCard(i + 1, item, platform, maxRaw); }).join("");
    } else {
      body +=
        "<h2>Your fix plan</h2>" +
        "<p>Nothing outstanding — all " + esc(String(snap.total)) + " checks are ticked. The useful thing now is the re-check below: " +
        "a redesign, a migration, or a theme update can quietly undo any of them.</p>";
    }

    if (snap.passed.length) {
      body +=
        "<h2>Already passing</h2><ul>" +
        snap.passed.map(function (item) {
          var meta = FIXES[item.id];
          return "<li>" + esc((meta ? meta.title : item.id) + " — " + item.section) + "</li>";
        }).join("") +
        "</ul>";
    }

    body +=
      "<h2>The 30-day re-check</h2>" +
      "<p>Two files in this download do the re-check, and it is worth being precise about what that means: " +
      "<code>recheck.ics</code> is a calendar event on <strong>" + esc(recheck.toLocaleDateString()) +
      "</strong> that reminds you to run the free scorecard again, and <code>baseline.json</code> is today's answers saved so the second run is a real before-and-after " +
      "instead of a vague impression. Nobody runs it for you and nothing watches your site — it is a reminder and a saved starting point.</p>" +
      "<ol>" +
      "<li>Work down the fix plan above. Tick each item in the free scorecard as it lands.</li>" +
      "<li>On " + esc(recheck.toLocaleDateString()) + ", open the scorecard and run it again.</li>" +
      "<li>Open <code>baseline.json</code> beside it. Compare the score, and compare the per-check pass/fail list to see exactly which items moved.</li>" +
      "</ol>" +

      "<h2>What this report does not do</h2>" +
      "<p>These checks cover access and discovery, machine-readable context, content clarity, technical delivery, and identity corroboration. " +
      "The score is Nymrel's editorial heuristic, not a provider metric, and it reflects only the checks you reported as passing. " +
      "It does not guarantee crawling, indexing, ranking, citation, recommendation, traffic, conversion, or any other provider or business outcome.</p>";

    return JB.pro.reportHtml({
      kicker: "AI Visibility Scorecard · Pro Report",
      title: "Your discovery-readiness fix plan",
      lede: snap.score + "/100 — " + g.label + ". " + (ordered.length ? ordered.length + " fixes, written for " + p.label + "." : "All checks passing."),
      body: body
    });
  }

  function baselineJson(snap, platform, recheck) {
    var g = gradeFor(snap.score);
    var checks = snap.passed.map(function (i) { return { id: i.id, section: i.section, weight: i.weight, passed: true }; })
      .concat(snap.missing.map(function (i) { return { id: i.id, section: i.section, weight: i.weight, passed: false }; }));
    checks.sort(function (a, b) { return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0); });

    return JSON.stringify({
      tool: "ai-visibility-scorecard",
      artifact: "pro-report-baseline",
      version: 1,
      generatedAt: new Date().toISOString(),
      recheckOn: isoDate(recheck),
      platform: (PLATFORMS[platform] || PLATFORMS["static"]).label,
      score: snap.score,
      grade: g.label,
      checkedCount: snap.checkedCount,
      total: snap.total,
      sections: snap.sections.map(function (s) {
        return { name: s.name, checked: s.checked, count: s.count, raw: s.raw, max: s.max };
      }),
      checks: checks,
      note: "A self-reported snapshot of what was ticked in the free scorecard on the date above. Re-run the scorecard on recheckOn and compare against this file."
    }, null, 2) + "\n";
  }

  function readmeTxt(snap, platform, recheck) {
    var p = PLATFORMS[platform] || PLATFORMS["static"];
    var g = gradeFor(snap.score);
    return [
      "AI Visibility Scorecard — Pro Report",
      "Built " + new Date().toLocaleString() + " for " + p.label,
      "Your readiness score today: " + snap.score + "/100 (" + g.label + ") — " + snap.checkedCount + " of " + snap.total + " checks ticked",
      "",
      "  pro-report.html   Open in a browser. Your score, a per-section table, and every",
      "                    missing check as its own card with a copy-paste fix for " + p.label + ".",
      "                    Print it to save a PDF.",
      "  recheck.ics       Double-click to add a calendar reminder on " + recheck.toLocaleDateString() + ".",
      "  baseline.json     Today's answers, saved. Open it next to your second run so the",
      "                    re-check is a real before-and-after.",
      "  README.txt        This file.",
      "",
      "About the 30-day re-check: it is the calendar reminder plus the saved baseline —",
      "nothing more. No one runs the scorecard for you, and nothing monitors your site.",
      "You re-run the free scorecard on the date and compare it against baseline.json.",
      "",
      "About the fixes: where a check has a real code fix, the snippet is in the report",
      "and it works as written once you replace the placeholder values. Where a check is",
      "a content or off-site task, the report says so plainly and gives the concrete",
      "action instead of a snippet that would not fix anything.",
      "",
      "This artifact was generated in your browser from the checks you ticked.",
      "Those selections were not attached to a request. The hosted scorecard and its privacy-friendly analytics may still make ordinary page and analytics requests.",
      "",
      "Questions: contact@nymrel.com",
      ""
    ].join("\n");
  }

  /* ============================================================
     registration
     ============================================================ */

  JB.pro.register("scorecard-pro", {
    label: "Pro Report",
    filenameLabel: "the report",
    summary: "Four files built from the twenty checks you ticked above, written for the platform you pick.",
    contents: [
      "pro-report.html — your score, a per-section table, and one card per missing check with a copy-paste fix for your platform",
      "Fixes ordered by points first, then by how fast each one can actually land",
      "Content and off-site checks are labelled as such and get the concrete action, not a fake snippet",
      "recheck.ics — a calendar reminder 30 days out to run the free scorecard again",
      "baseline.json — today's answers saved, so the second run is a real before-and-after",
      "README.txt — what each file is and what the re-check actually is"
    ],
    extraHtml:
      '<label for="proScorecardPlatform">Write the fixes for</label>' +
      '<select id="proScorecardPlatform">' +
      ["next", "wordpress", "shopify", "static"].map(function (k) {
        return '<option value="' + k + '"' + (k === "static" ? " selected" : "") + ">" + esc(PLATFORMS[k].label) + "</option>";
      }).join("") +
      "</select>",
    ready: function () {
      var snap = snapshot();
      if (!snap) return "Open the scorecard above and tick your checks first — the report is built from them.";
      if (!snap.checkedCount) {
        return "Tick the checks your site already passes above. With nothing ticked there is no score to write a report about.";
      }
      return "";
    },
    build: function () {
      var snap = snapshot();
      if (!snap) throw new Error("the scorecard is not on this page");

      var platform = selectedPlatform();
      var recheck = new Date();
      recheck.setDate(recheck.getDate() + 30);
      recheck.setHours(10, 0, 0, 0);

      var g = gradeFor(snap.score);
      var ics = JB.pro.icsFile({
        date: recheck,
        summary: "Re-run the AI Visibility Scorecard",
        description:
          "30 days ago you scored " + snap.score + "/100 (" + g.label + ") — " + snap.checkedCount + " of " + snap.total + " checks.\n" +
          "Run the free scorecard again and compare it against the baseline.json in your Pro Report download.\n" +
          "This is a reminder you set for yourself; nothing is monitoring the site on your behalf.\n" +
          "Scorecard: https://nymrel.com/tools/ai-visibility-scorecard",
        url: "https://nymrel.com/tools/ai-visibility-scorecard"
      });

      return {
        filename: "ai-visibility-pro-report-" + isoDate(new Date()) + ".zip",
        toast: "Pro Report downloaded — start with README.txt",
        files: [
          { name: "pro-report.html", text: reportHtml(snap, platform, recheck) },
          { name: "recheck.ics", text: ics },
          { name: "baseline.json", text: baselineJson(snap, platform, recheck) },
          { name: "README.txt", text: readmeTxt(snap, platform, recheck) }
        ]
      };
    }
  });
})();
