
/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_CONTROL_PLANE_BASE_URL?: string;
	readonly VITE_OPERATOR_AGENT_BASE_URL?: string;
	readonly VITE_OPS_CONSOLE_BASE_URL?: string;
	readonly VITE_BUILD_COMMIT?: string;
	readonly VITE_BUILD_DATE?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
