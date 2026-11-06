import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";

const apkRelPath = path.join("android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const apkFullPath = path.join(root, apkRelPath);
const appId = "com.amppa.dualringclock";

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const isScript = isWin && (cmd.endsWith(".bat") || cmd.endsWith(".cmd") || cmd === "npx");
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: "inherit",
      shell: isScript,
      ...options,
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed (exit ${code}): ${cmd} ${args.join(" ")}`));
    });
    child.on("error", reject);
  });
}

function execCapture(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      shell: isWin,
      ...options,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `Exit code ${code}`));
    });
    child.on("error", reject);
  });
}

function findAdb() {
  const candidates = [];
  if (process.env.ANDROID_HOME) {
    candidates.push(path.join(process.env.ANDROID_HOME, "platform-tools", isWin ? "adb.exe" : "adb"));
  }
  if (process.env.ANDROID_SDK_ROOT) {
    candidates.push(path.join(process.env.ANDROID_SDK_ROOT, "platform-tools", isWin ? "adb.exe" : "adb"));
  }
  if (isWin && process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, "Android", "Sdk", "platform-tools", "adb.exe"));
  }
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return "adb";
}

function getBuildEnv() {
  const env = { ...process.env };
  if (!env.JAVA_HOME) {
    const defaultJbr = "C:\\Program Files\\Android\\Android Studio\\jbr";
    if (isWin && existsSync(defaultJbr)) {
      env.JAVA_HOME = defaultJbr;
      const binDir = path.join(defaultJbr, "bin");
      env.PATH = `${binDir};${env.PATH || ""}`;
    }
  }
  return env;
}

async function getConnectedDevices(adbPath) {
  try {
    const output = await execCapture(adbPath, ["devices"]);
    const lines = output.split(/\r?\n/).slice(1).map((l) => l.trim()).filter(Boolean);
    return lines
      .map((l) => {
        const [id, status] = l.split(/\s+/);
        return { id, status };
      })
      .filter((d) => d.status === "device");
  } catch {
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);
  const buildOnly = args.includes("--build-only");
  const installOnly = args.includes("--install-only");

  console.log("==================================================");
  console.log("    DualRing Clock Android Build & Deploy Tool    ");
  console.log("==================================================");

  if (!installOnly) {
    // 1. Stage web assets
    console.log("\n[1/3] Staging Web Assets (src + assets -> android-web)...");
    await run("node", ["tools/build-android-web.mjs"]);

    // 2. Sync Capacitor
    console.log("\n[2/3] Syncing Capacitor Android...");
    await run("npx", ["cap", "sync", "android"]);

    // 3. Compile APK with Gradle
    console.log("\n[3/3] Compiling Debug APK with Gradle...");
    const buildEnv = getBuildEnv();
    const gradlewCmd = isWin ? ".\\gradlew.bat" : "./gradlew";
    await run(gradlewCmd, ["assembleDebug"], {
      cwd: path.join(root, "android"),
      env: buildEnv,
    });

    const fileStat = await stat(apkFullPath);
    const sizeMb = (fileStat.size / (1024 * 1024)).toFixed(2);
    console.log(`\n✓ APK Build Success: ${apkRelPath} (${sizeMb} MB)`);
  } else {
    console.log("\n[Skip Build] Using existing APK...");
    if (!existsSync(apkFullPath)) {
      console.error(`Error: APK not found at ${apkFullPath}. Please build first.`);
      process.exit(1);
    }
  }

  if (buildOnly) {
    console.log("\n[--build-only] Finished build. Skipping device deployment.");
    return;
  }

  // 4. Install & Launch via ADB
  console.log("\n[Deploy] Checking connected Android devices via ADB...");
  const adbPath = findAdb();
  const devices = await getConnectedDevices(adbPath);

  if (devices.length === 0) {
    console.log("\n⚠️  No connected Android devices or emulators found in 'device' state.");
    console.log("   APK is ready at:");
    console.log(`   ${apkFullPath}`);
    console.log("\n   To install once connected via USB (with USB Debugging enabled):");
    console.log("   > npm run android:install");
    return;
  }

  for (const device of devices) {
    console.log(`\n📲 Deploying to device [${device.id}]...`);
    console.log("   Installing APK (re-install & allow downgrade)...");
    await run(adbPath, ["-s", device.id, "install", "-r", "-d", apkFullPath]);

    console.log("   Launching DualRing Clock...");
    await run(adbPath, ["-s", device.id, "shell", "am", "start", "-n", `${appId}/.MainActivity`]);
  }

  console.log("\n🎉 Deployment completed successfully!");
}

main().catch((err) => {
  console.error("\n❌ Build/Deploy failed:", err.message || err);
  process.exit(1);
});

