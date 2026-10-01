const ALLOWED_REGIONS = new Set([
  "BD", "PK", "SG", "ID", "ME", "VN", "TH", "TW", "EU", "RU"
]);

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "Content-Type"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store",
      ...corsHeaders
    }
  });
}

async function verifyTurnstile(token, secret, ip) {
  if (!token || !secret) return false;

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: {"content-type": "application/x-www-form-urlencoded"},
      body
    }
  );

  if (!response.ok) return false;

  try {
    const result = await response.json();
    return result?.success === true;
  } catch {
    return false;
  }
}

async function handleLike(request, env) {
  if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: corsHeaders});

  if (request.method !== "POST") {
    return json({status: 0, error: "Method not allowed. Use POST /api/like."}, 405);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return json({status: 0, error: "Invalid JSON request body."}, 400);
  }

  const uid = String(input?.uid ?? "").trim();
  const region = String(input?.region ?? "").trim().toUpperCase();
  const turnstileToken = String(input?.turnstileToken ?? "").trim();

  if (!/^[0-9]{5,15}$/.test(uid)) {
    return json({status: 0, error: "Enter a valid numeric UID."}, 400);
  }

  if (!ALLOWED_REGIONS.has(region)) {
    return json({status: 0, error: "Unsupported server region."}, 400);
  }

  if (!turnstileToken) {
    return json({status: 0, error: "Turnstile verification token is missing."}, 403);
  }

  const verified = await verifyTurnstile(
    turnstileToken,
    env.TURNSTILE_SECRET,
    request.headers.get("CF-Connecting-IP") || ""
  );

  if (!verified) {
    return json({status: 0, error: "Human verification failed. Please verify again."}, 403);
  }

  if (!env.LIKE_API_KEY) {
    return json({status: 0, error: "LIKE_API_KEY secret is not configured in Cloudflare."}, 500);
  }

  const upstream = new URL("https://zesty220likes.vercel.app/like");
  upstream.searchParams.set("uid", uid);
  upstream.searchParams.set("server_name", region);
  upstream.searchParams.set("key", env.LIKE_API_KEY);

  try {
    const upstreamResponse = await fetch(upstream.toString(), {
      method: "GET",
      headers: {
        "accept": "application/json",
        "user-agent": "Zesty-220-Likes-Worker/3.0"
      }
    });

    const raw = await upstreamResponse.text();

    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {
        status: upstreamResponse.ok ? 1 : 0,
        error: "Upstream returned an empty response."
      };
    } catch {
      payload = {
        status: upstreamResponse.ok ? 1 : 0,
        message: raw.slice(0, 2000),
        upstream_http_status: upstreamResponse.status
      };
    }

    return json(payload, upstreamResponse.ok ? 200 : upstreamResponse.status);
  } catch (error) {
    return json({
      status: 0,
      error: "Unable to reach the like service.",
      detail: String(error?.message || "upstream fetch failed")
    }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/like") {
      return handleLike(request, env);
    }

    if (url.pathname === "/health") {
      return json({ok: true, service: "Zesty 220 Likes", api: "online"});
    }

    // Inject the public Turnstile site key into HTML server-side.
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const assetResponse = await env.ASSETS.fetch(request);
      const html = await assetResponse.text();
      const siteKey = JSON.stringify(env.TURNSTILE_SITE_KEY || "0x4AAAAAAFLICIokx6zHNpTP");

      const patched = html.replace(
        "</head>",
        `<script>window.__ZESTY_TURNSTILE_SITE_KEY=${siteKey};</script></head>`
      );

      return new Response(patched, {
        status: assetResponse.status,
        headers: {
          "content-type": "text/html; charset=UTF-8",
          "cache-control": "no-store"
        }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
