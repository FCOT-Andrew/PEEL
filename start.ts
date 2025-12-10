import { encodeHex } from "jsr:@std/encoding@^1/hex";
import OpenAI from "jsr:@openai/openai@^6.10.0";
import tasks from "./data.ts";

const apiKey = Deno.env.get("OPENAI_API_KEY");
if (apiKey === undefined) {
	throw new Error("Missing required API key.");
}

async function checkReadAccess() {
	await Deno.open("./ui/index.html");
}
await checkReadAccess();

async function checkAPIKey() {
	const openAI = new OpenAI({ apiKey });
	const modelList = await openAI.models.list();
	const modelIDs = modelList.data.map(m => m.id);
	console.log(`✅ ${modelIDs.length} available models.`);
}
await checkAPIKey();

export default {
	async fetch(request: Request): Promise<Response> {
		const path = new URL(request.url).pathname;

		if (
			path === "/" &&
			request.method === "GET"
		) {
			const file = await Deno.open("./ui/index.html");
			return new Response(file.readable);
		}

		if (
			path.startsWith("/ui/") &&
			request.method === "GET"
		) {
			const filePath = path.replace("/ui/", "./ui/");
			try {
				const file = await Deno.open(filePath);
				return new Response(file.readable);
			} catch {
				return new Response("Not Found", { status: 404 });
			}
		}

		if (
			path === "/api/submit_assignment" &&
			request.method === "POST"
		) {
			const formData = await request.formData();
			const classCode = formData.get("class_code");
			const submission = formData.get("submission");
			if (
				typeof classCode !== "string" ||
				typeof submission !== "string"
			) {
				return new Response("Bad Request", { status: 400 });
			}

			const classCodeBuffer = new TextEncoder().encode(classCode);
			const classCodeHashBuffer = await crypto.subtle.digest("SHA-256", classCodeBuffer);
			const classCodeHash = encodeHex(classCodeHashBuffer);
			const taskDetails = tasks[classCodeHash];
			if (taskDetails === undefined) {
				return new Response("Forbidden", { status: 403 });
			}

			const openai = new OpenAI({ apiKey });
			const openAIResponse = await openai.responses.create({
				model: "gpt-5-mini",
				input: [
					{
						role: "system",
						content: [
							{
								type: "input_text",
								text: [
									"You are a teacher's AI assistant at a further education college.",
									"Your task is to provide feedback on student writing assignments.",
									"Use the provided task brief and intended outcomes to guide your feedback.",
									"Focus on being concise, polite and constructive with a Praise Sandwich.",
									"Provide praise for the strongest features of the submission.",
									"Provide one improvement that is recognisable and formative.",
									"Recognisable, as in something the student can identify in their work.",
									"Formative, as in something that helps the student improve future work.",
									"Limit your response to around 40 words, in British English.",
								].join(" "),
							},
							{
								type: "input_text",
								text: [
									"",
									"The learner was provided with the following question or task brief:",
									"",
									...taskDetails.brief,
									"",
									"The learner should aim to meet the following outcomes in their submission:",
									"",
									...taskDetails.outcomes,
									"",
								].join("\n")
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
