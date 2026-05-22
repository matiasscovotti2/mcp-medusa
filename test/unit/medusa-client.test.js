import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  appendQueryParam,
  createHeaders,
  createQueryParams,
  makeRequest,
  MedusaClientError,
} from "../../lib/medusa-client.js";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  globalThis.fetch = ORIGINAL_FETCH;
});

test("createHeaders uses raw Basic token for Medusa v2 API keys by default", () => {
  process.env.MEDUSA_AUTH_TYPE = "api-key";
  process.env.MEDUSA_API_KEY = "sk_test";
  delete process.env.MEDUSA_API_KEY_BASE64;

  assert.equal(createHeaders().Authorization, "Basic sk_test");
});

test("createHeaders preserves base64 compatibility when requested", () => {
  process.env.MEDUSA_AUTH_TYPE = "api-key";
  process.env.MEDUSA_API_KEY = "sk_test";
  process.env.MEDUSA_API_KEY_BASE64 = "true";

  assert.equal(createHeaders().Authorization, "Basic c2tfdGVzdDo=");
});

test("createHeaders supports JWT auth", () => {
  process.env.MEDUSA_AUTH_TYPE = "jwt";
  process.env.MEDUSA_JWT = "jwt_token";

  assert.equal(createHeaders().Authorization, "Bearer jwt_token");
});

test("createHeaders supports session cookie auth", () => {
  process.env.MEDUSA_AUTH_TYPE = "session";
  process.env.MEDUSA_SESSION_COOKIE = "connect.sid=s%3Aabc";

  assert.equal(createHeaders().Cookie, "connect.sid=s%3Aabc");
});

test("createQueryParams serializes arrays and objects with Medusa v2 conventions", () => {
  const params = createQueryParams({
    fields: "*variants,metadata",
    order: "-created_at",
    category_id: ["pcat_1", "pcat_2"],
    created_at: { gte: "2026-01-01", lte: "2026-01-31" },
  });

  assert.deepEqual([...params.entries()], [
    ["fields", "*variants,metadata"],
    ["order", "-created_at"],
    ["category_id[]", "pcat_1"],
    ["category_id[]", "pcat_2"],
    ["created_at[gte]", "2026-01-01"],
    ["created_at[lte]", "2026-01-31"],
  ]);
});

test("appendQueryParam skips empty values", () => {
  const params = new URLSearchParams();
  appendQueryParam(params, "q", "");
  appendQueryParam(params, "limit", 20);

  assert.equal(params.toString(), "limit=20");
});

test("makeRequest exposes status and response body on HTTP errors", async () => {
  process.env.MEDUSA_AUTH_TYPE = "api-key";
  process.env.MEDUSA_API_KEY = "sk_test";
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Nope" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });

  await assert.rejects(
    () => makeRequest("https://example.test/admin/orders"),
    (error) => {
      assert.ok(error instanceof MedusaClientError);
      assert.equal(error.status, 401);
      assert.equal(error.body, '{"message":"Nope"}');
      assert.equal(error.url, "https://example.test/admin/orders");
      return true;
    },
  );
});
