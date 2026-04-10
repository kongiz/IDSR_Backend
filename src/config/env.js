const { z } = require("zod");

const envSchema = z.object({
  
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT:     z.string().default("5000"),

 
  DB_HOST:     z.string().min(1, "DB_HOST is required"),
  DB_USER:     z.string().min(1, "DB_USER is required"),
  DB_PASSWORD: z.string().min(1, "DB_PASSWORD is required"),
  DB_NAME:     z.string().min(1, "DB_NAME is required"),
  DB_PORT:     z.string().default("5432"),

 
  JWT_ACCESS_SECRET:      z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET:     z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN:         z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("15d"),

 
  ALERT_EMAIL:          z.string().email().optional(),
  ALERT_EMAIL_PASSWORD: z.string().optional(),
  ALERT_RECEIVERS:      z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:\n");

  const errors = parsed.error.flatten().fieldErrors;
  Object.entries(errors).forEach(([field, messages]) => {
    console.error(`  ${field}: ${messages.join(", ")}`);
  });

  console.error("\nServer startup aborted.");
  process.exit(1);
}

module.exports = parsed.data;