import type { User } from "../entities";

export interface IUserRepository {
	create(email: string, name: string): Promise<User>;
	findById(id: string): Promise<User | null>;
	findAll(): Promise<User[]>;
}
