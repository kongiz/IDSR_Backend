const crypto = require("crypto");

const ALGORITHM  = "aes-256-gcm";
const KEY        = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
const IV_LENGTH  = 16;
const TAG_LENGTH = 16;

exports.encrypt = (text) => {
  if (!text) return null;

  const iv         = crypto.randomBytes(IV_LENGTH);
  const cipher     = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted  = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  const tag        = cipher.getAuthTag();

  // Store as iv:tag:encrypted (all hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
};

exports.decrypt = (encryptedText) => {
  if (!encryptedText) return null;

  try {
    const [ivHex, tagHex, dataHex] = encryptedText.split(":");
    const iv        = Buffer.from(ivHex,  "hex");
    const tag       = Buffer.from(tagHex, "hex");
    const data      = Buffer.from(dataHex,"hex");
    const decipher  = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data, undefined, "utf8") + decipher.final("utf8");
  } catch (err) {
    return null; 
  }
};

// One-way hash for lookups (email, name search)
exports.hashForLookup = (text) => {
  if (!text) return null;
  return crypto
    .createHmac("sha256", process.env.ENCRYPTION_KEY)
    .update(String(text).toLowerCase().trim())
    .digest("hex");
};