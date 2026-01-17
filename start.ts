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
			segments[2] === "health" &&
			request.method === "GET"
		) {
			const apiKey = Deno.env.get("OPENAI_API_KEY");
			const openai = new OpenAI({ apiKey });
			const modelList = await openai.models.list();
			const modelIDs = modelList.data.map(m => m.id);
			return new Response(
				JSON.stringify({ models: modelIDs }),
				{ status: 200, headers: { "Content-Type": "application/json" }},
			);
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
					JSON.stringify({ brief: taskDetails.brief }),
					{ status: 200, headers: { "Content-Type": "application/json" }},
				);
			}
		}

		if (
			segments[1] === "api" &&
			segments[2] === "assignment" &&
			segments[4] === "submission" &&
			request.method === "POST"
		) {
			const requestBody = await request.json();
			const submission = requestBody.submission;
			if (typeof submission !== "string") {
				return new Response("Bad Request", { status: 400 });
			}

			const code = decodeURIComponent(segments[3]);
			const taskDetails = await getTask(code);
			if (taskDetails === undefined) {
				return new Response("Not Found", { status: 404 });
			}

			const apiKey = Deno.env.get("OPENAI_API_KEY");
			const openai = new OpenAI({ apiKey });
			const full_brief = [
				taskDetails.persona,
				"The learner was provided with the following task brief:",
				taskDetails.brief,
				"The learner should aim for the following outcomes in their submission:",
				taskDetails.outcomes,
			].join("\n\n");
			const openAIResponse = await openai.responses.create({
				model: Deno.env.get("OPENAI_MODEL") || "gpt-5-nano",
				input: [
					{
						role: "system",
						content: [
							{
								type: "input_text",
								text: full_brief,
							},
						],
					},
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
			});
			return new Response(
				JSON.stringify({ feedback: openAIResponse.output_text }),
				{ status: 200, headers: { "Content-Type": "application/json" }},
			);
		}
		
		console.log("Unhandled request:", request.method, path);
		return new Response("Not Found", { status: 404 });
	}
}
