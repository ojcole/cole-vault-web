export const combinePasswords = (...passwords: string[]) => {
	return passwords.join('');
};

const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const lowercase = 'abcdefghijklmnopqrstuvwxyz';
const numbers = '0123456789';
const specialChars = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~ ';

export const symbols = uppercase + lowercase + numbers + specialChars;
export const limitedSymbols = uppercase + lowercase + numbers;

export const generatePassword = async (
	website: string,
	master: string,
	symbols: string,
	length: number
): Promise<string> => {
	const stringToHash = master + website.toUpperCase() + master;

	const buf = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(stringToHash));

	const hex = Array.prototype.map
		.call(new Uint8Array(buf), (x) => ('00' + x.toString(16)).slice(-2))
		.join('')
		.substring(0, 4 * length);

	return hexToPassword(hex, symbols);
};

export const hexToPassword = (hexString: string, symbols: string): string => {
	const values = hexString.match(/.{4}/g)?.map((hex) => Number.parseInt(hex, 16) % symbols.length);

	if (values === undefined) {
		return '';
	}

	return values.map((val) => symbols[val]).join('');
};
