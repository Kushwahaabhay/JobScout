// Usage: npm run auth:hash -- you@example.com 'your password'
// Prints a JOBSCOUT_USERS entry (email|salt:hash). Join several with ';'.
import { randomBytes, scryptSync } from "node:crypto";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: npm run auth:hash -- <email> <password>");
  process.exit(1);
}
const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, Buffer.from(salt, "hex"), 32).toString("hex");
console.log(`${email.toLowerCase()}|${salt}:${hash}`);
