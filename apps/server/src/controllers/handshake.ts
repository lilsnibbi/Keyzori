import Elysia from "elysia";
import type { HandshakeService } from "../application/services/HandshakeService";
import type { ClientIpOptions } from "./clientIp";
import { DomainError } from "../domain/errors";
import { getClientIp } from "./clientIp";
import {
	ErrorResponseSchema,
	HandshakeInputSchema,
	HandshakeResponseSchema,
	LogoutInputSchema,
	SuccessResponseSchema,
} from "./validation";

export const handshakePlugin = (
	handshakeService: HandshakeService,
	clientIpOptions: ClientIpOptions = {
		trustProxyHeaders: false,
		trustedProxyCidrs: [],
	},
) =>
	new Elysia({ tags: ["License"] })
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
		.post(
			"/v1/handshake",
			async ({ body, request, server }) =>
				await handshakeService.processHandshake(
					body.apiKey,
					body.hwid,
					body.sessionToken,
					getClientIp(request, server, clientIpOptions),
				),
			{
				body: HandshakeInputSchema,
				response: {
					200: HandshakeResponseSchema,
					400: ErrorResponseSchema,
					403: ErrorResponseSchema,
					429: ErrorResponseSchema,
					500: ErrorResponseSchema,
				},
				detail: {
					operationId: "handshakeLicense",
					summary: "Validate or refresh a license session",
					description:
						"Validates the key, expiry, network and hardware limits, then creates or refreshes the supplied session.",
				},
			},
		)
		.post(
			"/v1/logout",
			async ({ body, request, server }) =>
				await handshakeService.logout(
					body.apiKey,
					body.sessionToken,
					body.hwid,
					getClientIp(request, server, clientIpOptions),
				),
			{
				body: LogoutInputSchema,
				response: {
					200: SuccessResponseSchema,
					400: ErrorResponseSchema,
					429: ErrorResponseSchema,
					500: ErrorResponseSchema,
				},
				detail: {
					operationId: "logoutLicense",
					summary: "Release a license session",
					description:
						"Removes the session immediately instead of waiting for its Redis TTL.",
				},
			},
		);
