/**
 * AI Generate field widget — admin component.
 *
 * Renders the normal field input plus a "Generate with AI" button. The button
 * reads the entry title from the editor form (the widget API only exposes its
 * own value, so siblings are read from the DOM), posts it to the plugin's
 * `generate` route, and writes the returned text back via onChange.
 */

import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import * as React from "react";

interface FieldWidgetProps {
	value: unknown;
	onChange: (value: unknown) => void;
	label: string;
	id: string;
	required?: boolean;
	options?: Record<string, unknown>;
	minimal?: boolean;
}

const API = "/_emdash/api/plugins/ai";

/**
 * Read the entry title from the editor form. The field widget only receives
 * its own value, so we locate the title input in the surrounding DOM. Kept
 * isolated so it is easy to adjust if the admin form markup changes.
 */
function readTitle(): string {
	const selectors = [
		'input[name="title"]',
		'textarea[name="title"]',
		"#title",
		'[data-field-slug="title"] input',
		'[data-field-slug="title"] textarea',
	];
	for (const selector of selectors) {
		const el = document.querySelector(selector) as
			| HTMLInputElement
			| HTMLTextAreaElement
			| null;
		if (el && typeof el.value === "string" && el.value.trim()) {
			return el.value.trim();
		}
	}
	return "";
}

const inputStyle: React.CSSProperties = {
	width: "100%",
	padding: "0.5rem 0.75rem",
	borderRadius: 6,
	border: "1px solid #d1d5db",
	fontSize: "0.875rem",
	fontFamily: "inherit",
	resize: "vertical",
};

function GenerateWidget({ value, onChange, label, id, required, minimal }: FieldWidgetProps) {
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const text = typeof value === "string" ? value : "";

	async function generate() {
		setError(null);
		const title = readTitle();
		if (!title) {
			setError("Add a title first, then generate.");
			return;
		}
		setLoading(true);
		try {
			const res = await apiFetch(`${API}/generate`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title, label }),
			});
			const data = (await parseApiResponse(res)) as {
				ok?: boolean;
				text?: string;
				error?: string;
			};
			if (data?.ok && data.text) {
				onChange(data.text);
			} else {
				setError(data?.error ?? "Generation failed");
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "Generation failed");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div data-testid="ai-generate-widget">
			{!minimal && (
				<label
					htmlFor={id}
					style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: 6 }}
				>
					{label}
					{required && <span style={{ color: "#dc2626", marginInlineStart: 2 }}>*</span>}
				</label>
			)}
			<textarea
				id={id}
				value={text}
				onChange={(e) => onChange(e.target.value)}
				rows={3}
				style={inputStyle}
			/>
			<div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10 }}>
				<button
					type="button"
					onClick={generate}
					disabled={loading}
					style={{
						padding: "0.375rem 0.75rem",
						borderRadius: 6,
						background: loading ? "#e5e7eb" : "#6b1438",
						color: loading ? "#6b7280" : "#fff",
						border: "none",
						cursor: loading ? "default" : "pointer",
						fontSize: "0.75rem",
						fontWeight: 500,
					}}
				>
					{loading ? "Generating…" : "✨ Generate with AI"}
				</button>
				{error && <span style={{ fontSize: "0.75rem", color: "#dc2626" }}>{error}</span>}
			</div>
		</div>
	);
}

export const fields = {
	generate: GenerateWidget,
};
