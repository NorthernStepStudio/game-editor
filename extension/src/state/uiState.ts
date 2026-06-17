import type { NssServerHealth } from "../models/api.types.js";

export function getServerStatusLabel(serverHealth: NssServerHealth): string {
  if (serverHealth.status === "online") {
    return "Synox runtime connected";
  }

  if (serverHealth.status === "offline") {
    return "Synox runtime offline";
  }

  return "Synox runtime unknown";
}
