import { migrateConfig, SCHEMA_VERSION } from './migrations';

export interface Site {
	id: number;
	name: string;
	length: number;
	limitedCharset: boolean;
}

export interface AppSettings {
	dark: boolean;
}

export interface Config {
	version: string;
	settings: AppSettings;
	sites: Site[];
}

const STORE_KEY = 'cole-vault';
const DARK_KEY = 'cole-vault-dark';

const defaultSites: Site[] = [];

let savedDark = false;
try {
	const stored = localStorage.getItem(DARK_KEY);
	if (stored !== null) {
		savedDark = stored === 'true';
	}
} catch {
	// Ignore errors reading dark mode preference
}

const defaultSettings: AppSettings = {
	dark: savedDark
};

const defaultConfig: Config = {
	version: '2',
	settings: defaultSettings,
	sites: defaultSites
};

const loadConfig = (): Config => {
	try {
		const stored = localStorage.getItem(STORE_KEY);
		if (stored) {
			const parsed: Record<string, unknown> = JSON.parse(stored);
			if (parsed && Array.isArray(parsed.sites)) {
				return migrateConfig(parsed as Record<string, unknown>);
			}
		}
	} catch {
		// Corrupted data, use defaults
	}

	return defaultConfig;
};

const saveConfig = (config: Config) => {
	localStorage.setItem(STORE_KEY, JSON.stringify(config));
	localStorage.setItem(DARK_KEY, String(config.settings.dark));
};

const config = loadConfig();

// Track the highest used ID so new ones are always unique
let nextId = 0;
for (const site of config.sites) {
	if (Number.isInteger(site.id) && site.id > nextId) {
		nextId = site.id;
	}
}

// Version store: triggers reactivity in components via $effect
let versionValue = 0;
const subscribers: Set<() => void> = new Set();

export const versionStore = {
	subscribe(fn: (value: number) => void) {
		fn(versionValue);
		const sub = () => fn(versionValue);
		subscribers.add(sub);
		return () => {
			subscribers.delete(sub);
		};
	},
	peek() {
		return versionValue;
	}
};

export const getConfig = (): Config => config;

export const getSites = (): Site[] => config.sites;

export const getSettings = (): AppSettings => ({ ...config.settings });

const inc = () => {
	versionValue++;
	for (const sub of subscribers) sub();
};

export const setSettings = (settings: AppSettings) => {
	config.settings = { ...settings };
	inc();
	saveConfig(config);
};

export const addSite = (siteName: string): Site | null => {
	const existing = config.sites.find((s) => s.name.toLowerCase() === siteName.toLowerCase());
	if (existing) {
		return existing;
	}

	const newSite: Site = {
		id: ++nextId,
		name: siteName,
		length: 32,
		limitedCharset: false
	};

	config.sites.push(newSite);
	config.sites.sort((a, b) => compareSites(a, b));
	inc();
	saveConfig(config);
	return newSite;
};

export const removeSite = (id: number) => {
	config.sites = config.sites.filter((s) => s.id !== id);
	inc();
	saveConfig(config);
};

export const updateSite = (id: number, updates: Partial<Site>) => {
	const index = config.sites.findIndex((s) => s.id === id);
	if (index !== -1) {
		config.sites[index] = { ...config.sites[index], ...updates };
		config.sites.sort((a, b) => compareSites(a, b));
		inc();
		saveConfig(config);
	}
};

export const getSiteById = (id: number): Site | undefined => {
	return config.sites.find((s) => s.id === id);
};

export const compareSites = (a: Site, b: Site): number => {
	if (a.name < b.name) return -1;
	if (a.name > b.name) return 1;
	if (a.length < b.length) return -1;
	if (a.length > b.length) return 1;
	if (!a.limitedCharset && b.limitedCharset) return -1;
	if (a.limitedCharset && !b.limitedCharset) return 1;
	return 0;
};

export const exportSites = (): string => {
	const exportData = {
		sites: config.sites.map(({ id: _skipId, name, ...rest }) => ({
			site: name,
			...rest
		})),
		settings: config.settings,
		exportDate: new Date().toISOString(),
		version: SCHEMA_VERSION
	};
	return JSON.stringify(exportData, null, 2);
};

export const purgeData = () => {
	localStorage.removeItem(STORE_KEY);
	localStorage.removeItem(DARK_KEY);
	window.location.reload();
};

export const importSites = (jsonString: string): Config => {
	try {
		const parsed = JSON.parse(jsonString);
		if (parsed && Array.isArray(parsed.sites)) {
			const imported = migrateConfig(parsed as Record<string, unknown>);
			const importedSites = imported.sites.map((s, i) => {
				const id = (typeof s.id === 'number' && s.id > 0) ? s.id : ++nextId;
				if (Number.isInteger(id) && id > nextId) nextId = id;
				return { ...s, id };
			});
			config.version = SCHEMA_VERSION;
			config.settings = imported.settings || defaultSettings;
			config.sites = importedSites;
			inc();
			saveConfig(config);
			return config;
		}
	} catch {
		// Invalid JSON
	}
	return config;
};
