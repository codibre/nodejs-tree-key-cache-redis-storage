import { KeyTreeCacheStorage } from 'tree-key-cache';
import IORedis, { Redis } from 'ioredis';
import { RedisConnection, RedisStorageValueType } from './types';
import { depaginate } from '@codibre/fluent-iterable';
import { getPageToken } from './utils';

export interface TreeKeyCacheBaseRedisStorageNonRequiredOptions {
	port: number;
	childrenDb: number;
	childrenRegistry: boolean;
	defaultTtl: number;
}

export interface TreeKeyCacheBaseRedisStorageOptions<BufferMode extends boolean>
	extends Partial<TreeKeyCacheBaseRedisStorageNonRequiredOptions>,
		RedisConnection {
	bufferMode: BufferMode;
}

const COUNT_CHILDREN = 1000;
const baseDefaultOptions: TreeKeyCacheBaseRedisStorageNonRequiredOptions = {
	childrenDb: 16,
	port: 6379,
	childrenRegistry: false,
	defaultTtl: 0,
};

export abstract class TreeKeyCacheBaseRedisStorage<
	BufferMode extends boolean,
	Options extends TreeKeyCacheBaseRedisStorageOptions<BufferMode>,
> implements KeyTreeCacheStorage<RedisStorageValueType<BufferMode>>
{
	private redisGet: BufferMode extends true ? 'getBuffer' : 'get';
	private redisChildren: Redis;
	protected abstract redisData: Redis;
	protected options: Required<Options> &
		Required<TreeKeyCacheBaseRedisStorageNonRequiredOptions>;

	constructor(options: Options) {
		this.options = {
			...(baseDefaultOptions as Required<TreeKeyCacheBaseRedisStorageNonRequiredOptions>),
			...(options as Required<Options>),
		};
		this.redisGet = (
			this.options.bufferMode ? 'getBuffer' : 'get'
		) as typeof this.redisGet;
		this.redisChildren = new IORedis(this.options.port, options.host, {
			db: options.childrenDb,
		});
	}

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
		ttl ??= this.options.defaultTtl;
		await (ttl ? redis.setex(key, ttl, value) : redis.set(key, value));
	}

	protected getChildrenKey(key: string | undefined) {
		return key ?? '';
	}

	getChildren(key?: string | undefined): AsyncIterable<string> {
		if (!this.options.childrenRegistry) {
			throw new Error('getChildren not supported!');
		}
		const childrenKey = this.getChildrenKey(key);
		return depaginate(async (cursor: string | number = 0) =>
			getPageToken(
				await this.redisChildren.sscan(
					childrenKey,
					cursor,
					'COUNT',
					COUNT_CHILDREN,
				),
			),
		);
	}

	async getCurrentTtl(key: string) {
		const result = await this.redisData.ttl(key);
		return result < 0 ? undefined : result;
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
		return depaginate(async (token: string | number | undefined) =>
			getPageToken(await getNext(token)),
		);
	}

	async registerChild(parentKey: string | undefined, partialKey: string) {
		if (this.options.childrenRegistry) {
			const redis = this.redisChildren;
			const childrenKey = this.getChildrenKey(parentKey);

			await redis.sadd(childrenKey, partialKey);
		}
	}
}
