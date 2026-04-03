function withCors(headers?: HeadersInit): Headers {
  const next = new Headers(headers);

  if (!next.has("access-control-allow-origin")) {
    next.set("access-control-allow-origin", "*");
  }

  if (!next.has("access-control-allow-methods")) {
    next.set("access-control-allow-methods", "GET,POST,OPTIONS");
  }

  if (!next.has("access-control-allow-headers")) {
    next.set("access-control-allow-headers", "content-type,authorization");
  }

  if (!next.has("access-control-max-age")) {
    next.set("access-control-max-age", "86400");
  }

  return next;
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = withCors(init.headers);

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  if (!headers.has("cache-control")) {
    headers.set("cache-control", "no-store");
  }

  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers,
  });
}

export function notFound(message: string): Response {
  return json(
    {
      error: "not_found",
      message,
    },
    { status: 404 },
  );
}

export function corsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: withCors(),
  });
}

export function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

type RuntimeReadFailureInjectionEnv = {
  APP_ENV?: string;
  VALIDATION_LANE?: string;
  RUNTIME_READ_FAILURE_INJECTION_ENABLED?: string;
};

export function maybeInjectRuntimeReadFailure(
  request: Request,
  env: RuntimeReadFailureInjectionEnv,
): void {
  if (env.APP_ENV !== "dev") {
    return;
  }

  if (env.VALIDATION_LANE !== "async_validation") {
    return;
  }

  if (env.RUNTIME_READ_FAILURE_INJECTION_ENABLED !== "true") {
    return;
  }

  if (new URL(request.url).searchParams.get("fail") !== "1") {
    return;
  }

  throw new Error("forced_runtime_read_failure");
}

type RuntimeRouteErrorArgs = {
  route: string;
  error: unknown;
  method?: string | null;
  tenantId?: string | null;
  serviceId?: string | null;
  runId?: string | null;
  resourceId?: string | null;
  companyId?: string | null;
  teamId?: string | null;
  employeeId?: string | null;
};

export function runtimeRouteError(args: RuntimeRouteErrorArgs): Response {
  const message =
    args.error instanceof Error ? args.error.message : String(args.error);

  return json(
    {
      error: "runtime_projection_failed",
      route: args.route,
      method: args.method ?? null,
      tenant_id: args.tenantId ?? null,
      service_id: args.serviceId ?? null,
      run_id: args.runId ?? null,
      resource_id: args.resourceId ?? null,
      company_id: args.companyId ?? null,
      team_id: args.teamId ?? null,
      employee_id: args.employeeId ?? null,
      message,
    },
    { status: 500 },
  );
}

type RuntimeBoundaryArgs = {
  route: string;
  request?: Request;
  handler: () => Promise<Response>;
  tenantId?: string | null;
  serviceId?: string | null;
  runId?: string | null;
  resourceId?: string | null;
  companyId?: string | null;
  teamId?: string | null;
  employeeId?: string | null;
};

export async function withRuntimeJsonBoundary(
  args: RuntimeBoundaryArgs,
): Promise<Response> {
  try {
    return await args.handler();
  } catch (error) {
    console.error("runtime route failure", {
      route: args.route,
      method: args.request?.method ?? null,
      tenantId: args.tenantId ?? null,
      serviceId: args.serviceId ?? null,
      runId: args.runId ?? null,
      resourceId: args.resourceId ?? null,
      companyId: args.companyId ?? null,
      teamId: args.teamId ?? null,
      employeeId: args.employeeId ?? null,
      message: error instanceof Error ? error.message : String(error),
    });

    return runtimeRouteError({
      route: args.route,
      error,
      method: args.request?.method ?? null,
      tenantId: args.tenantId ?? null,
      serviceId: args.serviceId ?? null,
      runId: args.runId ?? null,
      resourceId: args.resourceId ?? null,
      companyId: args.companyId ?? null,
      teamId: args.teamId ?? null,
      employeeId: args.employeeId ?? null,
    });
  }
}