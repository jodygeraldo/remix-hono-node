import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createRequestHandler } from "@remix-run/node";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { logger } from "hono/logger";

const mode =
	process.env.NODE_ENV === "production" ? "production" : "development";

const build =
	mode === "development"
		? await import("virtual:remix/server-build")
		: await import("./build/server/index.js");

const remixHandler = createRequestHandler(build, mode);

const app = new Hono();

app.use(compress());

app.use(
	"*",
	async (c, next) => {
		await next();
		if (c.req.path === "/favicon.ico") {
			c.header("Cache-Control", "public, max-age=3600");
		}
	},
	serveStatic({ root: mode === "development" ? "./build/client" : "./public" }),
);

app.use(
	"/assets/*",
	async (c, next) => {
		await next();
		c.header("Cache-Control", "public, max-age=31536000, immutable");
	},
	serveStatic({ root: "./build/client" }),
);

app.use(logger());

app.use("*", async (c) => {
	return await remixHandler(c.req.raw, {
		buildVersion: mode === "production" ? build.assets.version : "dev",
	});
});

if (mode === "production") {
	serve({ ...app, port: Number(process.env.PORT) || 3000 }, async (info) => {
		console.log(`🚀 Server started on port ${info.port}`);
	});
}

export { app };
