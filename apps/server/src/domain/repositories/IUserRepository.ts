import type { JsonObject, User } from "../entities";

export type UserUpdate = Partial<Pick<User, "email" | "name" | "customFields">>;

export interface IUserRepository {
	create(email: string, name: string, customFields: JsonObject): Promise<User>;
	findById(id: string): Promise<User | null>;
	findAll(): Promise<User[]>;
	update(id: string, data: UserUpdate): Promise<User>;
	delete(id: string): Promise<void>;
}
