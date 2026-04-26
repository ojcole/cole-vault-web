import type { Config, Site } from './store.svelte';

export const SCHEMA_VERSION = '2';

export interface RawConfig {
	version?: string;
	settings?: Record<string, unknown>;
	sites?: unknown[];
}

export interface ExternalSite {
	id?: number;
	site?: string;
	name?: string;
	length?: number;
	limitedCharset?: boolean;
}

const isExternalConfig = (raw: RawConfig): boolean => {
	if (raw.version === undefined || raw.version === '' || raw.version === null) {
		return true;
	}
	const versionNum = parseFloat(raw.version);
	const currentNum = parseFloat(SCHEMA_VERSION);
	if (versionNum < currentNum) {
		return true;
	}
	if (Array.isArray(raw.sites) && raw.sites.length > 0) {
		const firstSite = raw.sites[0] as Record<string, unknown>;
		if (typeof firstSite.site === 'string' && typeof firstSite.name !== 'string') {
			return true;
		}
	}
	return false;
};

const migrateExternalToInternal = (raw: RawConfig): Config => {
	const settings = raw.settings ?? { dark: false };
	const sites: Site[] = (raw.sites ?? [])
		.filter((s): s is ExternalSite => typeof s === 'object' && s !== null)
		.map((s): Site => ({
			id: typeof s.id === 'number' ? s.id : 0,
			name: typeof s.name === 'string' ? s.name : typeof s.site === 'string' ? s.site : '',
			length: typeof s.length === 'number' ? s.length : 32,
			limitedCharset: typeof s.limitedCharset === 'boolean' ? s.limitedCharset : false
		}));

	return { version: SCHEMA_VERSION, settings, sites };
};

export const migrateConfig = (raw: RawConfig): Config => {
	if (isExternalConfig(raw)) {
		return migrateExternalToInternal(raw);
	}

	const config: Config = {
		version: SCHEMA_VERSION,
		settings: raw.settings ?? { dark: false },
		sites: (raw.sites ?? []).map((s) => {
			const site = s as Record<string, unknown>;
			return {
				id: typeof site.id === 'number' ? site.id : 0,
				name: typeof site.name === 'string' ? site.name : '',
				length: typeof site.length === 'number' ? site.length : 32,
				limitedCharset: typeof site.limitedCharset === 'boolean' ? site.limitedCharset : false
			};
		})
	};

	return config;
};
