/**
 * scripts/migrateOldUsers.js
 *
 * Migrates existing plaintext user records to the new encrypted format.
 * Safe to run multiple times — skips users that are already encrypted.
 *
 * Usage:
 *   node scripts/migrateOldUsers.js
 *
 * Make sure your .env is loaded before running (ENCRYPTION_KEY must be set).
 */

require("dotenv").config(); // loads your .env file

const db      = require("../src/config/db");       // adjust path if needed
const crypto  = require("crypto");

// ── Inline encryption helpers (same logic as your utils/encryption.js) ────────
// We inline them here so the script is self-contained and path-safe.

const ALGORITHM  = "aes-256-gcm";
const KEY        = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
const IV_LENGTH  = 16;

const encrypt = (text) => {
  if (!text) return null;
  const iv        = crypto.randomBytes(IV_LENGTH);
  const cipher    = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  const tag       = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
};

const decrypt = (encryptedText) => {
  if (!encryptedText) return null;
  try {
    const [ivHex, tagHex, dataHex] = encryptedText.split(":");
    const iv       = Buffer.from(ivHex,  "hex");
    const tag      = Buffer.from(tagHex, "hex");
    const data     = Buffer.from(dataHex,"hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data, undefined, "utf8") + decipher.final("utf8");
  } catch {
    return null;
  }
};

const hashForLookup = (text) => {
  if (!text) return null;
  return crypto
    .createHmac("sha256", process.env.ENCRYPTION_KEY)
    .update(String(text).toLowerCase().trim())
    .digest("hex");
};

// ── Check if a value is already encrypted ────────────────────────────────────
// Encrypted values look like: "hex:hex:hex" (iv:tag:data)
// Plaintext values won't match this pattern.
const isAlreadyEncrypted = (value) => {
  if (!value) return false;
  const parts = value.split(":");
  return parts.length === 3 && parts.every((p) => /^[0-9a-f]+$/i.test(p));
};

// ── Migrate a single user ─────────────────────────────────────────────────────
const migrateUser = async (user) => {
  const updates   = {};
  const values    = [];
  let   paramIdx  = 1;

  // Email
  if (user.email && !isAlreadyEncrypted(user.email)) {
    const clean       = user.email.toLowerCase().trim();
    updates.email      = encrypt(clean);
    updates.email_hash = hashForLookup(clean);
    console.log(`  [email]     "${user.email}" → encrypted`);
  } else if (user.email) {
    console.log(`  [email]     already encrypted, skipping`);
  }

  // Firstname
  if (user.firstname && !isAlreadyEncrypted(user.firstname)) {
    updates.firstname      = encrypt(user.firstname.trim());
    updates.firstname_hash = hashForLookup(user.firstname);
    console.log(`  [firstname] "${user.firstname}" → encrypted`);
  } else if (user.firstname) {
    console.log(`  [firstname] already encrypted, skipping`);
  }

  // Lastname
  if (user.lastname && !isAlreadyEncrypted(user.lastname)) {
    updates.lastname      = encrypt(user.lastname.trim());
    updates.lastname_hash = hashForLookup(user.lastname);
    console.log(`  [lastname]  "${user.lastname}" → encrypted`);
  } else if (user.lastname) {
    console.log(`  [lastname]  already encrypted, skipping`);
  }

  // Phone
  if (user.phone && !isAlreadyEncrypted(user.phone)) {
    updates.phone = encrypt(user.phone.trim());
    console.log(`  [phone]     "${user.phone}" → encrypted`);
  } else if (user.phone) {
    console.log(`  [phone]     already encrypted, skipping`);
  }

  if (Object.keys(updates).length === 0) {
    console.log(`  → Nothing to update for user ${user.id}`);
    return;
  }

  // Build dynamic SET clause
  const setClauses = Object.keys(updates).map((col) => {
    values.push(updates[col]);
    return `${col} = $${paramIdx++}`;
  });

  values.push(user.id);
  const query = `UPDATE users SET ${setClauses.join(", ")} WHERE id = $${paramIdx}`;

  await db.query(query, values);
  console.log(`  → User ${user.id} migrated successfully\n`);
};

// ── Main ──────────────────────────────────────────────────────────────────────
const main = async () => {
  console.log("=================================================");
  console.log("  IDSR User PII Migration Script");
  console.log("=================================================\n");

  if (!process.env.ENCRYPTION_KEY) {
    console.error("ERROR: ENCRYPTION_KEY is not set in your .env file.");
    process.exit(1);
  }

  // Fetch all users
  const result = await db.query(
    `SELECT id, email, firstname, lastname, phone FROM users ORDER BY id`
  );

  const users = result.rows;
  console.log(`Found ${users.length} user(s) to check.\n`);

  let migrated = 0;
  let skipped  = 0;

  for (const user of users) {
    console.log(`── User ID ${user.id} ─────────────────────────────`);

    const needsMigration =
      (user.email     && !isAlreadyEncrypted(user.email))     ||
      (user.firstname && !isAlreadyEncrypted(user.firstname)) ||
      (user.lastname  && !isAlreadyEncrypted(user.lastname))  ||
      (user.phone     && !isAlreadyEncrypted(user.phone));

    if (!needsMigration) {
      console.log(`  → Already fully encrypted, skipping\n`);
      skipped++;
      continue;
    }

    await migrateUser(user);
    migrated++;
  }

  console.log("=================================================");
  console.log(`  Done. Migrated: ${migrated}  |  Already encrypted: ${skipped}`);
  console.log("=================================================");

  process.exit(0);
};

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});