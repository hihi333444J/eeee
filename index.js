// === Cloudflare Worker Open Proxy with Cookie Storage ===

// ⚠️ OPEN PROXY: Use only for personal/testing use.
// This proxy allows all hosts and uses cookies to store user data.

addEventListener("fetch", event => {
  event.respondWith(handle(event.request));
});

async function handle(request) {
  try {
    const url = new URL(request.url);

    // Handle saving/retrieving data via cookies
    if (url.pathname === "/cookie") {
      if (request.method === "POST") {
        const data = await request.text();
        return new Response("Cookie set!", {
          headers: {
            "Set-Cookie": `userdata=${encodeURIComponent(data)}; Path=/; Max-Age=86400; SameSite=None; Secure`,
            "Access-Control-Allow-Origin": "*",
          },
        });
      } else if (request.method === "GET") {
        const cookie = request.headers.get("Cookie") || "";
        const match = cookie.match(/userdata=([^;]+)/);
        const value = match ? decodeURIComponent(match[1]) : "No cookie found";
        return new Response(value, { headers: { "Access-Control-Allow-Origin": "*" } });
      }
    }

    // Accept target via ?url= or /proxy/https://example.com/
    let target;
    if (url.searchParams.has("url")) {
      target = url.searchParams.get("url");
    } else {
      const m = url.pathname.match(/^\/proxy\/(.+)/);
      if (m) target = decodeURIComponent(m[1]);
    }
    if (!target) {
      return new Response("Missing target url (use ?url=... or /proxy/...)", { status: 400 });
    }

    // Parse target URL
    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response("Invalid target URL", { status: 400 });
    }

    // Build fetch init — forward method and headers
    const init = {
      method: request.method,
      headers: {},
      redirect: "manual",
    };

    for (const [k, v] of request.headers) {
      if (["host", "origin", "referer", "x-forwarded-for", "cf-connecting-ip"].includes(k.toLowerCase())) continue;
      init.headers[k] = v;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
    }

    const resp = await fetch(targetUrl, init);

    // Prepare response headers
    const responseHeaders = new Headers(resp.headers);
    responseHeaders.delete("content-security-policy");
    responseHeaders.delete("content-security-policy-report-only");
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "*");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: responseHeaders });
    }

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: responseHeaders,
    });

  } catch (err) {
    return new Response("Proxy error: " + err.message, { status: 500 });
  }
}
