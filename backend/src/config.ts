import dotenv from "dotenv";

dotenv.config();

export const GRAPHQL_URL =
  process.env.GRAPHQL_URL ?? "http://localhost:8080/v1/graphql";

export const ORACLE_BASE_URL =
  process.env.ORACLE_BASE_URL ?? "https://arbitrum-api.gmxinfra.io";

export const PORT = Number(process.env.PORT ?? 4000);

