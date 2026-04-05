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

  getProjectShotDirectory(projectId: string) {
    return path.join(this.getProjectOutputDirectory(projectId), "shots");
  },

  getShotClipPath(projectId: string, shotNumber: number) {
    return path.join(this.getProjectShotDirectory(projectId), `shot-${shotNumber}.mp4`);
  },

  getShotClipUrl(projectId: string, shotNumber: number) {
    return this.getPublicAssetUrl("outputs", projectId, "shots", `shot-${shotNumber}.mp4`);
  },

  getShotSegmentPath(projectId: string, shotNumber: number) {
    return path.join(this.getProjectShotDirectory(projectId), `shot-${shotNumber}-segment.mp4`);
  },

  getShotSegmentUrl(projectId: string, shotNumber: number) {
    return this.getPublicAssetUrl("outputs", projectId, "shots", `shot-${shotNumber}-segment.mp4`);
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
    await fs.mkdir(this.getProjectShotDirectory(projectId), { recursive: true });
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
