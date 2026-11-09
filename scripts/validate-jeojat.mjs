import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";

const origin = new URL(process.argv[2] || "https://strawberry-village.web.app");
const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
const embed = source.match(/<script\b[^>]*src="https:\/\/jeojat\.altolab\.ai\/embed\.js"[^>]*><\/script>/)?.[0];
assert.ok(embed, "The entry page must contain the Jeojat embed script");

for (const path of ["/", "/index.html"]) {
  const url = new URL(path, origin);
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "Cache-Control": "no-cache" },
        signal: AbortSignal.timeout(15000),
      });
      assert.equal(response.status, 200, `${url}: expected HTTP 200`);
      assert.equal(new URL(response.url).origin, origin.origin, `${url}: unexpected redirect`);
      const cacheControl = response.headers.get("cache-control") || "";
      const cacheDirectives = cacheControl.toLowerCase().split(",").map(value => value.trim());
      assert.ok(cacheDirectives.includes("no-cache") || cacheDirectives.includes("no-store"), `${url}: HTML must revalidate before reuse; received Cache-Control: ${cacheControl || "(missing)"}`);
      assert.equal(response.headers.get("x-frame-options"), null, `${url}: X-Frame-Options blocks embedding`);

      const csp = response.headers.get("content-security-policy");
      assert.ok(csp, `${url}: missing Content-Security-Policy response header`);
      const directives = csp.split(";").map(value => value.trim().split(/\s+/));
      const ancestors = directives.filter(([name]) => name.toLowerCase() === "frame-ancestors");
      assert.equal(ancestors.length, 1, `${url}: expected one frame-ancestors directive`);
      assert.deepEqual(ancestors[0].slice(1).sort(), ["'self'", "https://jeojat.altolab.ai"], `${url}: unexpected iframe parent permissions`);
      for (const name of ["script-src", "connect-src", "img-src"]) {
        const directive = directives.find(([key]) => key.toLowerCase() === name);
        if (directive) assert.ok(directive.includes("https://jeojat.altolab.ai"), `${url}: ${name} must allow Jeojat`);
      }

      const html = await response.text();
      const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
      assert.ok(head?.includes(embed), `${url}: Jeojat script is missing or changed in <head>`);
      console.log(`${url}: HTTP 200; script present; Cache-Control: ${cacheControl}; X-Frame-Options absent; Content-Security-Policy: ${csp}`);
      break;
    } catch (error) {
      if (attempt >= 5) throw error;
      console.warn(`${url}: verification attempt ${attempt} failed; retrying in 3 seconds`);
      await setTimeout(3000);
    }
  }
}
