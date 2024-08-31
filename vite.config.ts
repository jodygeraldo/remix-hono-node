import type http from "node:http";
import { getRequestListener } from "@hono/node-server";
import { vitePlugin as remix } from "@remix-run/dev";
import type { Hono } from "hono";
import {
	type Connect,
	type Plugin,
	type ViteDevServer,
	defineConfig,
} from "vite";

export default defineConfig({
	server: { port: 3000 },
	plugins: [
		honoDevServer(),
		remix({
			future: {
				v3_fetcherPersist: true,
				v3_relativeSplatPath: true,
				v3_throwAbortReason: true,
				unstable_lazyRouteDiscovery: true,
				unstable_singleFetch: true,
			},
		}),
	],
});

function honoDevServer(): Plugin {
	const entry = "./server.js";

	return {
		name: "vite-remix-hono-dev",
		configureServer: async (server) => {
			async function createMiddleware(
				server: ViteDevServer,
			): Promise<Connect.HandleFunction> {
				return async (
					req: http.IncomingMessage,
					res: http.ServerResponse,
					next: Connect.NextFunction,
				): Promise<void> => {
					const exclude = [
						/^\/(app)\/.+/,
						/^\/__manifest\?version=.+/,
						/^\/@.+$/,
						/^\/node_modules\/.*/,
					];

					for (const pattern of exclude) {
						if (req.url && pattern.test(req.url)) {
							return next();
						}
					}

					type AppModule = { app: Hono };
					let appModule: AppModule;
					try {
						appModule = (await server.ssrLoadModule(entry)) as AppModule;
					} catch (e) {
						return next(e);
					}

					const app = appModule.app;

					if (!app) {
						return next(
							new Error(
								`Failed to find a named export "default" from ${entry}`,
							),
						);
					}

					getRequestListener(
						async (request) => {
							const response = await app.fetch(request, undefined, {
								waitUntil: async (fn) => fn,
								passThroughOnException: () => {
									throw new Error("`passThroughOnException` is not supported");
								},
							});

							/**
							 * If the response is not instance of `Response`, throw it so that it can be handled
							 * by our custom errorHandler and passed through to Vite
							 */
							if (!(response instanceof Response)) {
								throw response;
							}

							return response;
						},
						{
							overrideGlobalObjects: false,
							errorHandler: (e) => {
								let err: Error;
								if (e instanceof Error) {
									err = e;
									server.ssrFixStacktrace(err);
								} else if (typeof e === "string") {
									err = new Error(
										`The response is not an instance of "Response", but: ${e}`,
									);
								} else {
									err = new Error(`Unknown error: ${e}`);
								}

								next(err);
							},
						},
					)(req, res);
				};
			}

			server.middlewares.use(await createMiddleware(server));
		},
	};
}
