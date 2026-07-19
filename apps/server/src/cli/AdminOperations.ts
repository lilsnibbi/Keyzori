import type {
	AdminService,
	CreateKeyInput,
} from "../application/services/AdminService";

export interface AdminOperations {
	createUser: AdminService["createUser"];
	listUsers: AdminService["listUsers"];
	createKey: (input: CreateKeyInput) => ReturnType<AdminService["createKey"]>;
	listKeys: AdminService["listKeys"];
	revokeKey: AdminService["revokeKey"];
}
