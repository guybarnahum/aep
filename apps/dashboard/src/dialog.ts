export type DialogField =
  | {
      kind: "text" | "textarea";
      name: string;
      label: string;
      value?: string;
      placeholder?: string;
      required?: boolean;
    }
  | {
      kind: "select";
      name: string;
      label: string;
      value?: string;
      required?: boolean;
      options: Array<{ value: string; label: string }>;
    };

export type DialogResult = Record<string, string>;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderField(field: DialogField): string {
  if (field.kind === "select") {
    return `
      <label class="dialog-field">
        <span>${escapeHtml(field.label)}</span>
        <select name="${escapeHtml(field.name)}" ${field.required ? "required" : ""}>
          ${field.options
            .map(
              (option) => `
                <option value="${escapeHtml(option.value)}" ${
                  option.value === field.value ? "selected" : ""
                }>
                  ${escapeHtml(option.label)}
                </option>
              `,
            )
            .join("")}
        </select>
      </label>
    `;
  }

  if (field.kind === "textarea") {
    return `
      <label class="dialog-field">
        <span>${escapeHtml(field.label)}</span>
        <textarea
          name="${escapeHtml(field.name)}"
          placeholder="${escapeHtml(field.placeholder ?? "")}"
          ${field.required ? "required" : ""}
        >${escapeHtml(field.value ?? "")}</textarea>
      </label>
    `;
  }

  return `
    <label class="dialog-field">
      <span>${escapeHtml(field.label)}</span>
      <input
        name="${escapeHtml(field.name)}"
        value="${escapeHtml(field.value ?? "")}"
        placeholder="${escapeHtml(field.placeholder ?? "")}"
        ${field.required ? "required" : ""}
      />
    </label>
  `;
}

export async function openDashboardDialog(args: {
  title: string;
  description?: string;
  fields: DialogField[];
  submitLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}): Promise<DialogResult | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "dialog-overlay";
    overlay.setAttribute("role", "presentation");

    overlay.innerHTML = `
      <form class="dialog-card" role="dialog" aria-modal="true">
        <div class="dialog-header">
          <h2>${escapeHtml(args.title)}</h2>
          ${
            args.description
              ? `<p class="muted small">${escapeHtml(args.description)}</p>`
              : ""
          }
        </div>

        <div class="dialog-body">
          ${args.fields.map(renderField).join("")}
        </div>

        <div class="dialog-actions">
          <button type="button" class="button button-secondary" data-dialog-cancel>
            ${escapeHtml(args.cancelLabel ?? "Cancel")}
          </button>
          <button type="submit" class="button ${args.danger ? "button-danger" : ""}">
            ${escapeHtml(args.submitLabel ?? "Submit")}
          </button>
        </div>
      </form>
    `;

    document.body.appendChild(overlay);

    const firstInput = overlay.querySelector<HTMLElement>(
      "input, select, textarea, button",
    );
    firstInput?.focus();

    const close = (value: DialogResult | null) => {
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(value);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close(null);
      }
    };

    document.addEventListener("keydown", onKeyDown);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        close(null);
      }
    });

    overlay
      .querySelector("[data-dialog-cancel]")
      ?.addEventListener("click", () => close(null));

    overlay.querySelector("form")?.addEventListener("submit", (event) => {
      event.preventDefault();

      const form = new FormData(event.currentTarget as HTMLFormElement);
      const values = Object.fromEntries(
        [...form.entries()].map(([key, value]) => [key, String(value)]),
      );

      close(values);
    });
  });
}
