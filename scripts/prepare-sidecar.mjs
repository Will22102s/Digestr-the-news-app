#!/usr/bin/env node
/**
 * Copy a self-contained Node.js executable into `src-tauri/binaries/` using
 * the filename Tauri expects for a sidecar:
 *
 *   digest-node-<target-triple>[.exe]
 *
 * Some Linux distributions ship `/usr/bin/node` as a tiny wrapper around a
 * shared `libnode.so`, which cannot be bundled on its own. In that case this
 * script downloads the official Node build for the current version and
 * extracts it into `src-tauri/.cache/`.
 */
import { execFileSync } from "node:child_process";
import {
  access,
  chmod,
  copyFile,
  mkdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const SELF_CONTAINED_BYTES = 20 * 1024 * 1024;

function detectTriple() {
  const arch = process.arch;
  const platform = process.platform;

  if (platform === "linux") {
    if (arch === "x64") return "x86_64-unknown-linux-gnu";
    if (arch === "arm64") return "aarch64-unknown-linux-gnu";
  }
  if (platform === "win32") {
    if (arch === "x64") return "x86_64-pc-windows-msvc";
    if (arch === "arm64") return "aarch64-pc-windows-msvc";
  }
  if (platform === "darwin") {
    if (arch === "arm64") return "aarch64-apple-darwin";
    if (arch === "x64") return "x86_64-apple-darwin";
  }

  throw new Error(
    `Unsupported host ${platform}/${arch}. Pass --triple <target-triple>.`,
  );
}

function readTripleArg() {
  const index = process.argv.indexOf("--triple");
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];

  return (
    process.env.TAURI_ENV_TARGET_TRIPLE?.trim() ||
    process.env.CARGO_BUILD_TARGET?.trim() ||
    detectTriple()
  );
}

function nodeTarget(triple) {
  if (triple.includes("windows")) {
    if (triple.startsWith("aarch64")) return { platform: "win", arch: "arm64", ext: "zip" };
    return { platform: "win", arch: "x64", ext: "zip" };
  }
  if (triple.includes("darwin")) {
    if (triple.startsWith("aarch64")) return { platform: "darwin", arch: "arm64", ext: "tar.gz" };
    return { platform: "darwin", arch: "x64", ext: "tar.gz" };
  }
  if (triple.includes("linux")) {
    if (triple.startsWith("aarch64")) return { platform: "linux", arch: "arm64", ext: "tar.xz" };
    return { platform: "linux", arch: "x64", ext: "tar.xz" };
  }

  throw new Error(`Unsupported target triple: ${triple}`);
}

async function isSelfContained(binary) {
  try {
    const info = await stat(binary);
    return info.size >= SELF_CONTAINED_BYTES;
  } catch {
    return false;
  }
}

async function downloadNode(triple) {
  const version =
    process.env.DIGEST_NODE_VERSION?.trim() ||
    process.version.replace(/^v/, "");
  const target = nodeTarget(triple);
  const folder = `node-v${version}-${target.platform}-${target.arch}`;
  const archiveName = `${folder}.${target.ext}`;
  const cacheDir = path.join(root, "src-tauri", ".cache");
  const archivePath = path.join(cacheDir, archiveName);
  const extractedDir = path.join(cacheDir, folder);
  const binary = path.join(
    extractedDir,
    target.platform === "win" ? "node.exe" : path.join("bin", "node"),
  );

  try {
    await access(binary);
    return binary;
  } catch {
    // Not cached yet.
  }

  await mkdir(cacheDir, { recursive: true });

  let archiveReady = false;
  try {
    const info = await stat(archivePath);
    archiveReady = info.size > 1_000_000;
  } catch {
    // Download below.
  }

  if (!archiveReady) {
    const url = `https://nodejs.org/dist/v${version}/${archiveName}`;
    console.log(`  ↓ Downloading Node.js v${version} for ${triple}`);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Could not download ${url} (HTTP ${response.status}). ` +
          "Set DIGEST_NODE_BINARY to a self-contained Node executable.",
      );
    }

    await writeFile(archivePath, Buffer.from(await response.arrayBuffer()));
  }

  if (target.ext === "zip") {
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Expand-Archive -LiteralPath '${archivePath}' -DestinationPath '${cacheDir}' -Force`,
      ],
      { stdio: "inherit" },
    );
  } else {
    execFileSync("tar", ["-xf", archivePath, "-C", cacheDir], {
      stdio: "inherit",
    });
  }

  await access(binary);
  return binary;
}

const triple = readTripleArg();
const explicit = process.env.DIGEST_NODE_BINARY?.trim();
const hostBinary = process.execPath;

let source;
if (explicit) {
  source = explicit;
} else if (await isSelfContained(hostBinary)) {
  source = hostBinary;
} else {
  console.log(
    "  • Host Node is dynamically linked to libnode; using an official build.",
  );
  source = await downloadNode(triple);
}

const extension = triple.includes("windows") ? ".exe" : "";
const destination = path.join(
  root,
  "src-tauri",
  "binaries",
  `digest-node-${triple}${extension}`,
);

await mkdir(path.dirname(destination), { recursive: true });
await copyFile(source, destination);

if (!triple.includes("windows")) {
  await chmod(destination, 0o755);
}

const size = (await stat(destination)).size;
console.log(
  `  ✓ Node sidecar → ${path.relative(root, destination)} ` +
    `(${(size / 1024 / 1024).toFixed(1)} MB)`,
);
