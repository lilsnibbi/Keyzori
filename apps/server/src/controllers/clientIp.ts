import type { Server } from "bun";
import { BlockList, isIP } from "node:net";

export interface ClientIpOptions {
	trustProxyHeaders: boolean;
	trustedProxyCidrs: string[];
}

function trustedProxy(socketIp: string, cidrs: string[]): boolean {
	const family = isIP(socketIp);
	if (family === 0) return false;
	const blockList = new BlockList();
	for (const cidr of cidrs) {
		const [address, prefixText] = cidr.split("/");
		if (!address || !prefixText) continue;
		const cidrFamily = isIP(address);
		blockList.addSubnet(
			address,
			Number(prefixText),
			cidrFamily === 4 ? "ipv4" : "ipv6",
		);
	}
	return blockList.check(socketIp, family === 4 ? "ipv4" : "ipv6");
}

export function getClientIp(
	request: Request,
	server: Server<unknown> | null,
	options: ClientIpOptions,
): string {
	const socketIp = server?.requestIP(request)?.address ?? "127.0.0.1";
	if (
		!options.trustProxyHeaders ||
		!trustedProxy(socketIp, options.trustedProxyCidrs)
	) {
		return socketIp;
	}

	const cloudflareIp = request.headers.get("cf-connecting-ip");
	const forwardedFor = request.headers.get("x-forwarded-for");
	const forwardedIp =
		cloudflareIp ?? forwardedFor?.split(",")[0]?.trim() ?? socketIp;
	return isIP(forwardedIp) > 0 ? forwardedIp : socketIp;
}
