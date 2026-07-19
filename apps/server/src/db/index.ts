import { drizzle } from "drizzle-orm/bun-sql";

const databaseUrl =
	Bun.env.DATABASE_URL ?? "postgresql://localhost:5432/keyzori";

export const db = drizzle(databaseUrl);
export type Database = typeof db;
