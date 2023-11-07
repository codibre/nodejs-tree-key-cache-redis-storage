import { applyEscape, isBaseKey, removeEscape } from './utils';
import { RedisStorageValueType } from './types';
import { TreeKeyCacheSimpleRedisStorage } from './tree-key-cache-simple-redis-storage';
import { fluentAsync, fluentForAsync } from '@codibre/fluent-iterable';
import { addSuffix } from './utils';

/**
 * A key history enabled TreeKeyCacheStorage implementation
 * that uses an insert only implementation: every new set
 * will be a new key. This approach have randomIterate and getHistory
 * implemented and iterations through any setting method will act
 * like a new node is always being gotten.
 * We recommend to use this approach with a low ttl, to avoid memory issues.
 */
export class TreeKeyCacheInsertOnlyRedisStorage<
	BufferMode extends boolean = true,
> extends TreeKeyCacheSimpleRedisStorage<BufferMode> {
	async get(_key: string) {
		return undefined;
	}

	private async getLatestVersion(key: string) {
		return Number((await this.redisData.get(key)) ?? 0);
	}

	private async getNextVersion(key: string) {
		try {
			const result = await this.redisData.incr(key);
			if (Number.isNaN(result)) {
				throw new TypeError('Not a number');
			}
			return result;
		} catch {
			await this.redisData.del(key);
			return this.redisData.incr(key);
		}
	}

	getHistory(key: string) {
		const treatedKey = applyEscape(key);
		return fluentForAsync(
			this.getLatestVersion(treatedKey),
			(x) => x > 0,
			(x) => x - 1,
		)
			.map((version) => this.internalGet(addSuffix(treatedKey, version)))
			.takeWhile((value) => value !== undefined);
	}

	async set(
		key: string,
		value: RedisStorageValueType<BufferMode>,
		ttl?: number | undefined,
	): Promise<void> {
		const treatedKey = applyEscape(key);
		const version = await this.getNextVersion(treatedKey);
		await super.set(addSuffix(treatedKey, version), value, ttl);
	}

	randomIterate(pattern?: string | undefined) {
		return fluentAsync(super.randomIterate(pattern))
			.filter(isBaseKey)
			.map(removeEscape);
	}
}
