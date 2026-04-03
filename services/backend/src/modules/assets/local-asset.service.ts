import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";

function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

export const localAssetService = {
  getProjectTempDirectory(projectId: string) {
    return path.join(env.ASSET_ROOT, "temp", projectId);
  },

  getProjectOutputDirectory(projectId: string) {
    return path.join(env.ASSET_ROOT, "outputs", projectId);
  },

  getShotClipPath(projectId: string, shotNumber: number) {
    return path.join(this.getProjectTempDirectory(projectId), `shot-${shotNumber}.mp4`);
  },

  getFinalVideoPath(projectId: string) {
    return path.join(this.getProjectOutputDirectory(projectId), "final.mp4");
  },

  getProviderMetadataPath(projectId: string) {
    return path.join(this.getProjectOutputDirectory(projectId), "provider-metadata.json");
  },

  getPublicAssetUrl(...segments: string[]) {
    return `${env.BACKEND_BASE_URL}/assets/${segments.map(toPosixPath).join("/")}`;
  },

  async ensureProjectDirectories(projectId: string) {
    await fs.mkdir(this.getProjectTempDirectory(projectId), { recursive: true });
    await fs.mkdir(this.getProjectOutputDirectory(projectId), { recursive: true });
  },

  async cleanupProjectTempAssets(projectId: string) {
    if (!env.ASSET_CLEANUP_ENABLED) {
      return;
    }

    await fs.rm(this.getProjectTempDirectory(projectId), {
      recursive: true,
      force: true
    });
  }
};
