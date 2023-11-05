import IORedis, { Redis } from 'ioredis';
import { TreeKeyCacheBaseRedisStorage } from './tree-key-cache-base-redis-storage';

export interface TreeKeyCacheSimpleRedisStorageNonRequiredOptions<
	BufferMode extends boolean,
> {
	port: number;
	bufferMode: BufferMode;
	childrenDb: number;
	childrenRegistry: boolean;
}

export interface TreeKeyCacheSimpleRedisStorageOptions<
	BufferMode extends boolean,
> extends Partial<
		TreeKeyCacheSimpleRedisStorageNonRequiredOptions<BufferMode>
	> {
	host: string;
	treeDb: number;
}

export const simpleDefaultOptions: TreeKeyCacheSimpleRedisStorageNonRequiredOptions<true> =
	{
		bufferMode: true,
		childrenDb: 16,
		port: 6379,
		childrenRegistry: false,
	};

/**
 * A simple TreeKeyCacheStorage implementation where you can
 * have key level keys children mapping, if wanted, randomIterate
 * and the basic functionalities needed
 */
export class TreeKeyCacheSimpleRedisStorage<
	BufferMode extends boolean = true,
> extends TreeKeyCacheBaseRedisStorage<BufferMode> {
	private options: Required<TreeKeyCacheSimpleRedisStorageOptions<BufferMode>>;
	protected redisGet: BufferMode extends true ? 'getBuffer' : 'get';
	protected redisChildren: Redis;
	protected redisData: Redis;
	protected childrenRegistry: boolean;

	constructor(options: TreeKeyCacheSimpleRedisStorageOptions<BufferMode>) {
		super();
		this.options = {
			...(simpleDefaultOptions as Required<
				TreeKeyCacheSimpleRedisStorageOptions<BufferMode>
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
}
