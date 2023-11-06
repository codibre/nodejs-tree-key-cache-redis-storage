import { suffixString } from './utils';
import { RedisStorageValueType } from './types';
import { TreeKeyCacheSimpleRedisStorage } from './tree-key-cache-simple-redis-storage';
import { fluentForAsync } from '@codibre/fluent-iterable';

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
			return await this.redisData.incr(key);
		} catch {
			await this.redisData.del(key);
			return this.redisData.incr(key);
		}
	}

	getHistory(key: string) {
		return fluentForAsync(
			this.getLatestVersion(key),
			(x) => x > 0,
			(x) => x - 1,
		)
			.map((version) => this.internalGet(suffixString(key, version)))
			.takeWhile((value) => value !== undefined);
	}

	async set(
		key: string,
		value: RedisStorageValueType<BufferMode>,
		ttl?: number | undefined,
	): Promise<void> {
		const version = await this.getNextVersion(key);
		await super.set(suffixString(key, version), value, ttl);
	}
}
