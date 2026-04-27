import { migrateConfig, SCHEMA_VERSION } from './migrations';

export interface Site {
	id: number;
	name: string;
	length: number;
	charset: string;
}

export interface Charset {
	name: string;
	chars: string;
}

export interface AppSettings {
	dark: boolean;
	charsets: Charset[];
	defaultCharset?: string;
	defaultLength?: number;
}

export interface Config {
	version: string;
	settings: AppSettings;
	sites: Site[];
}

const STORE_KEY = 'cole-vault';
const DARK_KEY = 'cole-vault-dark';

const defaultSites: Site[] = [];

const defaultCharsets: Charset[] = [
	{
		name: 'Full ASCII',
		chars:
			'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~ '
	},
	{ name: 'Alphanumeric', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' }
];

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
	dark: savedDark,
	charsets: defaultCharsets
};

const defaultConfig: Config = {
	version: '3',
	settings: defaultSettings,
	sites: defaultSites
};

const charsetExistsIn = (charsets: Charset[], chars: string): boolean => {
	return charsets.some((c) => c.chars === chars);
};

const charsetByNameIn = (charsets: Charset[], name: string): Charset | undefined => {
	return charsets.find((c) => c.name === name);
};

const fixOrphanedCharsets = (config: Config) => {
	const charsets = config.settings.charsets;
	let counter = 1;
	// Find the highest existing "Custom Charset N" number
	for (const cs of charsets) {
		const match = cs.name.match(/^Custom Charset (\d+)$/);
		if (match) {
			const num = parseInt(match[1], 10);
			if (num >= counter) counter = num + 1;
		}
	}
	for (const site of config.sites) {
		if (!site.charset) continue;
		if (!charsetExistsIn(charsets, site.charset)) {
			let uniqueName = `Custom Charset ${counter}`;
			while (charsetByNameIn(charsets, uniqueName)) {
				counter++;
				uniqueName = `Custom Charset ${counter}`;
			}
			charsets.push({ name: uniqueName, chars: site.charset });
			counter++;
		}
	}
};

const loadConfig = (): Config => {
	try {
		const stored = localStorage.getItem(STORE_KEY);
		if (stored) {
			const parsed: Record<string, unknown> = JSON.parse(stored);
			if (parsed && Array.isArray(parsed.sites)) {
				const config = migrateConfig(parsed as Record<string, unknown>);
				// Ensure default charsets exist
				if (!Array.isArray(config.settings.charsets)) {
					config.settings.charsets = [...defaultCharsets];
				}
				fixOrphanedCharsets(config);
				return config;
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

export const getSettings = (): AppSettings => ({
	...config.settings,
	charsets: [...(config.settings.charsets ?? defaultCharsets)],
	defaultCharset: config.settings.defaultCharset ?? config.settings.charsets?.[0]?.name,
	defaultLength: config.settings.defaultLength ?? 32
});

const inc = () => {
	versionValue++;
	for (const sub of subscribers) sub();
};

export const setSettings = (settings: AppSettings) => {
	config.settings = { ...settings };
	inc();
	saveConfig(config);
};

export const addCharset = (name: string, chars: string): Charset | null => {
	const existing = config.settings.charsets.find(
		(c) => c.name.toLowerCase() === name.toLowerCase()
	);
	if (existing) {
		return null;
	}

	const newCharset: Charset = { name, chars };
	config.settings.charsets.push(newCharset);
	inc();
	saveConfig(config);
	return newCharset;
};

export const charsetIsUsed = (name: string): boolean => {
	const charset = config.settings.charsets.find((c) => c.name === name);
	if (!charset) return false;
	return config.sites.some((s) => s.charset === charset.chars);
};

export const deleteCharset = (name: string): boolean => {
	if (charsetIsUsed(name)) {
		return false;
	}
	config.settings.charsets = config.settings.charsets.filter((c) => c.name !== name);
	inc();
	saveConfig(config);
	return true;
};

export const renameCharset = (oldName: string, newName: string) => {
	const index = config.settings.charsets.findIndex((c) => c.name === oldName);
	if (index !== -1) {
		config.settings.charsets[index].name = newName;
		if (config.settings.defaultCharset === oldName) {
			config.settings.defaultCharset = newName;
		}
		inc();
		saveConfig(config);
	}
};

export const addSite = (siteName: string, length?: number, charsetChars?: string): Site | null => {
	const existing = config.sites.find((s) => s.name.toLowerCase() === siteName.toLowerCase());
	if (existing) {
		return existing;
	}

	const selectedCharset = charsetChars
		? charsetChars
		: config.settings.defaultCharset
			? (config.settings.charsets?.find((c) => c.name === config.settings.defaultCharset)?.chars ??
				config.settings.charsets?.[0]?.chars ??
				'')
			: (config.settings.charsets?.[0]?.chars ?? '');

	const newSite: Site = {
		id: ++nextId,
		name: siteName,
		length: Math.max(1, Math.min(32, length ?? config.settings.defaultLength ?? 32)),
		charset: selectedCharset
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
	if (!a.charset && b.charset) return -1;
	if (a.charset && !b.charset) return 1;
	return 0;
};

export const exportSites = (): string => {
	const exportData = {
		sites: config.sites.map(({ id: _skipId, name, length, charset, ...rest }) => ({
			site: name,
			length,
			charset,
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

			// Override settings with imported settings
			config.version = SCHEMA_VERSION;
			config.settings = imported.settings || defaultSettings;

			// Merge charsets: deduplicate by `chars`, imported overwrites existing name
			const importedCharsets = imported.settings?.charsets || [];
			const existingCharsets = config.settings.charsets || [];
			const charsetByChars = new Map<string, Charset>();
			for (const cs of existingCharsets) {
				charsetByChars.set(cs.chars, cs);
			}
			for (const cs of importedCharsets) {
				const existing = charsetByChars.get(cs.chars);
				if (existing) {
					existing.name = cs.name;
				} else {
					charsetByChars.set(cs.chars, { ...cs });
				}
			}
			config.settings.charsets = Array.from(charsetByChars.values());

			// Merge sites: deduplicate by name (case-insensitive), imported overwrites existing
			const importedSites = imported.sites.map((s) => {
				let id = s.id;
				if (typeof id !== 'number' || id <= 0) {
					id = ++nextId;
				}
				if (Number.isInteger(id) && id > nextId) {
					nextId = id;
				}
				return { ...s, id };
			});
			const existingSites = new Map<string, Site>();
			for (const site of config.sites) {
				existingSites.set(site.name.toLowerCase(), site);
			}
			for (const site of importedSites) {
				existingSites.set(site.name.toLowerCase(), site);
			}
			config.sites = Array.from(existingSites.values());
			config.sites.sort((a, b) => compareSites(a, b));

			// Recreate any charsets that sites reference but aren't in the merged list
			fixOrphanedCharsets(config);

			inc();
			saveConfig(config);
			return config;
		}
	} catch {
		// Invalid JSON
	}
	return config;
};
