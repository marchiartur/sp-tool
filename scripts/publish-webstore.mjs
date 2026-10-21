// Uploads a release zip to the Chrome Web Store and submits it for review, through the
// Chrome Web Store API v2. (The v1.1 API, and the expiring OAuth refresh token it needed,
// stopped being supported on 15 October 2026.)
//
// Auth is a refresh token for the Google account that owns the item, so it carries that
// account's own access and needs no further grant. (A service account would need adding
// to a publisher in the Developer Dashboard, which an individual account has no page for.)
// release.yml runs this after it publishes the GitHub release, and skips it while
// CWS_PUBLISHER_ID is unset.
//
//   node scripts/publish-webstore.mjs sp-tool-27-v1.1.0.zip   upload and submit
//   node scripts/publish-webstore.mjs --status                 read the listing, change nothing
//   node scripts/publish-webstore.mjs --upload-only <zip>      upload, don't submit for review
//
// --status and --upload-only are for checking the credentials before a tag: --status only
// reads, and an upload on its own leaves a draft in the dashboard that no one else sees
// until something submits it.
//
// Env:
//   CWS_REFRESH_TOKEN         a refresh token for the owning account (scripts/webstore-token.mjs)
//   CWS_CLIENT_ID             the Desktop OAuth client it was minted against
//   CWS_CLIENT_SECRET         that client's secret
//   CWS_PUBLISHER_ID          Developer Dashboard > Publisher > Settings
//   CWS_EXTENSION_ID          the item to update; the API can't create one
//   CWS_PUBLISH_TYPE          optional: STAGED_PUBLISH holds the approved item for a
//                             manual publish. Default DEFAULT_PUBLISH goes live on approval.
import { readFileSync } from "node:fs";

const API = "https://chromewebstore.googleapis.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000; // the store unpacks big zips asynchronously
const POLL_MS = 5000;

const args = process.argv.slice(2);
const statusOnly = args.includes("--status");
const uploadOnly = args.includes("--upload-only");
const zipPath = args.find((a) => !a.startsWith("--"));
if (!zipPath && !statusOnly) die("usage: node scripts/publish-webstore.mjs [--status|--upload-only] <zip>");

const publisher = need("CWS_PUBLISHER_ID");
const extension = need("CWS_EXTENSION_ID");
const publishType = process.env.CWS_PUBLISH_TYPE || "DEFAULT_PUBLISH";
const item = `publishers/${publisher}/items/${extension}`;

// The version the zip was built from, to check the store received the package we meant.
const { version } = JSON.parse(readFileSync("extension-static/manifest.json", "utf8"));

function need(name) {
  const value = process.env[name];
  if (!value) die(`${name} is not set`);
  return value;
}

/** Messages never carry the key or the token: only the status and the API's own reply. */
function die(message) {
  console.error(`webstore: ${message}`);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- auth ----------
// A refresh token minted while the OAuth consent screen is in "Testing" is revoked after
// 7 days, so the consent screen must be published before the token is worth keeping.
// scripts/webstore-token.mjs mints one.
async function accessToken() {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: need("CWS_REFRESH_TOKEN"),
      client_id: need("CWS_CLIENT_ID"),
      client_secret: need("CWS_CLIENT_SECRET"),
    }),
  });
  const answer = await res.json().catch(() => ({}));
  // invalid_grant usually means the token was revoked: a consent screen left in "Testing",
  // the account's password changed, or the token went six months unused.
  if (!res.ok || !answer.access_token) die(`couldn't get an access token (${res.status} ${answer.error ?? ""})`);
  return answer.access_token;
}

// ---------- the API ----------
async function api(url, token, { method = "GET", body, contentType } = {}) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(contentType && { "Content-Type": contentType }) },
    body,
  });
  const text = await res.text();
  if (!res.ok) die(`${method} ${url.replace(API, "")} failed (${res.status}): ${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : {};
}

const inProgress = (state) => String(state).includes("IN_PROGRESS");

/** The upload can finish after the request does; fetchStatus reports how it went. */
async function waitForUpload(token) {
  const until = Date.now() + UPLOAD_TIMEOUT_MS;
  while (Date.now() < until) {
    await sleep(POLL_MS);
    const status = await api(`${API}/v2/${item}:fetchStatus`, token);
    const state = status.lastAsyncUploadState;
    if (!state || inProgress(state)) continue;
    if (!String(state).includes("SUCCEEDED")) die(`the store rejected the package (${state})`);
    return;
  }
  die("the store was still unpacking the package after 10 minutes");
}

/** What the store holds right now: the live revision, and anything waiting on review. */
function describe(label, revision) {
  if (!revision) return console.log(`webstore: ${label}: none`);
  const where = (revision.distributionChannels ?? [])
    .map((c) => `v${c.crxVersion ?? "?"} at ${c.deployPercentage ?? 100}%`)
    .join(", ");
  console.log(`webstore: ${label}: ${revision.state ?? "?"}${where ? ` (${where})` : ""}`);
}

const token = await accessToken();

if (statusOnly) {
  const status = await api(`${API}/v2/${item}:fetchStatus`, token);
  console.log(`webstore: ${status.itemId ?? extension} as ${publisher}`);
  describe("published", status.publishedItemRevisionStatus);
  describe("submitted", status.submittedItemRevisionStatus);
  if (status.takenDown) console.log("webstore: this item has been taken down");
  if (status.warned) console.log("webstore: this item has been warned");
  console.log(`webstore: the manifest here says v${version}`);
  process.exit(0);
}

const zip = readFileSync(zipPath);

console.log(`webstore: uploading ${zipPath} (${zip.length} bytes) to ${extension}`);
const upload = await api(`${API}/upload/v2/${item}:upload?uploadType=media`, token, {
  method: "POST",
  body: zip,
  contentType: "application/zip",
});
if (inProgress(upload.uploadState)) await waitForUpload(token);
else if (upload.crxVersion && upload.crxVersion !== version)
  die(`the store read version ${upload.crxVersion} from the zip, but the manifest here says ${version}`);

if (uploadOnly) {
  console.log(`webstore: uploaded v${version} as a draft; nothing was submitted for review`);
  process.exit(0);
}

console.log(`webstore: submitting for review (${publishType})`);
const published = await api(`${API}/v2/${item}:publish`, token, {
  method: "POST",
  body: JSON.stringify({ publishType }),
  contentType: "application/json",
});
for (const w of published.warningInfo?.warnings ?? []) console.log(`webstore: warning: ${w.reason} ${w.description ?? ""}`);
console.log(`webstore: v${version} is ${published.state ?? "submitted"}`);
