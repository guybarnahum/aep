import { writeServiceMap } from "../lib/service-map";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

const controlPlaneBaseUrl =
  readArg("--control-plane-base-url") ??
  process.env.CONTROL_PLANE_BASE_URL ??
  "http://127.0.0.1:8787";

const operatorAgentBaseUrl =
  readArg("--operator-agent-base-url") ??
  process.env.OPERATOR_AGENT_BASE_URL ??
  "http://127.0.0.1:8788";

const serviceMapPath = writeServiceMap({
  path: readArg("--output"),
  services: {
    "control-plane": { baseUrl: controlPlaneBaseUrl },
    "operator-agent": { baseUrl: operatorAgentBaseUrl },
  },
});

console.log("Wrote AEP service map", {
  serviceMapPath,
  controlPlaneBaseUrl,
  operatorAgentBaseUrl,
});