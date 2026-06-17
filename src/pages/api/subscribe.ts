import type { APIRoute } from "astro";

export const prerender = false;

function toSlug(email: string): string {
	return email
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

export const POST: APIRoute = async ({ request, locals }) => {
	let email: string;
	try {
		const body = (await request.json()) as { email?: unknown };
		email = typeof body.email === "string" ? body.email.trim() : "";
	} catch {
		return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
	}

	if (!email || !email.includes("@") || !email.includes(".")) {
		return Response.json({ success: false, error: "Invalid email address" }, { status: 400 });
	}

	const runtime = (locals as { runtime?: { env?: Record<string, string> } }).runtime;
	const token = runtime?.env?.EMDASH_TOKEN;

	if (!token) {
		return Response.json({ success: false, error: "Server misconfiguration" }, { status: 500 });
	}

	const origin = new URL(request.url).origin;

	const res = await fetch(`${origin}/_emdash/api/admin/content/subscribers`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			slug: toSlug(email),
			status: "published",
			data: {
				email,
				confirmed: false,
				subscribed_at: new Date().toISOString(),
			},
		}),
	});

	// Unique constraint hit — already subscribed, treat as success
	if (res.status === 409) {
		return Response.json({ success: true, message: "You're already subscribed!" });
	}

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		console.error(`EmDash subscribe failed ${res.status}: ${text}`);
		return Response.json({ success: false, error: "Failed to subscribe. Please try again." }, { status: 502 });
	}

	return Response.json({ success: true, message: "You're subscribed!" });
};
