import fs from "node:fs/promises";
import path from "node:path";
import ffmpeg from "fluent-ffmpeg";
import { env } from "../config/env.js";

if (env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(env.FFMPEG_PATH);
}

function runCommand(command: ffmpeg.FfmpegCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    command.on("end", () => resolve()).on("error", reject).run();
  });
}

export async function createPlaceholderClip(
  outputPath: string,
  overlayText: string,
  durationSeconds = 3
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const safeText = overlayText.replace(/:/g, "\\:").replace(/'/g, "\\'");

  await runCommand(
    ffmpeg()
      .input(`color=c=black:s=1280x720:d=${durationSeconds}`)
      .inputFormat("lavfi")
      .outputOptions([
        "-vf",
        `drawtext=text='${safeText}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=(h-text_h)/2`,
        "-c:v libx264",
        "-pix_fmt yuv420p"
      ])
      .save(outputPath)
  );
}

export async function stitchClips(inputPaths: string[], outputPath: string): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const concatFile = path.join(path.dirname(outputPath), `concat-${Date.now()}.txt`);
  const manifest = inputPaths.map((filePath) => `file '${filePath}'`).join("\n");
  await fs.writeFile(concatFile, manifest, "utf8");

  try {
    await runCommand(
      ffmpeg()
        .input(concatFile)
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions(["-c copy"])
        .save(outputPath)
    );
  } finally {
    await fs.rm(concatFile, { force: true });
  }
}
