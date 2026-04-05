import { BUILD_GIT_SHA } from "../generated/build-meta";

export interface BuildInfoEnv {
  APP_ENV?: string;
  GIT_SHA?: string;
  SERVICE_NAME?: string;
}

export interface BuildInfo {
  service: string;
  env: string;
  version: string;
  time: string;
}

function clean(value: string | undefined, fallback: string): string {
  const next = value?.trim();
  return next ? next : fallback;
}

export function getBuildInfo(env: BuildInfoEnv): BuildInfo {
  return {
    service: clean(env.SERVICE_NAME, "aep-operator-agent"),
    env: clean(env.APP_ENV, "dev"),
    version: clean(env.GIT_SHA, clean(BUILD_GIT_SHA, "dev")),
    time: new Date().toISOString(),
  };
}