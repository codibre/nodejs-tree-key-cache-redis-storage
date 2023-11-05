import { KeyTreeCacheStorage } from 'tree-key-cache';
import { Redis } from 'ioredis';
import { RedisStorageValueType } from './types';
import { depaginate } from '@codibre/fluent-iterable';

const COUNT_CHILDREN = 1000;
export abstract class TreeKeyCacheBaseRedisStorage<BufferMode extends boolean>
	implements KeyTreeCacheStorage<RedisStorageValueType<BufferMode>>
{
	protected abstract redisGet: BufferMode extends true ? 'getBuffer' : 'get';
	protected abstract redisChildren: Redis;
	protected abstract redisData: Redis;
	protected abstract childrenRegistry: boolean;
	protected abstract defaultTtl: number | undefined;

	async clearAllChildrenRegistry(): Promise<void> {
		await this.redisChildren.flushdb();
	}

	get(key: string) {
		return this.internalGet(key);
	}

	protected async internalGetFromRedis(redis: Redis, key: string) {
		const result = await redis[this.redisGet](key);
		return result === null
			? undefined
			: (result as RedisStorageValueType<BufferMode>);
	}

	protected internalGet(key: string) {
		return this.internalGetFromRedis(this.redisData, key);
	}

	async set(
		key: string,
		value: RedisStorageValueType<BufferMode>,
		ttl?: number | undefined,
	) {
		const redis = this.redisData;
		await this.internalSet(ttl, redis, key, value);
	}

	protected async internalSet(
		ttl: number | undefined,
		redis: Redis,
		key: string,
		value: string | Buffer,
	) {
		ttl ??= this.defaultTtl;
		await (ttl ? redis.setex(key, ttl, value) : redis.set(key, value));
	}

	protected abstract getChildrenKey(key: string | undefined): string;

	async *getChildren(key?: string | undefined): AsyncIterable<string> {
		if (!this.childrenRegistry) {
			throw new TypeError('getChildren not supported!');
		}
		const childrenKey = this.getChildrenKey(key);
		return depaginate(async (cursor: string | number = 0) => {
			const [nextPageToken, results] = await this.redisChildren.sscan(
				childrenKey,
				cursor,
				'COUNT',
				COUNT_CHILDREN,
			);
			return {
				nextPageToken,
				results,
			};
		});
	}

	getCurrentTtl(key: string): number | Promise<number | undefined> | undefined {
		return this.redisData.ttl(key);
	}

	randomIterate(pattern?: string | undefined): AsyncIterable<string> {
		const getNext = pattern
			? (cursor: string | number = 0) =>
					this.redisChildren.scan(
						cursor,
						'MATCH',
						pattern,
						'COUNT',
						COUNT_CHILDREN,
					)
			: (cursor: string | number = 0) =>
					this.redisChildren.scan(cursor, 'COUNT', COUNT_CHILDREN);
		return depaginate(async (token: string | number | undefined) => {
			const [nextPageToken, results] = await getNext(token);
			return {
				nextPageToken,
				results,
			};
		});
	}

	async registerChild(parentKey: string | undefined, partialKey: string) {
		if (this.childrenRegistry) {
			const redis = this.redisData;
			const childrenKey = this.getChildrenKey(parentKey);

			await redis.sadd(childrenKey, partialKey);
		}
	}
}
