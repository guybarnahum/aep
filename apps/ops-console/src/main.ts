import { getApiBaseUrl, getRun, getRuns } from "./api";
import { renderRunDetail, renderRunsList } from "./render";
import "./styles.css";

const root: HTMLDivElement = (() => {
  const node = document.querySelector<HTMLDivElement>("#app");
  if (!node) {
    throw new Error("App root not found");
  }
  return node;
})();

function renderShell(content: string, error?: string): void {
  root.innerHTML = `
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

async function renderRoute(): Promise<void> {
  renderShell(`<div class="loading">Loading…</div>`);

  try {
    const route = getRoute();

    if (route.kind === "run") {
      const detail = await getRun(route.runId);
      renderShell(renderRunDetail(detail, getApiBaseUrl()));
      return;
    }

    const runs = await getRuns(50);
    renderShell(renderRunsList(runs));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown UI error";
    renderShell(`<div class="loading">Unable to load view.</div>`, message);
  }
}

window.addEventListener("hashchange", () => {
  void renderRoute();
});

void renderRoute();
