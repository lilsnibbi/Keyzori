import { desc, eq } from "drizzle-orm";
import type { JsonObject, User } from "../../domain/entities";
import type {
	IUserRepository,
	UserUpdate,
} from "../../domain/repositories/IUserRepository";
import type { Database } from "../../db";
import { users } from "../../db/schema";

export class DrizzleUserRepository implements IUserRepository {
	constructor(private readonly db: Database) {}

	async create(
		email: string,
		name: string,
		customFields: JsonObject,
	): Promise<User> {
		const rows = await this.db
			.insert(users)
			.values({ id: crypto.randomUUID(), email, name, customFields })
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

	async update(id: string, data: UserUpdate): Promise<User> {
		const rows = await this.db
			.update(users)
			.set(data)
			.where(eq(users.id, id))
			.returning();
		const user = rows[0];
		if (!user) throw new Error("Database returned no updated user.");
		return user;
	}

	async delete(id: string): Promise<void> {
		await this.db.delete(users).where(eq(users.id, id));
	}
}
