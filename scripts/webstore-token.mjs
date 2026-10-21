// Mints a Chrome Web Store refresh token for the Google account that owns the extension,
// through the loopback flow a Desktop OAuth client expects. Run it once per client:
//
//   node scripts/webstore-token.mjs <client-json> <out-file>
//
// <client-json> is the file the Cloud console downloads when the Desktop OAuth client is
// created; <out-file> receives the refresh token and nothing else. The token is never
// printed, so it can go straight into a secret:
//
//   gh secret set CWS_REFRESH_TOKEN < <out-file>
//
// The consent screen must be published ("In production"): in "Testing" Google revokes the
// refresh token after 7 days, which breaks the next release rather than this one.
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";

const SCOPE = "https://www.googleapis.com/auth/chromewebstore";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const [clientFile, outFile] = process.argv.slice(2);
if (!clientFile || !outFile) {
  console.error("usage: node scripts/webstore-token.mjs <client-json> <out-file>");
  process.exit(1);
}

const { installed } = JSON.parse(readFileSync(clientFile, "utf8"));
if (!installed?.client_id) {
  console.error("that file has no `installed` client: download it from the OAuth client in the Cloud console");
  process.exit(1);
}

/** The code comes back on a loopback port; a Desktop client accepts any port on 127.0.0.1. */
const server = createServer();
server.listen(0, "127.0.0.1", () => {
  const redirect = `http://127.0.0.1:${server.address().port}`;
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: installed.client_id,
    redirect_uri: redirect,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline", // without this Google returns no refresh token
    prompt: "consent", // force one, even if this account has approved before
  }).toString();
  console.log(`open this and approve:\n${url}`);
});

server.on("request", async (req, res) => {
  const { searchParams } = new URL(req.url, "http://127.0.0.1");
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // The browser also asks for /favicon.ico and may prefetch: anything that carries
  // neither a code nor an error is not the redirect, so keep waiting for the real one.
  if (!code && !error) {
    res.writeHead(404).end();
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(code ? "Approved. You can close this tab." : `Consent failed: ${error}`);
  if (!code) {
    console.error(`consent failed: ${error}`);
    process.exit(1);
  }

  const answer = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: installed.client_id,
      client_secret: installed.client_secret,
      redirect_uri: `http://127.0.0.1:${server.address().port}`,
      grant_type: "authorization_code",
    }),
  }).then((r) => r.json().catch(() => ({})));

  if (!answer.refresh_token) {
    console.error(`no refresh token came back: ${answer.error ?? ""} ${answer.error_description ?? ""}`);
    process.exit(1);
  }
  writeFileSync(outFile, answer.refresh_token);
  console.log(`refresh token written to ${outFile} (${answer.refresh_token.length} characters, not shown)`);
  server.close();
  process.exit(0);
});
