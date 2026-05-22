import { Buffer } from "buffer";

const DEFAULT_MEDUSA_BASE_URL = "http://localhost:9000";

export class MedusaClientError extends Error {
  constructor(message, { status, body, url } = {}) {
    super(message);
    this.name = "MedusaClientError";
    this.status = status;
    this.body = body;
    this.url = url;
  }
}

export function normalizeBaseUrl(url = DEFAULT_MEDUSA_BASE_URL) {
  return String(url || DEFAULT_MEDUSA_BASE_URL).replace(/\/+$/, "");
}

export function getMedusaAuthConfig(env = process.env) {
  const authType = (env.MEDUSA_AUTH_TYPE || "api-key").toLowerCase();
  const apiKey = env.MEDUSA_API_KEY;
  const jwt = env.MEDUSA_JWT || env.MEDUSA_API_KEY;
  const sessionCookie = env.MEDUSA_SESSION_COOKIE || env.MEDUSA_COOKIE;

  return {
    authType,
    apiKey,
    jwt,
    sessionCookie,
    encodeApiKey: String(env.MEDUSA_API_KEY_BASE64 || "").toLowerCase() === "true",
  };
}

export function createHeaders(_legacyApiKey, extraHeaders = {}) {
  const config = getMedusaAuthConfig();
  const headers = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  if (config.authType === "jwt") {
    if (!config.jwt) {
      throw new Error("MEDUSA_JWT or MEDUSA_API_KEY is required when MEDUSA_AUTH_TYPE=jwt");
    }
    headers.Authorization = `Bearer ${config.jwt.replace(/^Bearer\s+/i, "")}`;
    return headers;
  }

  if (config.authType === "session") {
    if (!config.sessionCookie) {
      throw new Error("MEDUSA_SESSION_COOKIE is required when MEDUSA_AUTH_TYPE=session");
    }
    headers.Cookie = config.sessionCookie;
    return headers;
  }

  if (config.authType !== "api-key") {
    throw new Error("MEDUSA_AUTH_TYPE must be one of: api-key, jwt, session");
  }

  if (!config.apiKey) {
    throw new Error("MEDUSA_API_KEY is required when MEDUSA_AUTH_TYPE=api-key");
  }

  const token = config.encodeApiKey
    ? Buffer.from(`${config.apiKey}:`).toString("base64")
    : config.apiKey;
  headers.Authorization = `Basic ${token.replace(/^Basic\s+/i, "")}`;
  return headers;
}

export function appendQueryParam(params, key, value) {
  if (value === undefined || value === null || value === "") return;

  if (Array.isArray(value)) {
    value.forEach((entry) => appendQueryParam(params, `${key}[]`, entry));
    return;
  }

  if (value instanceof Date) {
    params.append(key, value.toISOString());
    return;
  }

  if (typeof value === "object") {
    Object.entries(value).forEach(([childKey, childValue]) => {
      appendQueryParam(params, `${key}[${childKey}]`, childValue);
    });
    return;
  }

  params.append(key, String(value));
}

export function createQueryParams(query = {}, { exclude = [] } = {}) {
  const params = new URLSearchParams();
  const excluded = new Set(exclude);

  Object.entries(query).forEach(([key, value]) => {
    if (!excluded.has(key)) {
      appendQueryParam(params, key, value);
    }
  });

  return params;
}

export function buildMedusaUrl(path, query = {}, options = {}) {
  const baseUrl = normalizeBaseUrl(process.env.MEDUSA_BASE_URL);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);
  const params = createQueryParams(query, options);

  for (const [key, value] of params.entries()) {
    url.searchParams.append(key, value);
  }

  return url.toString();
}

export async function makeRequest(url, options = {}) {
  const headers = {
    ...createHeaders(),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const bodyText = await response.text();

  if (!response.ok) {
    throw new MedusaClientError(`HTTP ${response.status}: ${bodyText}`, {
      status: response.status,
      body: bodyText,
      url,
    });
  }

  if (!bodyText || response.status === 204) {
    return {};
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return JSON.parse(bodyText);
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
}

export function hasMedusaCredentials(env = process.env) {
  const { authType, apiKey, jwt, sessionCookie } = getMedusaAuthConfig(env);
  if (authType === "jwt") return Boolean(jwt);
  if (authType === "session") return Boolean(sessionCookie);
  return Boolean(apiKey);
}

export function missingCredentialsMessage(env = process.env) {
  const { authType } = getMedusaAuthConfig(env);
  if (authType === "jwt") {
    return "Medusa credentials not configured. Please set MEDUSA_AUTH_TYPE=jwt and MEDUSA_JWT or MEDUSA_API_KEY.";
  }
  if (authType === "session") {
    return "Medusa credentials not configured. Please set MEDUSA_AUTH_TYPE=session and MEDUSA_SESSION_COOKIE.";
  }
  return "Medusa credentials not configured. Please set MEDUSA_BASE_URL and MEDUSA_API_KEY environment variables.";
}
