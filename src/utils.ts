import { fluent, interval } from '@codibre/fluent-iterable';

const INT_SIZE = 4;
const START_CHAR = 32;
const BASE_SIZE = 95;
const forbidden = ':';
const escape = '\\';
const toEscape = '_';
const escapeEscape = `${escape}${toEscape.length}`;
const escapes = fluent(toEscape)
	.withIndex()
	.map(({ idx }) => `${escape}${idx}`)
	.toArray();
const rawBase = interval(START_CHAR, BASE_SIZE)
	.map(String.fromCharCode)
	.filter(
		(c) => !forbidden.includes(c) || !toEscape.includes(c) || c === escape,
	)
	.join('');
const size = rawBase.length;

export function encodeInt(value: number) {
	const result: string[] = [];
	while (value > 0) {
		const rest = value % size;
		value = Math.floor(value / size);
		result.push(rawBase[rest] as string);
	}
	return result.join('');
}

function applyScapeInternal(str: string) {
	return fluent(str).map((c) => {
		if (c === escape) return escapeEscape;
		const pos = toEscape.indexOf(c);
		if (pos >= 0) return escapes[pos] as string;
		return c;
	});
}

export function suffixString(str: string, suffix: number) {
	return applyScapeInternal(str).append('_').append(encodeInt(suffix)).join('');
}
export function applyScape(pattern: string) {
	return applyScapeInternal(pattern).join('');
}

export function isBaseKey(key: string) {
	return !key.includes(toEscape);
}

export function getBufferedInt(version: number) {
	let bufferedVersion = Buffer.alloc(INT_SIZE);
	bufferedVersion.writeInt32LE(version);
	let firstRightZero = INT_SIZE - 1;
	while (!bufferedVersion[firstRightZero] && firstRightZero >= 0) {
		firstRightZero--;
	}
	bufferedVersion = bufferedVersion.slice(0, firstRightZero + 1);
	return bufferedVersion;
}

export function readBufferedInt(value: Buffer | null | undefined) {
	if (!value) return 0;
	const buffer = Buffer.alloc(INT_SIZE);
	value.copy(buffer);
	return buffer.readInt32LE(0);
}
export function getPageToken([strToken, results]: [string, string[]]) {
	const nextPageToken = Number(strToken);
	return {
		nextPageToken: nextPageToken || undefined,
		results,
	};
}
