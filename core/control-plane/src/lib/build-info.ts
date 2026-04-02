import { BUILD_GIT_SHA } from "@aep/control-plane/generated/build-meta";

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
  const v = value?.trim();
  return v ? v : fallback;
}

export function getBuildInfo(env: BuildInfoEnv): BuildInfo {
  return {
    service: clean(env.SERVICE_NAME, "control-plane"),
    env: clean(env.APP_ENV, "dev"),
    version: clean(BUILD_GIT_SHA, "dev"),
    time: new Date().toISOString(),
  };
}