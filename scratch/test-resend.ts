import fs from "fs";
import path from "path";

// Load .env.local variables
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      process.env[key] = value.trim();
    }
  }
}

import { getResendClient } from "../lib/resend";

async function main() {
  console.log("🧪 Testing Resend API dispatch with verified domain email.wppro.com.au...");

  const resend = getResendClient();
  const from = "WP Pro <hello@email.wppro.com.au>";
  const replyTo = "info@wppro.au";

  const result = await resend.emails.send({
    from,
    to: "info@wppro.au",
    replyTo,
    subject: "[TEST] Live Dispatch Verification from WP Pro",
    html: "<div><h3>WP Pro Email Sender Test</h3><p>Your verified sending domain <strong>email.wppro.com.au</strong> is active and delivering!</p></div>",
  });

  console.log("\n📬 Resend API Result:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
