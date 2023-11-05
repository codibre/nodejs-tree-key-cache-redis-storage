import IORedis, { Redis } from 'ioredis';
import { TreeKeyCacheBaseRedisStorage } from './tree-key-cache-base-redis-storage';
import { getBufferedInt, readBufferedInt, suffixString } from './utils';
import { RedisStorageValueType } from './types';
import {
	TreeKeyCacheSimpleRedisStorageNonRequiredOptions,
	simpleDefaultOptions,
} from './tree-key-cache-simple-redis-storage';

export interface TreeKeyCacheInsertOnlyRedisStorageOptions<
	BufferMode extends boolean,
> extends Partial<
		TreeKeyCacheSimpleRedisStorageNonRequiredOptions<BufferMode>
	> {
	host: string;
	treeDb: number;
}

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
> extends TreeKeyCacheBaseRedisStorage<BufferMode> {
	private options: Required<
		TreeKeyCacheInsertOnlyRedisStorageOptions<BufferMode>
	>;
	protected redisGet: BufferMode extends true ? 'getBuffer' : 'get';
	protected redisChildren: Redis;
	protected redisData: Redis;
	protected childrenRegistry: boolean;
	protected defaultTtl: number | undefined;

	constructor(
		options: TreeKeyCacheInsertOnlyRedisStorageOptions<BufferMode> & {
			bufferMode?: BufferMode;
		},
	) {
		super();
		this.options = {
			...(simpleDefaultOptions as Required<
				TreeKeyCacheInsertOnlyRedisStorageOptions<BufferMode>
			>),
			...options,
		};
		this.redisGet = (
			this.options.bufferMode ? 'getBuffer' : 'get'
		) as typeof this.redisGet;
		this.redisChildren = new IORedis(this.options.port, options.host, {
			db: options.childrenDb,
		});
		this.redisData = new IORedis(this.options.port, options.host, {
			db: options.treeDb,
		});
		this.childrenRegistry = this.options.childrenRegistry;
	}

	protected getChildrenKey(key: string | undefined) {
		return key ?? '';
	}

	async get() {
		return undefined;
	}

	private async getLastVersion(key: string) {
		return readBufferedInt(await this.redisData.getBuffer(key));
	}

	async *getHistory(key: string) {
		let version = await this.getLastVersion(key);
		while (version > 0) {
			const item = await this.internalGet(suffixString(key, version));
			if (item === undefined) {
				break;
			}
			yield item;
			version--;
		}
	}

	async set(
		key: string,
		value: RedisStorageValueType<BufferMode>,
		ttl?: number | undefined,
	): Promise<void> {
		const version = (await this.getLastVersion(key)) + 1;
		await Promise.all([
			super.set(suffixString(key, version), value, ttl),
			super.set(
				key,
				getBufferedInt(version) as RedisStorageValueType<BufferMode>,
				ttl,
			),
		]);
	}
}
