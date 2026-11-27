import { execSync } from "child_process";
import fs from "fs";

const file = "/tmp/tpg-service-test.db";

export default function setup() {
  if (fs.existsSync(file)) fs.unlinkSync(file);
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: `file:${file}` },
    stdio: "inherit",
  });
}
