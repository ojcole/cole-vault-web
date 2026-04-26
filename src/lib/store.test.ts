import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetStorage } from './test-setup';

function loadStore() {
	return import('./store.svelte');
}

function getVersion(store: any) {
	return store.versionStore.peek();
}

describe('store', () => {
	beforeEach(() => {
		resetStorage();
		vi.resetModules();
	});

	it('addSite returns the new site and getSites reflects it', async () => {
		const store = await loadStore();
		const existing = store.getSites();
		expect(existing.length).toBe(0);

		const result = store.addSite('test-site');
		expect(result).not.toBeNull();
		expect(result!.name).toBe('test-site');
		expect(result!.length).toBe(32);
		expect(result!.limitedCharset).toBe(false);
		expect(typeof result!.id).toBe('number');

		const updated = store.getSites();
		expect(updated.length).toBe(1);
		expect(updated[0].name).toBe('test-site');
	});

	it('addSite returns existing site if name already exists (case-insensitive)', async () => {
		const store = await loadStore();
		store.addSite('MySite');
		const result = store.addSite('mysite');
		expect(result!.name).toBe('MySite');

		const sites = store.getSites();
		expect(sites.length).toBe(1);
	});

	it('addSite sorts sites by name after adding', async () => {
		const store = await loadStore();
		store.addSite('zebra');
		store.addSite('alpha');
		store.addSite('middle');

		const sites = store.getSites();
		expect(sites[0].name).toBe('alpha');
		expect(sites[1].name).toBe('middle');
		expect(sites[2].name).toBe('zebra');
	});

	it('removeSite removes the site and updates getSites', async () => {
		const store = await loadStore();
		const site1 = store.addSite('site-a');
		const _site2 = store.addSite('site-b');
		expect(store.getSites().length).toBe(2);

		store.removeSite(site1!.id);
		expect(store.getSites().length).toBe(1);
		expect(store.getSites()[0].name).toBe('site-b');
	});

	it('updateSite updates site properties', async () => {
		const store = await loadStore();
		const site = store.addSite('test');
		expect(site!.length).toBe(32);
		expect(site!.limitedCharset).toBe(false);

		store.updateSite(site!.id, { length: 16, limitedCharset: true });
		const updated = store.getSiteById(site!.id);
		expect(updated!.length).toBe(16);
		expect(updated!.limitedCharset).toBe(true);
	});

	it('getSiteById returns undefined for non-existent id', async () => {
		const store = await loadStore();
		expect(store.getSiteById(99999)).toBeUndefined();
	});

	it('setSettings creates a new object reference (theme toggle fix)', async () => {
		const store = await loadStore();

		const before = store.getSettings();
		expect(before.dark).toBe(false);

		store.setSettings({ dark: true });
		const after = store.getSettings();

		expect(after.dark).toBe(true);
		expect(after).not.toBe(before);
	});

	it('setSettings persists dark mode across reads', async () => {
		const store = await loadStore();
		store.setSettings({ dark: true });

		const read1 = store.getSettings();
		const read2 = store.getSettings();

		expect(read1.dark).toBe(true);
		expect(read2.dark).toBe(true);
		expect(read1.dark).toBe(read2.dark);
	});

	it('getSettings returns a fresh object each time', async () => {
		const store = await loadStore();
		store.setSettings({ dark: true });

		const a = store.getSettings();
		const b = store.getSettings();

		expect(a).not.toBe(b);
	});

	it('exportSites returns valid JSON string', async () => {
		const store = await loadStore();
		store.addSite('example');

		const exported = store.exportSites();
		const parsed = JSON.parse(exported);

		expect(parsed).toHaveProperty('sites');
		expect(Array.isArray(parsed.sites)).toBe(true);
		expect(parsed).toHaveProperty('exportDate');
		expect(parsed).toHaveProperty('version');
	});

	it('importSites loads sites from JSON', async () => {
		const store = await loadStore();
		expect(store.getSites().length).toBe(0);

		const json = JSON.stringify({
			sites: [{ name: 'imported-site', length: 24, limitedCharset: true }],
			exportDate: '2025-01-01',
			version: '1.0'
		});

		store.importSites(json);
		const sites = store.getSites();
		expect(sites.length).toBe(1);
		expect(sites[0].name).toBe('imported-site');
		expect(sites[0].length).toBe(24);
		expect(sites[0].limitedCharset).toBe(true);
	});

	it('importSites handles invalid JSON gracefully', async () => {
		const store = await loadStore();
		const result = store.importSites('not-json');
		expect(result.sites.length).toBe(0);
	});

	it('site IDs auto-increment and are always unique', async () => {
		const store = await loadStore();
		const a = store.addSite('aaa');
		const b = store.addSite('bbb');
		const c = store.addSite('ccc');

		expect(a!.id).toBe(1);
		expect(b!.id).toBe(2);
		expect(c!.id).toBe(3);
		expect(a!.id).not.toBe(b!.id);
		expect(b!.id).not.toBe(c!.id);
		expect(a!.id).not.toBe(c!.id);
	});

	it("imported sites with explicit IDs don't conflict with new sites", async () => {
		const store = await loadStore();
		const json = JSON.stringify({
			sites: [{ id: 10, name: 'old-site', length: 32, limitedCharset: false }],
			exportDate: '2025-01-01',
			version: '1.0'
		});

		store.importSites(json);
		expect(store.getSites()[0].id).toBe(10);

		const newSite = store.addSite('new-site');
		expect(newSite!.id).toBeGreaterThan(10);
	});

	it('version increments on addSite', async () => {
		const store = await loadStore();
		const v0 = getVersion(store);

		store.addSite('site-a');
		expect(getVersion(store)).toBeGreaterThan(v0);

		const v1 = getVersion(store);
		store.addSite('site-b');
		expect(getVersion(store)).toBeGreaterThan(v1);
	});

	it('version increments on removeSite', async () => {
		const store = await loadStore();
		const site = store.addSite('site-a');
		const v0 = getVersion(store);

		store.removeSite(site!.id);
		expect(getVersion(store)).toBeGreaterThan(v0);
	});

	it('version increments on updateSite', async () => {
		const store = await loadStore();
		const site = store.addSite('site-a');
		const v0 = getVersion(store);

		store.updateSite(site!.id, { length: 16 });
		expect(getVersion(store)).toBeGreaterThan(v0);
	});

	it('version increments on setSettings', async () => {
		const store = await loadStore();
		const v0 = getVersion(store);

		store.setSettings({ dark: true });
		expect(getVersion(store)).toBeGreaterThan(v0);
	});

	it('version increments on importSites', async () => {
		const store = await loadStore();
		const v0 = getVersion(store);

		const json = JSON.stringify({
			sites: [{ name: 'imported', length: 32, limitedCharset: false }],
			exportDate: '2025-01-01',
			version: '1.0'
		});

		store.importSites(json);
		expect(getVersion(store)).toBeGreaterThan(v0);
	});

	it('export uses "site" field for Password-Manager compatibility', async () => {
		const store = await loadStore();
		store.addSite('example');

		const exported = store.exportSites();
		const parsed = JSON.parse(exported);

		expect(parsed.sites[0]).toHaveProperty('site');
		expect(parsed.sites[0].site).toBe('example');
		expect(parsed.sites[0]).not.toHaveProperty('name');
		expect(parsed.sites[0]).toHaveProperty('length');
		expect(parsed.sites[0]).toHaveProperty('limitedCharset');
	});

	it('import accepts "site" field from Password-Manager', async () => {
		const store = await loadStore();
		const json = JSON.stringify({
			sites: [{ site: 'pm-site', length: 24, limitedCharset: true }],
			exportDate: '2025-01-01',
			version: '1.0'
		});

		store.importSites(json);
		const sites = store.getSites();
		expect(sites.length).toBe(1);
		expect(sites[0].name).toBe('pm-site');
		expect(sites[0].length).toBe(24);
		expect(sites[0].limitedCharset).toBe(true);
	});

	it('export and import are compatible with Password-Manager format', async () => {
		const store = await loadStore();
		store.addSite('test-site');

		const exported = store.exportSites();
		resetStorage();
		vi.resetModules();

		const store2 = await loadStore();
		store2.importSites(exported);
		expect(store2.getSites().length).toBe(1);
		expect(store2.getSites()[0].name).toBe('test-site');
	});
});
