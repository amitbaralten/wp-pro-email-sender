const { execSync } = require("child_process");
const path = require("path");

console.log("Running WP Pro Batch Sender CLI script via tsx...");

try {
  execSync("npx tsx scripts/send-batch.ts", {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
  });
} catch (err) {
  console.error("Failed to run batch script:", err.message);
  process.exit(1);
}
