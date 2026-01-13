export default {
	f0e4c2f76c58916ec258f246851bea091d14d4247a2fc3e18694461b1816e13b: {
		brief: [
			"Describe one opportunity for a teacher",
			"to integrate artificial intelligence",
			"(AI) tools into their teaching practice.",
		].join(" "),
		persona: [
			"You are a teacher's AI assistant at a further education college.",
			"Your task is to provide feedback on student writing assignments.",
			"Use the provided task brief and intended outcomes to guide your feedback.",
			"Focus on being concise, polite and constructive with a praise sandwich.",
			"Provide praise for the strongest features of the submission.",
			"Provide one improvement that is recognisable and formative.",
			"Recognisable, as in something the student can identify in their work.",
			"Formative, as in something that helps the student improve future work.",
			"Limit your response to around 40 words, in British English.",
		].join(" "),
		outcomes: [
			"* Use the PEEL structure.",
			"  1. Point",
			"  2. Explanation, Example or Evidence",
			"  3. Explanation, Example or Evidence",
			"  4. Link",
			"* Write a response of approximately 80-120 words.",
			"* Successfully join the two domains in the brief.",
			"  * AI tools",
			"  * Teaching practice",
		].join("\n"),
	}
} as Record<string, { brief: string; persona: string; outcomes: string }>;