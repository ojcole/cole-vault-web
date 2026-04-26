import { vi } from 'vitest';

const storage: Record<string, string> = {};

const mockLocalStorage = {
	getItem: vi.fn((key: string) => storage[key] ?? null),
	setItem: vi.fn((key: string, value: string) => {
		storage[key] = value;
	}),
	removeItem: vi.fn((key: string) => {
		delete storage[key];
	}),
	clear: vi.fn(() => {
		Object.keys(storage).forEach((key) => delete storage[key]);
	}),
	length: 0,
	getKey: vi.fn((index: number) => Object.keys(storage)[index] ?? null)
};

Object.defineProperty(globalThis, 'localStorage', {
	value: mockLocalStorage,
	writable: true,
	configurable: true
});

export function resetStorage() {
	Object.keys(storage).forEach((key) => delete storage[key]);
	mockLocalStorage.setItem.mockClear();
	mockLocalStorage.getItem.mockClear();
	mockLocalStorage.removeItem.mockClear();
	mockLocalStorage.clear.mockClear();
}
