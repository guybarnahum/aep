/* eslint-disable no-console */

type ProbeResult = {
  ok: boolean;
  status: number;
};

async function probePostRoute(url: string): Promise<ProbeResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  });

  return {
    ok: response.ok,
    status: response.status,
  };
}

export async function assertRequiredPostRoute(args: {
  baseUrl: string;
  path: string;
  description: string;
}): Promise<void> {
  const url = `${args.baseUrl.replace(/\/$/, "")}${args.path}`;
  const probe = await probePostRoute(url);

  if (probe.status === 404) {
    throw new Error(
      `${args.description} missing on deployment; expected ${args.path} to exist`,
    );
  }
}

export async function hasOptionalPostRoute(args: {
  baseUrl: string;
  path: string;
}): Promise<boolean> {
  const url = `${args.baseUrl.replace(/\/$/, "")}${args.path}`;
  const probe = await probePostRoute(url);
  return probe.status !== 404;
}