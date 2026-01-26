import { encodeHex } from "jsr:@std/encoding@^1/hex";
import OpenAI from "jsr:@openai/openai@^6.10.0";
import tasks from "./data.ts";

async function checkAPIKey() {
	const apiKey = Deno.env.get("OPENAI_API_KEY");
	const openAI = new OpenAI({ apiKey });
	const modelList = await openAI.models.list();
	console.log(`✅ ${modelList.data.length} available models.`);
}

async function checkFileRead() {
	await Deno.open("./static/index.html");
	console.log(`✅ Able to read /index.html.`);
}

await Promise.all([
	checkFileRead(),
	checkAPIKey(),
])

async function getTask(code: string) {
	const codeBuffer = new TextEncoder().encode(code);
	const codeHashBuffer = await crypto.subtle.digest("SHA-256", codeBuffer);
	const codeHash = encodeHex(codeHashBuffer);
	const taskDetails = tasks[codeHash];
	return taskDetails;
}

export default {
	async fetch(request: Request): Promise<Response> {
		const path = new URL(request.url).pathname;
		const segments = path.split("/");

		if (
			path === "/" &&
			request.method === "GET"
		) {
			const file = await Deno.open("./static/index.html");
			return new Response(file.readable);
		}

		if (
			segments[1] === "static" &&
			request.method === "GET"
		) {
			const filePath = path.replace("/static/", "./static/");
			try {
				const file = await Deno.open(filePath);
				return new Response(file.readable);
			} catch {
				return new Response("Not Found", { status: 404 });
			}
		}

		if (
			segments[1] === "api" &&
			segments[2] === "assignment" &&
			request.method === "GET"
		) {
			const code = decodeURIComponent(segments[3]);
			const taskDetails = await getTask(code);
			if (taskDetails === undefined) {
				return new Response("Not Found", { status: 404 });
			} else {
				return new Response(
					taskDetails.brief,
					{ headers: { "Content-Type": "text/markdown" }},
				);
			}
		}

		if (
			segments[1] === "api" &&
			segments[2] === "assignment" &&
			segments[4] === "submission" &&
			request.method === "POST"
		) {
			const code = decodeURIComponent(segments[3]);
			const taskDetails = await getTask(code);
			if (taskDetails === undefined) {
				return new Response("Not Found", { status: 404 });
			}

			const submission = await request.text();
			if (submission.trim() === "") {
				return new Response("Bad Request", { status: 400 });
			}

			const apiKey = Deno.env.get("OPENAI_API_KEY");
			const openai = new OpenAI({ apiKey });
			const stream = await openai.responses.create({
				model: taskDetails.model,
				instructions: [
					taskDetails.persona,
					"Task brief provided to students:",
					taskDetails.brief,
					"Expected outcomes:",
					taskDetails.outcomes,
				].join("\n\n"),
				input: [
					{
						role: "user",
						content: [
							{
								type: "input_text",
								text: submission,
							},
						],
					},
				],
				stream: true,
			});
			return new Response(
				new ReadableStream({
					async start(controller) {
						for await (const event of stream) {
							if (event.type === 'response.output_text.delta') {
								controller.enqueue(new TextEncoder().encode(event.delta));
							} else if (event.type === 'response.completed') {
								controller.close();
							}
						}
					},
				}),
				{
					headers: {
						"Content-Type": "text/event-stream",
					},
				},
			);
		}
		
		console.log("Unhandled request:", request.method, path);
		return new Response("Not Found", { status: 404 });
	}
}
