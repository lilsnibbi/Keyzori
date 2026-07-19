import Elysia, { type Context, t } from "elysia";
import type { AdminService } from "../application/services/AdminService";
import { DomainError } from "../domain/errors";
import {
	AdminCreateKeyInputSchema,
	AdminCreateUserInputSchema,
	ApiKeyResponseSchema,
	ErrorResponseSchema,
	UserResponseSchema,
} from "./validation";

function configuredAdminKeys(): string[] {
	return [Bun.env.ADMIN_API_KEY, ...(Bun.env.ADMIN_API_KEYS ?? "").split(",")]
		.map((key) => key?.trim())
		.filter((key): key is string => Boolean(key));
}

export const createAdminAuthMiddleware =
	(expectedKeys: readonly string[] = configuredAdminKeys()) =>
	({ request, set }: Context) => {
		const adminKey = request.headers.get("X-Admin-Key");
		const suppliedDigest = adminKey
			? new Bun.CryptoHasher("sha256").update(adminKey).digest("hex")
			: "";
		const authenticated = expectedKeys.some(
			(expectedKey) =>
				new Bun.CryptoHasher("sha256").update(expectedKey).digest("hex") ===
				suppliedDigest,
		);
		if (!adminKey || !authenticated) {
			set.status = 401;
			return { error: "Unauthorized" };
		}
	};

export const adminPlugin = (
	adminService: AdminService,
	adminApiKeys?: readonly string[],
) =>
	new Elysia({ prefix: "/admin", tags: ["Admin"] })
		.onError(({ code, error, set }) => {
			if (error instanceof DomainError) {
				set.status = error.statusCode;
				return { error: error.message };
			}
			if (code === "VALIDATION") {
				set.status = 400;
				return { error: error.message };
			}
		})
		.onBeforeHandle(createAdminAuthMiddleware(adminApiKeys))
		.post(
			"/users",
			async ({ body, set }) => {
				set.status = 201;
				return await adminService.createUser(body.email, body.name);
			},
			{
				body: AdminCreateUserInputSchema,
				response: {
					201: UserResponseSchema,
					400: ErrorResponseSchema,
					401: ErrorResponseSchema,
					429: ErrorResponseSchema,
					500: ErrorResponseSchema,
				},
				detail: {
					operationId: "createUser",
					summary: "Create a license owner",
					description: "Creates the user that owns one or more license keys.",
					security: [{ AdminKey: [] }],
				},
			},
		)
		.get("/users", async () => await adminService.listUsers(), {
			response: {
				200: t.Array(UserResponseSchema),
				401: ErrorResponseSchema,
				429: ErrorResponseSchema,
				500: ErrorResponseSchema,
			},
			detail: {
				operationId: "listUsers",
				summary: "List license owners",
				security: [{ AdminKey: [] }],
			},
		})
		.post(
			"/keys",
			async ({ body, set }) => {
				set.status = 201;
				return await adminService.createKey(body);
			},
			{
				body: AdminCreateKeyInputSchema,
				response: {
					201: ApiKeyResponseSchema,
					400: ErrorResponseSchema,
					401: ErrorResponseSchema,
					404: ErrorResponseSchema,
					429: ErrorResponseSchema,
					500: ErrorResponseSchema,
				},
				detail: {
					operationId: "createKey",
					summary: "Create a license key",
					description:
						"Creates a key and returns its secret. Store the secret securely.",
					security: [{ AdminKey: [] }],
				},
			},
		)
		.get("/keys", async () => await adminService.listKeys(), {
			response: {
				200: t.Array(ApiKeyResponseSchema),
				401: ErrorResponseSchema,
				429: ErrorResponseSchema,
				500: ErrorResponseSchema,
			},
			detail: {
				operationId: "listKeys",
				summary: "List license keys",
				description:
					"Lists license metadata with masked secrets. Full secrets are returned only at creation time.",
				security: [{ AdminKey: [] }],
			},
		})
		.patch(
			"/keys/:id",
			async ({ params }) => await adminService.revokeKey(params.id),
			{
				params: t.Object({ id: t.String({ minLength: 1 }) }),
				response: {
					200: ApiKeyResponseSchema,
					401: ErrorResponseSchema,
					404: ErrorResponseSchema,
					429: ErrorResponseSchema,
					500: ErrorResponseSchema,
				},
				detail: {
					operationId: "revokeKey",
					summary: "Revoke a license key",
					security: [{ AdminKey: [] }],
				},
			},
		);
