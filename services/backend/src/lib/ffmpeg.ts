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

function probeCommand(inputPath: string): Promise<ffmpeg.FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (error, data) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(data);
    });
  });
}

function getSafeTrimDuration(totalDuration: number, startSeconds: number): number {
  return Math.max(totalDuration - startSeconds, 0);
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

  if (inputPaths.length === 0) {
    throw new Error("Cannot stitch video because no input clips were provided");
  }

  if (inputPaths.length === 1) {
    await fs.copyFile(inputPaths[0], outputPath);
    return;
  }

  const command = ffmpeg();

  await runCommand(
    inputPaths.reduce((current, inputPath) => current.input(inputPath), command)
      .complexFilter([
        {
          filter: "concat",
          options: {
            n: inputPaths.length,
            v: 1,
            a: 0
          },
          inputs: inputPaths.map((_, index) => `${index}:v`),
          outputs: "stitched_video"
        }
      ])
      .outputOptions(["-map [stitched_video]", "-c:v libx264", "-pix_fmt yuv420p", "-movflags +faststart"])
      .save(outputPath)
  );
}

export async function extractClipTail(
  inputPath: string,
  outputPath: string,
  startSeconds: number,
  totalDuration: number
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const tailDuration = getSafeTrimDuration(totalDuration, startSeconds);

  if (tailDuration <= 0.05) {
    throw new Error(
      `Unable to extract tail clip because total duration ${totalDuration}s does not exceed start time ${startSeconds}s`
    );
  }

  await runCommand(
    ffmpeg()
      .input(inputPath)
      .setStartTime(startSeconds)
      .duration(tailDuration)
      .noAudio()
      .outputOptions(["-c:v libx264", "-pix_fmt yuv420p", "-movflags +faststart"])
      .save(outputPath)
  );
}

export async function validateVideoFile(inputPath: string): Promise<void> {
  await probeCommand(inputPath);
}
