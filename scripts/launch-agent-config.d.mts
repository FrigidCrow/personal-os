export interface LaunchAgentService {
  label: string;
  args: string[];
  workingDirectory: string;
  environment: Record<string, string>;
}

export interface LaunchAgentOptions {
  nodePath: string;
  projectRoot: string;
  runtimeRoot: string;
  v2DatabasePath: string;
  obsidianVaultPath: string;
  allowedRoots?: string[];
  qishuiEmulatorScript?: string;
  pythonPath?: string;
  timezone?: string;
}

export function buildPersonalOsServices(options: LaunchAgentOptions): LaunchAgentService[];
export function renderLaunchAgentPlist(service: LaunchAgentService, logsDirectory: string): string;
