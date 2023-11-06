import IORedis, { Redis } from 'ioredis';
import {
	TreeKeyCacheBaseRedisStorage,
	TreeKeyCacheBaseRedisStorageOptions,
} from './tree-key-cache-base-redis-storage';

export interface TreeKeyCacheSimpleRedisStorageOptions<
	BufferMode extends boolean,
> extends TreeKeyCacheBaseRedisStorageOptions<BufferMode> {
	treeDb: number;
}

/**
 * A simple TreeKeyCacheStorage implementation where you can
 * have key level keys children mapping, if wanted, randomIterate
 * and the basic functionalities needed
 */
export class TreeKeyCacheSimpleRedisStorage<
	BufferMode extends boolean = true,
> extends TreeKeyCacheBaseRedisStorage<
	BufferMode,
	TreeKeyCacheSimpleRedisStorageOptions<BufferMode>
> {
	protected redisData: Redis;

	constructor(options: TreeKeyCacheSimpleRedisStorageOptions<BufferMode>) {
		super(options);
		this.redisData = new IORedis(this.options.port, options.host, {
			db: options.treeDb,
		});
	}
}
