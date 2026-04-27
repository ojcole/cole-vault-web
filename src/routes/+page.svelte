<script lang="ts">
	import {
		generatePassword,
		combinePasswords,
		symbols,
		limitedSymbols
	} from '$lib/password-generation';
	import {
		getSites,
		getSettings,
		addSite,
		removeSite,
		updateSite,
		getSiteById,
		exportSites,
		importSites,
		setSettings,
		versionStore,
		purgeData
	} from '$lib/store.svelte';
	import type { Site } from '$lib/store.svelte';
	import { onDestroy } from 'svelte';

	let sites = $state<Site[]>([]);
	let master1 = $state('');
	let master2 = $state('');
	let siteName = $state('');
	let selectedId = $state<number | null>(null);
	let generatedPassword = $state('');
	let filterText = $state('');
	let copied = $state(false);
	let copyTimer = $state<ReturnType<typeof setTimeout> | null>(null);
	let resetTimer = $state<ReturnType<typeof setTimeout> | null>(null);
	let darkMode = $state(false);
	let showSettings = $state(false);
	let activeTab = $state('data');
	let showPassword = $state(false);
	let importError = $state('');
	let importSuccess = $state(false);
	let showTooltip = $state(false);
	let tooltipTimer = $state<ReturnType<typeof setTimeout> | null>(null);
	let showPurgeConfirm = $state(false);
	let purgeCountdown = $state(3);
	let purgeTimer = $state<ReturnType<typeof setTimeout> | null>(null);
	let purgeCountdownTimer = $state<ReturnType<typeof setInterval> | null>(null);

	const SHORT_WAIT = 2000;
	const LONG_WAIT = 10000;

	$effect(() => {
		$versionStore;
		const settings = getSettings();
		darkMode = settings.dark;
	});

	$effect(() => {
		$versionStore;
		sites = getSites();
	});

	$effect(() => {
		document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
	});

	$effect(() => {
		const site = selectedId !== null ? getSiteById(selectedId) : null;
		const master = combinePasswords(master1, master2);
		const syms = site?.limitedCharset ? limitedSymbols : symbols;

		if (site && master) {
			generatePassword(site.name, master, syms, site.length).then((pwd) => {
				generatedPassword = pwd;
			});
		} else {
			generatedPassword = '';
		}
	});

	const filteredSites = $derived(
		filterText
			? sites.filter((s) => {
					const regex = new RegExp(
						filterText.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
						'i'
					);
					return regex.test(s.name);
				})
			: sites
	);

	function addNewSite() {
		const trimmed = siteName.trim();
		if (!trimmed) return;

		const existing = sites.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());

		if (existing) {
			selectedId = existing.id;
			showSuccess();
			siteName = '';
			return;
		}

		const newSite = addSite(trimmed);
		selectedId = newSite!.id;
		showSuccess();
		siteName = '';
	}

	function showSuccess(): void {
		showTooltip = true;
		clearTimeout(tooltipTimer);
		tooltipTimer = setTimeout(() => {
			showTooltip = false;
		}, SHORT_WAIT);
	}

	function handleCopy() {
		if (!generatedPassword) return;

		navigator.clipboard.writeText(generatedPassword).then(() => {
			copied = true;
			clearTimeout(copyTimer);
			clearTimeout(resetTimer);

			copyTimer = setTimeout(() => {
				copied = false;
				master1 = '';
				master2 = '';
			}, SHORT_WAIT);

			resetTimer = setTimeout(() => {}, LONG_WAIT);
		});
	}

	function handleFileImport(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		importError = '';
		importSuccess = false;

		const reader = new FileReader();
		reader.onload = (e) => {
			const text = e.target?.result as string;
			try {
				importSites(text);
				importSuccess = true;
				showSuccess('Sites imported!');
				showSettings = false;
			} catch {
				importError = 'Invalid import data';
			}
			target.value = '';
		};
		reader.onerror = () => {
			importError = 'Failed to read file';
			target.value = '';
		};
		reader.readAsText(file);
	}

	function handleExport() {
		const blob = new Blob([exportSites()], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `cole-vault-export-${new Date().toISOString().split('T')[0]}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function openSettings() {
		showSettings = true;
		importError = '';
		importSuccess = false;
		activeTab = 'data';
	}

	function openPurgeConfirm() {
		showPurgeConfirm = true;
		purgeCountdown = 3;
		clearTimeout(purgeTimer);
		clearInterval(purgeCountdownTimer);
		purgeCountdownTimer = setInterval(() => {
			purgeCountdown--;
			if (purgeCountdown <= 0) {
				clearInterval(purgeCountdownTimer);
				purgeCountdownTimer = null;
			}
		}, 1000);
	}

	function confirmPurge() {
		if (purgeCountdown > 0) return;
		clearTimeout(purgeTimer);
		clearInterval(purgeCountdownTimer);
		purgeTimer = null;
		purgeCountdownTimer = null;
		showPurgeConfirm = false;
		purgeData();
	}

	function cancelPurge() {
		clearTimeout(purgeTimer);
		clearInterval(purgeCountdownTimer);
		purgeTimer = null;
		purgeCountdownTimer = null;
		showPurgeConfirm = false;
	}

	function closeSettings() {
		showSettings = false;
		clearTimeout(purgeTimer);
		clearInterval(purgeCountdownTimer);
		purgeTimer = null;
		purgeCountdownTimer = null;
	}

	onDestroy(() => {
		clearTimeout(copyTimer);
		clearTimeout(resetTimer);
		clearTimeout(tooltipTimer);
		clearTimeout(purgeTimer);
		clearInterval(purgeCountdownTimer);
	});
</script>

<div class="app">
	<header>
		<h1>Cole Vault</h1>
		<div class="header-actions">
			<button class="settings-btn" onclick={() => setSettings({ dark: !darkMode })} title="Toggle theme">
				{#if darkMode}
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="5" />
						<line x1="12" y1="1" x2="12" y2="3" />
						<line x1="12" y1="21" x2="12" y2="23" />
						<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
						<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
						<line x1="1" y1="12" x2="3" y2="12" />
						<line x1="21" y1="12" x2="23" y2="12" />
						<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
						<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
					</svg>
				{:else}
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
					</svg>
				{/if}
			</button>
			<button class="settings-btn" onclick={openSettings} title="Settings">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="3" />
					<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
				</svg>
			</button>
		</div>
	</header>

	<section class="input-section">
		<div class="password-inputs">
			<label for="master1">Password 1</label>
			<input id="master1" type="password" bind:value={master1} placeholder="Enter password 1" />
		</div>
		<div class="password-inputs">
			<label for="master2">Password 2</label>
			<input id="master2" type="password" bind:value={master2} placeholder="Enter password 2" />
		</div>
	</section>

	<section class="site-section">
		<div class="site-input">
			<input type="text" bind:value={siteName} placeholder="Enter new site name" onkeypress={(e) => e.key === 'Enter' && addNewSite()} />
			<button onclick={addNewSite}>Add</button>
		</div>

		<div class="filter-input">
			<input type="text" bind:value={filterText} placeholder="Filter sites..." />
		</div>

		{#if sites.length === 0}
			<p class="empty-message">No sites added yet. Add a site above to get started.</p>
		{:else}
			<table>
				<thead>
					<tr>
						<th></th>
						<th>Site</th>
						<th>Length</th>
						<th>Charset</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each filteredSites as site (site.id)}
						<tr class:selected={selectedId === site.id}>
							<td>
								<input type="radio" name="site" checked={selectedId === site.id} onchange={() => (selectedId = site.id)} />
							</td>
							<td>{site.name}</td>
							<td>
								<select value={site.length} onchange={(e) => updateSite(site.id, { length: Number(e.target.value) })}>
									{#each Array.from({ length: 32 }, (_, i) => i + 1) as len, _i (len)}
										<option value={len}>{len}</option>
									{/each}
								</select>
							</td>
							<td>
								<button class="charset-btn" onclick={() => updateSite(site.id, { limitedCharset: !site.limitedCharset })} title={site.limitedCharset ? 'Limited charset (alphanumeric)' : 'Full ASCII charset'}>
									{site.limitedCharset ? 'Aa1' : 'Aa1!'}
								</button>
							</td>
							<td>
								<button class="delete-btn" onclick={() => removeSite(site.id)} title="Delete site">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<polyline points="3 6 5 6 21 6" />
										<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
									</svg>
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>

	{#if generatedPassword}
		<section class="result-section">
			<div class="password-display" style="font-family: {showPassword ? 'inherit' : 'Courier New, monospace'}">
				{showPassword ? generatedPassword : generatedPassword.split('').map(() => '•').join('')}
			</div>
			<div class="password-actions">
				<button class="toggle-visibility" onclick={() => (showPassword = !showPassword)}>
					{showPassword ? 'Hide' : 'Show'}
				</button>
				<button class="copy-btn" onclick={handleCopy}>
					{copied ? 'Copied!' : 'Copy to Clipboard'}
				</button>
			</div>
		</section>
	{/if}

	{#if showSettings}
		<div class="modal-overlay" role="presentation" tabindex="-1" onclick={(e) => e.target === e.currentTarget && closeSettings()} onkeydown={(e) => e.key === 'Escape' && closeSettings()}>
			<div class="modal data-modal">
				<div class="data-content">
					<div class="tab-header">
						<button class="tab-btn{activeTab === 'data' ? ' active' : ''}" onclick={() => activeTab = 'data'}>Data</button>
						<button class="tab-btn{activeTab === 'charsets' ? ' active' : ''}" disabled>Charsets</button>
						<button class="tab-btn{activeTab === 'settings' ? ' active' : ''}" disabled>Settings</button>
					</div>

					{#if activeTab === 'data'}
						<div class="data-section">
							<h3>Import</h3>
							<label class="file-label">
								<input type="file" accept=".json" onchange={handleFileImport} class="file-input" />
								<span class="file-button">Choose File</span>
							</label>
							{#if importError}
								<p class="error">{importError}</p>
							{/if}
							{#if importSuccess}
								<p class="success">Sites imported successfully!</p>
							{/if}
						</div>

						<div class="data-section">
							<h3>Export</h3>
							<button onclick={handleExport} class="export-btn">Export Sites</button>
							<p class="setting-desc" style="margin-top: 0.75rem;">Download all your sites and settings as a JSON file.</p>
						</div>

						<div class="data-section purge-section">
							<h3 style="color: var(--danger);">Purge</h3>
							<button onclick={openPurgeConfirm} class="purge-btn">Purge Everything</button>
							<p class="setting-desc" style="margin-top: 0.75rem; color: var(--danger);">This will permanently delete all your data. This cannot be undone.</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	{#if showPurgeConfirm}
		<div class="modal-overlay" role="presentation" tabindex="-1" onclick={(e) => e.target === e.currentTarget && cancelPurge()} onkeydown={(e) => e.key === 'Escape' && cancelPurge()}>
			<div class="modal purge-confirm-modal">
				<div class="purge-confirm-content">
					<h2 style="color: var(--danger);">Confirm Purge</h2>
					<p style="margin-bottom: 1rem;">This will permanently delete all your data. This cannot be undone.</p>
					<p class="countdown-text">
						{#if purgeCountdown > 0}
							Please wait <strong>{purgeCountdown}</strong> seconds...
						{:else}
							You may now confirm the purge.
						{/if}
					</p>
					<div class="purge-confirm-actions">
						<button onclick={cancelPurge} class="cancel-purge-btn">Cancel</button>
						<button onclick={confirmPurge} class="confirm-purge-btn" disabled={purgeCountdown > 0}>Confirm Purge</button>
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#if showTooltip}
		<div class="tooltip">Added!</div>
	{/if}
</div>

<style>
	:root {
		--bg: #ffffff;
		--bg-secondary: #f5f5f5;
		--bg-hover: #e8e8e8;
		--text: #1a1a1a;
		--text-secondary: #666666;
		--border: #d0d0d0;
		--primary: #2563eb;
		--primary-hover: #1d4ed8;
		--danger: #dc2626;
		--danger-hover: #b91c1c;
		--success: #16a34a;
		--shadow: rgba(0, 0, 0, 0.1);
		--radius: 8px;
	}

	:global([data-theme='dark']) {
		--bg: #1a1a2e;
		--bg-secondary: #16213e;
		--bg-hover: #0f3460;
		--text: #e0e0e0;
		--text-secondary: #a0a0a0;
		--border: #333366;
		--primary: #4f8ff7;
		--primary-hover: #6b9fff;
		--danger: #ef4444;
		--danger-hover: #f87171;
		--success: #22c55e;
		--shadow: rgba(0, 0, 0, 0.3);
	}

	:global(*) {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	:global(body) {
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
		background-color: var(--bg);
		color: var(--text);
		line-height: 1.6;
		transition:
			background-color 0.3s,
			color 0.3s;
	}

	.app {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid var(--border);
	}

	header h1 {
		font-size: 2rem;
		font-weight: 700;
		color: var(--primary);
	}

	.header-actions {
		display: flex;
		gap: 0.5rem;
	}

	.settings-btn {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.5rem;
		cursor: pointer;
		color: var(--text);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.settings-btn:hover {
		background: var(--bg-hover);
	}

	.input-section {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	@media (max-width: 600px) {
		.input-section {
			grid-template-columns: 1fr;
		}
	}

	.password-inputs {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.password-inputs label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	input,
	select,
	button {
		font-family: inherit;
		font-size: 1rem;
	}

	input[type='text'],
	input[type='password'] {
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--text);
		transition: border-color 0.2s;
	}

	input:focus,
	select:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
	}

	.site-section {
		margin-bottom: 2rem;
	}

	.site-input {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.site-input input {
		flex: 1;
	}

	.site-input button,
	.copy-btn,
	.export-btn,
	.purge-btn {
		padding: 0.75rem 1.5rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		font-weight: 500;
		transition: background-color 0.2s;
	}

	.site-input button:hover,
	.copy-btn:hover,
	.export-btn:hover {
		background: var(--primary-hover);
	}

	.purge-btn:hover {
		background: var(--danger-hover);
	}

	.filter-input {
		margin-bottom: 1rem;
	}

	.filter-input input {
		width: 100%;
	}

	.empty-message {
		text-align: center;
		color: var(--text-secondary);
		padding: 2rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		padding: 0.75rem;
		text-align: left;
		border-bottom: 1px solid var(--border);
	}

	th {
		font-weight: 600;
		color: var(--text-secondary);
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	tr:hover {
		background: var(--bg-secondary);
	}

	tr.selected {
		background: var(--bg-hover);
	}

	select {
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg);
		color: var(--text);
		cursor: pointer;
	}

	.charset-btn {
		padding: 0.25rem 0.5rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
		transition: all 0.2s;
	}

	.charset-btn:hover {
		background: var(--bg-hover);
	}

	.delete-btn {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--danger);
		padding: 0.25rem;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.delete-btn:hover {
		background: var(--danger);
		color: white;
	}

	.result-section {
		text-align: center;
		padding: 2rem;
		background: var(--bg-secondary);
		border-radius: var(--radius);
		border: 2px solid var(--border);
	}

	.password-display {
		font-family: 'Courier New', monospace;
		font-size: 1.5rem;
		letter-spacing: 0.1em;
		margin-bottom: 1rem;
		word-break: break-all;
		user-select: all;
	}

	.password-actions {
		display: flex;
		gap: 0.5rem;
	}

	.toggle-visibility {
		padding: 0.75rem 1.5rem;
		background: var(--bg-secondary);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		cursor: pointer;
		font-weight: 500;
		transition: all 0.2s;
	}

	.toggle-visibility:hover {
		background: var(--bg-hover);
	}

	.copy-btn {
		flex: 1;
	}

	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal {
		background: var(--bg);
		border-radius: var(--radius);
		padding: 0;
		max-width: 500px;
		width: 100%;
		max-height: 80vh;
		overflow: hidden;
		box-shadow: 0 10px 40px var(--shadow);
	}

	.data-content {
		padding: 1.5rem 2rem;
	}

	.tab-header {
		display: flex;
		border-bottom: 2px solid var(--border);
		margin-bottom: 1.25rem;
	}

	.tab-btn {
		flex: 1;
		padding: 0.75rem 1rem;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		border-radius: 0;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		transition: all 0.2s;
	}

	.tab-btn:hover:not(:disabled) {
		color: var(--text);
		background: var(--bg-secondary);
	}

	.tab-btn.active {
		color: var(--primary);
		border-bottom-color: var(--primary);
	}

	.tab-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.data-section {
		margin-bottom: 1.5rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid var(--border);
	}

	.data-section:last-of-type {
		border-bottom: none;
		margin-bottom: 0;
		padding-bottom: 0;
	}

	.data-section h3 {
		font-size: 1rem;
		font-weight: 600;
		margin-bottom: 0.75rem;
	}

	.setting-desc {
		color: var(--text-secondary);
		font-size: 0.875rem;
	}

	.error {
		color: var(--danger);
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}

	.success {
		color: var(--success);
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}

	.file-label {
		display: inline-block;
		cursor: pointer;
	}

	.file-input {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}

	.file-button {
		display: inline-block;
		padding: 0.75rem 1.5rem;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		font-weight: 500;
		font-size: 1rem;
		transition: background-color 0.2s;
	}

	.file-button:hover {
		background: var(--primary-hover);
	}

	.tooltip {
		position: fixed;
		bottom: 2rem;
		left: 50%;
		transform: translateX(-50%);
		background: var(--success);
		color: white;
		padding: 0.75rem 1.5rem;
		border-radius: var(--radius);
		box-shadow: 0 4px 12px var(--shadow);
		animation: fadeIn 0.3s ease;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	:global(input[type='radio']) {
		cursor: pointer;
	}

	.purge-confirm-modal {
		max-width: 400px;
	}

	.purge-confirm-content {
		padding: 2rem;
	}

	.purge-confirm-content h2 {
		margin-bottom: 1rem;
	}

	.countdown-text {
		color: var(--danger);
		font-size: 1.125rem;
		margin-bottom: 1.5rem;
	}

	.purge-confirm-actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
	}

	.cancel-purge-btn,
	.confirm-purge-btn {
		padding: 0.75rem 1.5rem;
		border-radius: var(--radius);
		cursor: pointer;
		font-weight: 500;
		font-size: 1rem;
		border: 1px solid var(--border);
		transition: all 0.2s;
	}

	.cancel-purge-btn {
		background: var(--bg-secondary);
		color: var(--text);
	}

	.cancel-purge-btn:hover {
		background: var(--bg-hover);
	}

	.confirm-purge-btn {
		background: var(--danger);
		color: white;
		border-color: var(--danger);
	}

	.confirm-purge-btn:hover:not(:disabled) {
		background: var(--danger-hover);
	}

	.confirm-purge-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
