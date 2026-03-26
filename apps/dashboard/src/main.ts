import {
  getApiBaseUrl,
  getDepartmentOverview,
  getOperatorAgentBaseUrl,
  getServiceOverview,
  getTenantOverview,
  getTenants,
} from "./api";
import {
  renderDepartmentOverview,
  renderPrimaryNav,
  renderServiceOverview,
  renderTenantOverview,
  renderTenantSelector,
  renderToolbar,
} from "./render";
import "./styles.css";

const app: HTMLDivElement = (() => {
  const node = document.querySelector<HTMLDivElement>("#app");
  if (!node) {
    throw new Error("App root not found");
  }
  return node;
})();

const AUTO_REFRESH_MS = 15_000;
let autoRefreshTimer: number | null = null;

type Route =
  | { kind: "tenant"; tenantId: string }
  | { kind: "service"; tenantId: string; serviceId: string }
  | { kind: "department" };

function getAutoRefreshEnabled(): boolean {
  return window.localStorage.getItem("dashboard.auto-refresh") === "true";
}

function setAutoRefreshEnabled(value: boolean): void {
  window.localStorage.setItem("dashboard.auto-refresh", String(value));
}

function getRoute(defaultTenantId: string): Route {
  const hash = window.location.hash.replace(/^#/, "");

  if (!hash) {
    return { kind: "tenant", tenantId: defaultTenantId };
  }

  if (hash === "department") {
    return { kind: "department" };
  }

  const parts = hash.split("/");

  if (parts[0] === "tenant" && parts[1] && parts[2] === "service" && parts[3]) {
    return {
      kind: "service",
      tenantId: decodeURIComponent(parts[1]),
      serviceId: decodeURIComponent(parts[3]),
    };
  }

  if (parts[0] === "tenant" && parts[1]) {
    return {
      kind: "tenant",
      tenantId: decodeURIComponent(parts[1]),
    };
  }

  return { kind: "tenant", tenantId: defaultTenantId };
}

function renderShell(content: string, error?: string): void {
  app.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <div>
          <h1>AEP Dashboard</h1>
          <p class="muted">Tenant view plus operator governance view.</p>
        </div>
        <div class="endpoint-stack muted">
          <div>Control plane: ${getApiBaseUrl()}</div>
          <div>Operator agent: ${getOperatorAgentBaseUrl()}</div>
        </div>
      </header>

      ${error ? `<div class="error-banner">${error}</div>` : ""}

      ${content}
    </div>
  `;
}

function attachToolbarHandlers(): void {
  const refreshButton = document.querySelector<HTMLButtonElement>("#refresh-button");
  const autoRefreshToggle =
    document.querySelector<HTMLInputElement>("#auto-refresh-toggle");

  refreshButton?.addEventListener("click", () => {
    void renderRoute();
  });

  autoRefreshToggle?.addEventListener("change", () => {
    setAutoRefreshEnabled(autoRefreshToggle.checked);
    syncAutoRefresh();
  });
}

function syncAutoRefresh(): void {
  if (autoRefreshTimer !== null) {
    window.clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }

  if (!getAutoRefreshEnabled()) {
    return;
  }

  autoRefreshTimer = window.setInterval(() => {
    void renderRoute();
  }, AUTO_REFRESH_MS);
}

async function renderRoute(): Promise<void> {
  renderShell(`<div class="loading">Loading…</div>`);

  try {
    const defaultTenantId = "internal";
    const route = getRoute(defaultTenantId);

    let content = renderToolbar({
      autoRefresh: getAutoRefreshEnabled(),
    });

    content += renderPrimaryNav({
      activeView: route.kind === "department" ? "department" : "tenant",
      tenantHref:
        route.kind === "department"
          ? "#tenant/internal"
          : `#tenant/${encodeURIComponent(route.tenantId)}`,
    });

    if (route.kind === "department") {
      const overview = await getDepartmentOverview();
      content += renderDepartmentOverview(overview);
    } else {
      const tenants = await getTenants();
      const resolvedDefaultTenantId = tenants[0]?.tenant_id ?? defaultTenantId;
      const resolvedRoute =
        window.location.hash === ""
          ? ({ kind: "tenant", tenantId: resolvedDefaultTenantId } as Route)
          : route;

      content += renderTenantSelector(
        tenants,
        resolvedRoute.kind === "service"
          ? resolvedRoute.tenantId
          : resolvedRoute.tenantId,
      );

      if (resolvedRoute.kind === "service") {
        const overview = await getServiceOverview(
          resolvedRoute.tenantId,
          resolvedRoute.serviceId,
        );
        content += renderServiceOverview(overview);
      } else {
        const overview = await getTenantOverview(resolvedRoute.tenantId);
        content += renderTenantOverview(overview);
      }
    }

    renderShell(content);
    attachToolbarHandlers();
    syncAutoRefresh();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown UI error";
    renderShell(`<div class="loading">Unable to load dashboard.</div>`, message);
    syncAutoRefresh();
  }
}

window.addEventListener("hashchange", () => {
  void renderRoute();
});

void renderRoute();
