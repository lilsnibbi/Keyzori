import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "./schema";

const databaseUrl =
	Bun.env.DATABASE_URL ?? "postgresql://localhost:5432/keyzori";

export const db = drizzle({ connection: { url: databaseUrl }, schema });
export type Database = typeof db;
