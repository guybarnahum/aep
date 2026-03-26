import { getConfig } from "@aep/operator-agent/config";

export function handleHealthz(): Response {
  const config = getConfig();

  return Response.json({
    ok: true,
    service: config.serviceName,
    policyVersion: config.policyVersion,
  });
}
