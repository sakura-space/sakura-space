import dotenv from "dotenv";
import path from "path";

// Load .env for local dev; in Docker, env vars are injected directly
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../packages/backend/.env") });

export const config = {
  port: parseInt(process.env.PORT ?? "3001"),
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-key",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
};
