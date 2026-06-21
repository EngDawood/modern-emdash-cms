import React, { useState, useEffect } from "react";
import {
	usePluginAPI,
	PageHeader,
	Button,
	Input,
	Select,
	Toggle,
	NumberInput,
	TextArea,
	Card,
	Alert,
	Loading,
} from "./ui";
import type { PluginSettings } from "../types";

export const SettingsPage: React.FC = () => {
	const api = usePluginAPI();
	const [settings, setSettings] = useState<PluginSettings | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [successMsg, setSuccessMsg] = useState<string | null>(null);

	const loadSettings = async () => {
		try {
			setLoading(true);
			const data = await api.get<PluginSettings>("settings");
			setSettings(data);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load settings");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadSettings();
	}, []);

	const handleSave = async () => {
		if (!settings) return;
		setSaving(true);
		setSuccessMsg(null);
		try {
			await api.post("settings/save", settings);
			setSuccessMsg("Settings saved successfully.");
			// Clear message after 3 seconds
			setTimeout(() => setSuccessMsg(null), 3000);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save settings");
		} finally {
			setSaving(false);
		}
	};

	const updateSetting = (key: keyof PluginSettings, value: any) => {
		setSettings((prev) => {
			if (!prev) return null;
			return {
				...prev,
				[key]: value,
			};
		});
	};

	if (loading) return <Loading size="lg" />;
	if (!settings) return null;

	return (
		<div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
			<PageHeader
				title="Plugin Settings"
				description="Configure global crawler defaults, custom XML feed generators, and integration parameters."
				actions={
					<Button variant="primary" onClick={handleSave} loading={saving}>
						Save Settings
					</Button>
				}
			/>

			{error && <Alert variant="error" title="Error">{error}</Alert>}
			{successMsg && <Alert variant="success" title="Success">{successMsg}</Alert>}

			<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
				{/* 1. General crawler settings */}
				<Card title="Crawler Settings">
					<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
						<NumberInput
							label="Global Fetch Interval (Minutes)"
							value={settings.globalFetchInterval}
							onChange={(val) => updateSetting("globalFetchInterval", val)}
							min={5}
							description="Default cron check interval for active sources."
						/>
						<Input
							label="User-Agent Request Header"
							value={settings.userAgent}
							onChange={(val) => updateSetting("userAgent", val)}
							description="Identify crawler requests to source servers."
						/>
						<NumberInput
							label="Fetch Network Timeout (ms)"
							value={settings.fetchTimeout}
							onChange={(val) => updateSetting("fetchTimeout", val)}
							min={1000}
							max={60000}
							description="Max time to wait for a source response."
						/>
						<NumberInput
							label="Log Retention (Days)"
							value={settings.logRetentionDays}
							onChange={(val) => updateSetting("logRetentionDays", val)}
							min={1}
							description="Auto-clean import history older than this."
						/>
					</div>
				</Card>

				{/* 2. Defaults */}
				<Card title="Source Defaults">
					<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
						<Input
							label="Content Collection Name"
							value={settings.contentCollection}
							onChange={(val) => updateSetting("contentCollection", val)}
							description="Target CMS content collection for feed items."
						/>
						<NumberInput
							label="Max Items per Feed (Default)"
							value={settings.maxItemsPerSource}
							onChange={(val) => updateSetting("maxItemsPerSource", val)}
							min={0}
							description="Max items to store per source. 0 for unlimited."
						/>
						<div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
							<div style={{ flex: 1 }}>
								<NumberInput
									label="Max Item Age Limit (Default)"
									value={settings.maxItemAge}
									onChange={(val) => updateSetting("maxItemAge", val)}
									min={0}
									description="0 to disable age check."
								/>
							</div>
							<div style={{ width: "120px" }}>
								<Select
									label="Unit"
									value={settings.maxItemAgeUnit}
									onChange={(val) => updateSetting("maxItemAgeUnit", val)}
									options={[
										{ label: "Hours", value: "hours" },
										{ label: "Days", value: "days" },
									]}
								/>
							</div>
						</div>
						<Select
							label="Unique Matching Default"
							value={settings.defaultUniqueBy}
							onChange={(val) => updateSetting("defaultUniqueBy", val)}
							options={[
								{ label: "Matching by GUID", value: "guid" },
								{ label: "Matching by Title", value: "title" },
							]}
						/>
						<Select
							label="Reconciliation Default"
							value={settings.defaultReconcileStrategy}
							onChange={(val) => updateSetting("defaultReconcileStrategy", val)}
							options={[
								{ label: "Preserve (Keep old content)", value: "preserve" },
								{ label: "Overwrite (Always update)", value: "overwrite" },
							]}
						/>
					</div>
				</Card>

				{/* 3. Custom feed */}
				<Card title="Custom XML Feed Output">
					<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
						<Toggle
							label="Enable Custom Aggregated Feed"
							checked={settings.enableCustomFeed}
							onChange={(val) => updateSetting("enableCustomFeed", val)}
							description="Expose a merged RSS/Atom endpoint for site visitors."
						/>
						{settings.enableCustomFeed && (
							<>
								<Input
									label="Custom Feed Title"
									value={settings.customFeedTitle}
									onChange={(val) => updateSetting("customFeedTitle", val)}
								/>
								<NumberInput
									label="Custom Feed Item Limit"
									value={settings.customFeedLimit}
									onChange={(val) => updateSetting("customFeedLimit", val)}
									min={10}
									max={200}
								/>
								<Select
									label="Custom Feed Format"
									value={settings.customFeedFormat}
									onChange={(val) => updateSetting("customFeedFormat", val)}
									options={[
										{ label: "RSS 2.0 XML", value: "rss2" },
										{ label: "Atom 1.0 XML", value: "atom" },
									]}
								/>
								<div style={{ fontSize: "12px", background: "#f5f5f5", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}>
									<strong>Endpoint URL:</strong>{" "}
									<a
										href={
											typeof window !== "undefined"
												? `${window.location.origin}/api/plugins/rss-aggregator/public/feed.xml`
												: "/api/plugins/rss-aggregator/public/feed.xml"
										}
										target="_blank"
										rel="noreferrer"
									>
										/api/plugins/rss-aggregator/public/feed.xml
									</a>
								</div>
							</>
						)}
					</div>
				</Card>

				{/* 4. Feed-to-Post */}
				<Card title="Feed-to-Post Integration (Pro)">
					<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
						<Toggle
							label="Enable Feed-to-Post Globally"
							checked={settings.enableFeedToPost}
							onChange={(val) => updateSetting("enableFeedToPost", val)}
							description="Allow automatic generation of CMS blog posts from feeds."
						/>
						{settings.enableFeedToPost && (
							<>
								<Input
									label="Default Destination Collection"
									value={settings.defaultPostCollection}
									onChange={(val) => updateSetting("defaultPostCollection", val)}
									description="E.g. posts, blog, articles"
								/>
								<Select
									label="Default Post Status"
									value={settings.defaultPostStatus}
									onChange={(val) => updateSetting("defaultPostStatus", val)}
									options={[
										{ label: "Draft", value: "draft" },
										{ label: "Published", value: "published" },
									]}
								/>
							</>
						)}
					</div>
				</Card>

				{/* 5. Crawler Capabilities */}
				<Card title="Advanced Settings" className="col-span-2">
					<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
						<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
							<Toggle
								label="Enable YouTube Integration"
								checked={settings.enableYouTubeDetection}
								onChange={(val) => updateSetting("enableYouTubeDetection", val)}
								description="Automatically parse video URLs and extract YouTube IDs."
							/>
							<Toggle
								label="Open Links in New Tab (Default)"
								checked={settings.defaultOpenInNewTab}
								onChange={(val) => updateSetting("defaultOpenInNewTab", val)}
							/>
						</div>
						<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
							<Toggle
								label="Enable Full-text Fetcher capability"
								checked={settings.enableFullText}
								onChange={(val) => updateSetting("enableFullText", val)}
								description="Allow downloading full web pages of items on demand."
							/>
							<Toggle
								label="Add rel='nofollow' to links (Default)"
								checked={settings.defaultNofollow}
								onChange={(val) => updateSetting("defaultNofollow", val)}
							/>
							<NumberInput
								label="Full-text Min Words Threshold"
								value={settings.fullTextMinWords}
								onChange={(val) => updateSetting("fullTextMinWords", val)}
								min={0}
								description="Only scrape full text when item is shorter than this. 0 = always when enabled."
							/>
						</div>
					</div>
				</Card>

				{/* 6. AI Content Suite */}
				<Card title="AI Content Suite" className="col-span-2">
					<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
						<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
							<Toggle
								label="Enable AI Content Suite"
								checked={settings.aiEnabled}
								onChange={(val) => updateSetting("aiEnabled", val)}
								description="Master switch for AI summaries, rewriting and translation."
							/>
							<Input
								label="AI API Endpoint"
								value={settings.aiApiEndpoint}
								onChange={(val) => updateSetting("aiApiEndpoint", val)}
								description="OpenAI-compatible chat completions URL."
							/>
							<Input
								label="AI API Key"
								type="password"
								value={settings.aiApiKey}
								onChange={(val) => updateSetting("aiApiKey", val)}
								description="Bearer token for the AI endpoint."
							/>
							<Input
								label="AI Model"
								value={settings.aiModel}
								onChange={(val) => updateSetting("aiModel", val)}
							/>
							<NumberInput
								label="Monthly AI Credit Limit"
								value={settings.aiCreditMonthlyLimit}
								onChange={(val) => updateSetting("aiCreditMonthlyLimit", val)}
								min={0}
								description="Max AI operations per month. 0 = unlimited."
							/>
						</div>
						<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
							<Toggle
								label="Auto-generate TL;DR Summaries"
								checked={settings.aiSummaryEnabled}
								onChange={(val) => updateSetting("aiSummaryEnabled", val)}
								description="Summarize each imported item on import."
							/>
							<NumberInput
								label="Summary Length (words)"
								value={settings.aiSummaryWords}
								onChange={(val) => updateSetting("aiSummaryWords", val)}
								min={10}
								max={200}
							/>
							<Toggle
								label="Auto-rewrite in Owner Voice"
								checked={settings.aiRewriteEnabled}
								onChange={(val) => updateSetting("aiRewriteEnabled", val)}
								description="Rewrite imported items as original content."
							/>
							<TextArea
								label="Site Owner Voice"
								value={settings.aiOwnerVoice}
								onChange={(val) => updateSetting("aiOwnerVoice", val)}
								rows={3}
								placeholder="E.g. Warm, editorial, first-person, concise."
							/>
						</div>
					</div>
				</Card>

				{/* 7. Multilingual Translation */}
				<Card title="Multilingual Translation">
					<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
						<Toggle
							label="Enable Translation"
							checked={settings.translationEnabled}
							onChange={(val) => updateSetting("translationEnabled", val)}
							description="Translate imported content into target locales (requires AI)."
						/>
						{settings.translationEnabled && (
							<Input
								label="Target Locales"
								value={settings.translationLocales}
								onChange={(val) => updateSetting("translationLocales", val)}
								placeholder="ar,fr,es"
								description="Comma-separated BCP-47 locale codes."
							/>
						)}
					</div>
				</Card>

				{/* 8. Image Import to Media Library */}
				<Card title="Image Import to Media Library">
					<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
						<Toggle
							label="Import Featured Images"
							checked={settings.imageImportEnabled}
							onChange={(val) => updateSetting("imageImportEnabled", val)}
							description="Download featured images into media storage (R2/local)."
						/>
						<Toggle
							label="Import In-content Images"
							checked={settings.imageImportContentImages}
							onChange={(val) => updateSetting("imageImportContentImages", val)}
							description="Also download embedded images and rewrite their URLs."
						/>
						<NumberInput
							label="Max Images per Item"
							value={settings.imageImportMaxPerItem}
							onChange={(val) => updateSetting("imageImportMaxPerItem", val)}
							min={1}
							max={50}
						/>
					</div>
				</Card>

				{/* 9. Manual Curation */}
				<Card title="Manual Curation">
					<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
						<Toggle
							label="Require Manual Approval"
							checked={settings.curationEnabled}
							onChange={(val) => updateSetting("curationEnabled", val)}
							description="Import items into a pending queue requiring approval before they go live."
						/>
					</div>
				</Card>
			</div>

			<div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
				<Button variant="primary" onClick={handleSave} loading={saving}>
					Save Settings
				</Button>
			</div>
		</div>
	);
};
