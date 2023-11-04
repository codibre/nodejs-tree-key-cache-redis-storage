import { KeyTreeCacheStorage } from 'tree-key-cache';
import {
	TreeKeyCacheRedisStorageNonRequiredOptions,
	TreeKeyCacheRedisStorageOptions,
} from './tree-key-cache-redis-storage-options';
import IORedis, { Redis } from 'ioredis';
import { performance } from 'perf_hooks';

const defaultOptions: TreeKeyCacheRedisStorageNonRequiredOptions = {
	insertOnly: false,
	bufferMode: true,
	childrenDb: 16,
	port: 6379,
	dbPoolDaysCount: 7,
};
const DAY_SCALE = 86400000;

export type RedisStorageValueType<BufferMode extends boolean> =
	BufferMode extends true ? Buffer : string;

const COUNT_CHILDREN = 1000;
export class TreeKeyCacheRedisStorage<BufferMode extends boolean = true>
	implements KeyTreeCacheStorage<RedisStorageValueType<BufferMode>>
{
	private redisGet: BufferMode extends true ? 'getBuffer' : 'get';
	private options: Required<TreeKeyCacheRedisStorageOptions>;
	private redisChildren: Redis;
	private redisPool: Redis[];
	private baseDate = Date.now() - performance.now();

	private readonly dbChangingInterval: number;

	constructor(
		options: TreeKeyCacheRedisStorageOptions & { bufferMode?: BufferMode },
	) {
		this.options = {
			...defaultOptions,
			...options,
		};
		this.redisGet = (
			options.bufferMode ? 'getBuffer' : 'get'
		) as typeof this.redisGet;
		this.redisChildren = new IORedis(this.options.port, this.options.host, {
			db: this.options.childrenDb,
		});
		this.dbChangingInterval = this.options.dbPoolDaysCount * DAY_SCALE;
		if (this.options.insertOnly || typeof this.options.treeDb === 'number') {
			if (typeof this.options.treeDb !== 'number') {
				throw new Error('treeDb must b number to be used with insertOnly');
			}
			this.redisPool = [
				new IORedis(this.options.port, this.options.host, {
					db: this.options.treeDb,
				}),
			];
		} else {
			this.redisPool = this.options.treeDb.map(
				(db) =>
					new IORedis(this.options.port, this.options.host, {
						db,
					}),
			);
		}
	}

	async clearAllChildrenRegistry(): Promise<void> {
		await this.redisChildren.flushdb();
	}

	private getDb() {
		const { treeDb } = this.options;

		if (typeof treeDb === 'number') {
			return treeDb;
		}
		return (
			Math.floor(
				(this.baseDate + performance.now()) / this.dbChangingInterval,
			) % treeDb.length
		);
	}

	private async internalGet(dbPos: number, key: string) {
		const result = await this.redisPool[dbPos]?.[this.redisGet](key);
		return result === null
			? undefined
			: (result as RedisStorageValueType<BufferMode>);
	}

	get(key: string) {
		if (this.options.insertOnly) {
			return undefined;
		}

		return this.internalGet(this.getDb(), key);
	}

	async *getHistory(
		key: string,
	): AsyncIterable<RedisStorageValueType<BufferMode> | undefined> {
		const { treeDb } = this.options;
		if (typeof treeDb === 'number') {
			throw new Error('Not implemented');
		}
		for (let i = 0; i < treeDb.length; i++) {
			yield this.internalGet(i, key);
		}
	}

	async set(
		key: string,
		value: RedisStorageValueType<BufferMode>,
		ttl?: number | undefined,
	) {
		const redis = this.redisPool[this.getDb()];
		if (!redis) {
			throw new Error('Invalid redis index');
		}

		await (ttl ? redis.setex(key, ttl, value) : redis.set(key, value));
	}

	private getChildrenKey(key: string | undefined) {
		return key ? `${this.getDb()}:${key}` : this.getDb().toString();
	}

	async *getChildren?(key?: string | undefined): AsyncIterable<string> {
		const childrenKey = this.getChildrenKey(key);
		let [cursor, elements] = await this.redisChildren.sscan(
			childrenKey,
			0,
			'COUNT',
			COUNT_CHILDREN,
		);
		while (cursor && cursor !== '0') {
			yield* elements;
			[cursor, elements] = await this.redisChildren.sscan(
				childrenKey,
				0,
				'COUNT',
				COUNT_CHILDREN,
			);
		}
		yield* elements;
	}

	getCurrentTtl(key: string): number | Promise<number | undefined> | undefined {
		return this.redisPool[this.getDb()]?.ttl(key);
	}

	async *randomIterate?(pattern?: string | undefined): AsyncIterable<string> {
		const regex = pattern ? new RegExp(pattern) : undefined;
		let [cursor, elements] = await this.redisChildren.scan(
			0,
			'COUNT',
			COUNT_CHILDREN,
		);

		if (regex) {
			while (cursor && cursor !== '0') {
				for await (const element of elements) {
					if (regex.test(element)) {
						yield element;
					}
				}
				[cursor, elements] = await this.redisChildren.scan(
					0,
					'COUNT',
					COUNT_CHILDREN,
				);
			}
			for await (const element of elements) {
				if (regex.test(element)) {
					yield element;
				}
			}
		} else {
			while (cursor && cursor !== '0') {
				yield* elements;
				[cursor, elements] = await this.redisChildren.scan(
					0,
					'COUNT',
					COUNT_CHILDREN,
				);
			}
			yield* elements;
		}
	}

	async registerChild?(parentKey: string | undefined, partialKey: string) {
		const redis = this.redisPool[this.getDb()];
		if (!redis) {
			throw new Error('Invalid redis index');
		}
		const childrenKey = this.getChildrenKey(parentKey);

		await redis.sadd(childrenKey, partialKey);
	}
}
