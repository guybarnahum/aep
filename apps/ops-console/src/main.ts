import { getApiBaseUrl, getRun, getRuns } from "./api";
import { renderRunDetail, renderRunsList, renderToolbar } from "./render";
import type { RunSummary } from "./types";
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

function getSelectedTenant(): string {
  return window.localStorage.getItem("ops-console.tenant-filter") ?? "";
}

function setSelectedTenant(value: string): void {
  window.localStorage.setItem("ops-console.tenant-filter", value);
}

function getSelectedService(): string {
  return window.localStorage.getItem("ops-console.service-filter") ?? "";
}

function setSelectedService(value: string): void {
  window.localStorage.setItem("ops-console.service-filter", value);
}

function getAutoRefreshEnabled(): boolean {
  return window.localStorage.getItem("ops-console.auto-refresh") === "true";
}

function setAutoRefreshEnabled(value: boolean): void {
  window.localStorage.setItem("ops-console.auto-refresh", String(value));
}

function renderShell(content: string, error?: string): void {
  app.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <div>
          <h1>AEP Ops Console</h1>
          <p class="muted">Internal infra-company operations surface.</p>
        </div>
        <div class="muted">API: ${getApiBaseUrl()}</div>
      </header>

      ${error ? `<div class="error-banner">${error}</div>` : ""}

      ${content}
    </div>
  `;
}

function getRoute(): { kind: "runs" } | { kind: "run"; runId: string } {
  const hash = window.location.hash.replace(/^#/, "");

  if (!hash) {
    return { kind: "runs" };
  }

  const parts = hash.split("/");
  if (parts[0] === "run" && parts[1]) {
    return { kind: "run", runId: decodeURIComponent(parts[1]) };
  }

  return { kind: "runs" };
}

function attachToolbarHandlers(): void {
  const refreshButton = document.querySelector<HTMLButtonElement>("#refresh-button");
  const autoRefreshToggle =
    document.querySelector<HTMLInputElement>("#auto-refresh-toggle");
  const tenantFilter = document.querySelector<HTMLSelectElement>("#tenant-filter");
  const serviceFilter = document.querySelector<HTMLSelectElement>("#service-filter");

  refreshButton?.addEventListener("click", () => {
    void renderRoute();
  });

  autoRefreshToggle?.addEventListener("change", () => {
    setAutoRefreshEnabled(autoRefreshToggle.checked);
    syncAutoRefresh();
  });

  tenantFilter?.addEventListener("change", () => {
    setSelectedTenant(tenantFilter.value);
    void renderRoute();
  });

  serviceFilter?.addEventListener("change", () => {
    setSelectedService(serviceFilter.value);
    void renderRoute();
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

function filterRuns(runs: RunSummary[]): RunSummary[] {
  const tenant = getSelectedTenant();
  const service = getSelectedService();

  return runs.filter((run) => {
    if (tenant && run.tenant_id !== tenant) {
      return false;
    }

    if (service && run.service_name !== service) {
      return false;
    }

    return true;
  });
}

async function renderRoute(): Promise<void> {
  renderShell(`<div class="loading">Loading…</div>`);

  try {
    const route = getRoute();

    if (route.kind === "run") {
      const detail = await getRun(route.runId);
      renderShell(renderRunDetail(detail, getApiBaseUrl()));
      syncAutoRefresh();
      return;
    }

    const runs = await getRuns(50);
    const filteredRuns = filterRuns(runs);
    const tenants = [...new Set(runs.map((run) => run.tenant_id))].sort();
    const services = [...new Set(runs.map((run) => run.service_name))].sort();

    const toolbar = renderToolbar({
      selectedTenant: getSelectedTenant(),
      selectedService: getSelectedService(),
      autoRefresh: getAutoRefreshEnabled(),
      tenants,
      services,
    });

    renderShell(toolbar + renderRunsList(filteredRuns));
    attachToolbarHandlers();
    syncAutoRefresh();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown UI error";
    renderShell(`<div class="loading">Unable to load view.</div>`, message);
    syncAutoRefresh();
  }
}

window.addEventListener("hashchange", () => {
  void renderRoute();
});

void renderRoute();
