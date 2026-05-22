/**
 * Medusa v2 Admin API coverage tool.
 * Provides additive access to newer Admin API resources while preserving the
 * legacy domain-specific tools.
 */

import { buildMedusaUrl, makeRequest } from "../../lib/medusa-client.js";

const RESOURCE_PATHS = {
  auth: "/auth",
  currencies: "/admin/currencies",
  feature_flags: "/admin/feature-flags",
  index: "/admin/index",
  locales: "/admin/locales",
  notifications: "/admin/notifications",
  price_preferences: "/admin/price-preferences",
  property_labels: "/admin/property-labels",
  refund_reasons: "/admin/refund-reasons",
  return_reasons: "/admin/return-reasons",
  shipping_option_types: "/admin/shipping-option-types",
  stores: "/admin/stores",
  store_credit_accounts: "/admin/store-credit-accounts",
  tax_providers: "/admin/tax-providers",
  translations: "/admin/translations",
  uploads: "/admin/uploads",
  views: "/admin/views",
  workflow_executions: "/admin/workflows-executions",
};

function resolveResourcePath(resource, id) {
  const basePath = RESOURCE_PATHS[resource];
  if (!basePath) {
    throw new Error(`Unsupported resource: ${resource}`);
  }
  return id ? `${basePath}/${encodeURIComponent(id)}` : basePath;
}

function assertAdminPath(path) {
  if (!path.startsWith("/admin/") && !path.startsWith("/auth")) {
    throw new Error("Custom requests are restricted to /admin/* and /auth* paths");
  }
}

async function executeFunction(args = {}) {
  const {
    action,
    resource,
    id,
    method = "GET",
    path,
    query = {},
    body,
    headers = {},
  } = args;

  switch (action) {
    case "list": {
      const url = buildMedusaUrl(resolveResourcePath(resource), query);
      return await makeRequest(url, { method: "GET", headers });
    }
    case "get": {
      if (!id) {
        return { error: "id is required for get actions." };
      }
      const url = buildMedusaUrl(resolveResourcePath(resource, id), query);
      return await makeRequest(url, { method: "GET", headers });
    }
    case "request": {
      if (!path) {
        return { error: "path is required for request actions." };
      }
      assertAdminPath(path);
      const url = buildMedusaUrl(path, query);
      const request = {
        method: method.toUpperCase(),
        headers,
      };
      if (body !== undefined && request.method !== "GET") {
        request.body = JSON.stringify(body);
      }
      return await makeRequest(url, request);
    }
    default:
      return { error: `Invalid action: ${action}. Valid actions are: list, get, request` };
  }
}

const apiTool = {
  definition: {
    name: "manage_medusa_admin_v2",
    description: "Additive Medusa v2 Admin API tool for newer resources such as MFA/auth routes, store credit accounts, translations, uploads, views, workflow executions, stores, currencies, price preferences, and other v2.15 Admin API areas.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "get", "request"],
          description: "Use list/get for known v2 resources, or request for an explicit /admin/* or /auth* endpoint.",
        },
        resource: {
          type: "string",
          enum: Object.keys(RESOURCE_PATHS),
          description: "Known Medusa v2 Admin API resource for list/get actions.",
        },
        id: {
          type: "string",
          description: "Resource ID for get actions.",
        },
        method: {
          type: "string",
          enum: ["GET", "POST", "PATCH", "DELETE"],
          description: "HTTP method for request actions. Defaults to GET.",
        },
        path: {
          type: "string",
          description: "Explicit path for request actions. Restricted to /admin/* and /auth*.",
        },
        query: {
          type: "object",
          description: "Query parameters. Arrays and objects are serialized using Medusa v2 conventions.",
        },
        body: {
          type: "object",
          description: "JSON request body for POST, PATCH, and DELETE request actions.",
        },
        headers: {
          type: "object",
          description: "Additional request headers, such as x-no-compression.",
        },
      },
      required: ["action"],
    },
  },
  function: executeFunction,
};

export { apiTool };
