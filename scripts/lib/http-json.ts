function bodyPreview(text: string, limit = 280): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "<empty>";
  }

  return compact.length > limit
    ? `${compact.slice(0, limit)}...`
    : compact;
}

function buildHint(contentType: string, text: string): string | null {
  const preview = bodyPreview(text);

  if (
    contentType.includes("text/html") ||
    /cloudflare error|worker threw exception|error 1101/i.test(preview)
  ) {
    return "hint=received HTML error content; the upstream Worker likely threw before returning JSON";
  }

  if (!contentType.includes("application/json")) {
    return "hint=response content-type was not JSON";
  }

  return null;
}

function buildErrorMessage(args: {
  method: string;
  path: string;
  status: number;
  statusText: string;
  contentType: string;
  cfRay: string;
  server: string;
  text: string;
  parseStage: "http" | "parse";
}): string {
  const lines = [
    `${args.method} ${args.path} failed during ${args.parseStage}`,
    `status=${args.status} ${args.statusText}`.trim(),
    `content-type=${args.contentType || "<missing>"}`,
  ];

  if (args.cfRay) {
    lines.push(`cf-ray=${args.cfRay}`);
  }

  if (args.server) {
    lines.push(`server=${args.server}`);
  }

  const hint = buildHint(args.contentType, args.text);
  if (hint) {
    lines.push(hint);
  }

  lines.push(`body-preview=${bodyPreview(args.text)}`);
  return lines.join("\n");
}

export async function fetchJson(baseUrl: string, path: string): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const cfRay = response.headers.get("cf-ray") || "";
  const server = response.headers.get("server") || "";

  if (!response.ok) {
    throw new Error(
      buildErrorMessage({
        method: "GET",
        path,
        status: response.status,
        statusText: response.statusText,
        contentType,
        cfRay,
        server,
        text,
        parseStage: "http",
      }),
    );
  }

  if (!contentType.includes("application/json")) {
    throw new Error(
      buildErrorMessage({
        method: "GET",
        path,
        status: response.status,
        statusText: response.statusText,
        contentType,
        cfRay,
        server,
        text,
        parseStage: "parse",
      }),
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      buildErrorMessage({
        method: "GET",
        path,
        status: response.status,
        statusText: response.statusText,
        contentType,
        cfRay,
        server,
        text,
        parseStage: "parse",
      }),
    );
  }
}

export async function httpPost(
  url: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const cfRay = response.headers.get("cf-ray") || "";
  const server = response.headers.get("server") || "";
  const path = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();

  if (!response.ok) {
    throw new Error(
      buildErrorMessage({
        method: "POST",
        path,
        status: response.status,
        statusText: response.statusText,
        contentType,
        cfRay,
        server,
        text,
        parseStage: "http",
      }),
    );
  }

  if (!contentType.includes("application/json")) {
    throw new Error(
      buildErrorMessage({
        method: "POST",
        path,
        status: response.status,
        statusText: response.statusText,
        contentType,
        cfRay,
        server,
        text,
        parseStage: "parse",
      }),
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      buildErrorMessage({
        method: "POST",
        path,
        status: response.status,
        statusText: response.statusText,
        contentType,
        cfRay,
        server,
        text,
        parseStage: "parse",
      }),
    );
  }
}