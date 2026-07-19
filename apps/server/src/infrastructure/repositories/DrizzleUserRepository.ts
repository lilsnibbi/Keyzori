import { desc, eq } from "drizzle-orm";
import type { User } from "../../domain/entities";
import type { IUserRepository } from "../../domain/repositories/IUserRepository";
import type { Database } from "../../db";
import { users } from "../../db/schema";

export class DrizzleUserRepository implements IUserRepository {
	constructor(private readonly db: Database) {}

	async create(email: string, name: string): Promise<User> {
		const rows = await this.db
			.insert(users)
			.values({ id: crypto.randomUUID(), email, name })
			.returning();
		const user = rows[0];
		if (!user) throw new Error("Database returned no created user.");
		return user;
	}

	async findAll(): Promise<User[]> {
		return await this.db.select().from(users).orderBy(desc(users.createdAt));
	}

	async findById(id: string): Promise<User | null> {
		const rows = await this.db
			.select()
			.from(users)
			.where(eq(users.id, id))
			.limit(1);
		return rows[0] ?? null;
	}
}
