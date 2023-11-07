import { fluent, interval } from '@codibre/fluent-iterable';

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
export function applyEscape(str: string) {
	return applyScapeInternal(str).join('');
}
export function removeEscape(str: string) {
	str = str.replace(escapeEscape, escape);
	escapes.forEach(
		(e, index) => (str = str.replace(e, toEscape[index] as string)),
	);
	return str;
}

export function isBaseKey(key: string) {
	return !key.includes(toEscape);
}

export function getPageToken([strToken, results]: [string, string[]]) {
	const nextPageToken = Number(strToken);
	return {
		nextPageToken: nextPageToken || undefined,
		results,
	};
}
export function addSuffix(treatedKey: string, version: number): string {
	return `${treatedKey}_${encodeInt(version)}`;
}
