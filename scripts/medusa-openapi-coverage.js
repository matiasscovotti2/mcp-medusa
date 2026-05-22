#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { toolPaths } from "../tools/paths.js";

const OPENAPI_URL = process.env.MEDUSA_OPENAPI_URL || "https://docs.medusajs.com/api/download/admin";

function extractOpenApiPaths(yaml) {
  return [...yaml.matchAll(/^  (\/admin\/[^:]+):/gm)].map((match) => match[1]).sort();
}

function extractOpenApiTags(yaml) {
  return [...yaml.matchAll(/^  - name: (.+)$/gm)].map((match) => match[1]).sort();
}

function normalizeRepoPath(pathLiteral) {
  return pathLiteral
    .replace(/\$\{args\.[^}]+\}/g, "{id}")
    .replace(/\$\{[^}]+\}/g, "{id}")
    .replace(/`|'|"/g, "");
}

function extractRepoPaths() {
  const paths = new Set();

  for (const relativePath of toolPaths) {
    const fullPath = path.join(process.cwd(), "tools", relativePath);
    const source = fs.readFileSync(fullPath, "utf8");
    for (const match of source.matchAll(/\/admin\/[^`"'?\s)]+/g)) {
      paths.add(normalizeRepoPath(match[0]));
    }
  }

  return [...paths].sort();
}

async function getToolNames() {
  const tools = [];
  for (const relativePath of toolPaths) {
    const moduleUrl = pathToFileURL(path.join(process.cwd(), "tools", relativePath)).href;
    const mod = await import(moduleUrl);
    if (mod.apiTool?.definition?.name) {
      tools.push(mod.apiTool.definition.name);
    }
  }
  return tools.sort();
}

async function main() {
  const response = await fetch(OPENAPI_URL, {
    headers: {
      Accept: "application/x-yaml,text/yaml,*/*",
      "User-Agent": "mcp-medusa-coverage",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download OpenAPI spec: HTTP ${response.status}`);
  }

  const yaml = await response.text();
  const openApiPaths = extractOpenApiPaths(yaml);
  const openApiTags = extractOpenApiTags(yaml);
  const repoPaths = extractRepoPaths();
  const repoPathSet = new Set(repoPaths);
  const tools = await getToolNames();
  const missingPathSamples = openApiPaths
    .filter((openPath) => !repoPathSet.has(openPath.replace(/\{[^}]+\}/g, "{id}")))
    .slice(0, 50);

  const report = {
    source: OPENAPI_URL,
    openApiPathCount: openApiPaths.length,
    openApiTags,
    toolCount: tools.length,
    tools,
    repoPathCount: repoPaths.length,
    repoPaths,
    missingPathSamples,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
