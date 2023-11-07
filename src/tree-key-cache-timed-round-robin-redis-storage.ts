import IORedis, { Redis } from 'ioredis';
import {
	TreeKeyCacheBaseRedisStorage,
	TreeKeyCacheBaseRedisStorageOptions,
	baseDefaultOptions,
} from './tree-key-cache-base-redis-storage';
import { fluent } from '@codibre/fluent-iterable';
import { RedisDbPool } from './types';

export interface TreeKeyCacheTimedRoundRobinRedisStorageNonRequiredOptions {
	baseTimestamp: number;
	dayScale: number;
}

export interface TreeKeyCacheTimedRoundRobinRedisStorageOptions<
	BufferMode extends boolean,
> extends TreeKeyCacheBaseRedisStorageOptions<BufferMode>,
		Partial<TreeKeyCacheTimedRoundRobinRedisStorageNonRequiredOptions> {
	host: string;
	treeDbPool: (number | RedisDbPool)[];
}

const DAY_SCALE = 86400000;
const defaultOptions: TreeKeyCacheTimedRoundRobinRedisStorageNonRequiredOptions =
	{
		baseTimestamp: 0,
		dayScale: 1,
	};

export class TreeKeyCacheTimedRoundRobinRedisStorage<
	BufferMode extends boolean = true,
> extends TreeKeyCacheBaseRedisStorage<
	BufferMode,
	Required<TreeKeyCacheTimedRoundRobinRedisStorageOptions<BufferMode>>
> {
	private redisPool: Redis[];
	protected defaultTtl: number | undefined;

	constructor(
		options: TreeKeyCacheTimedRoundRobinRedisStorageOptions<BufferMode> & {
			bufferMode?: BufferMode;
		},
	) {
		super({
			...(defaultOptions as Required<
				TreeKeyCacheTimedRoundRobinRedisStorageOptions<BufferMode>
			>),
			...options,
		});
		this.redisPool = fluent(options.treeDbPool)
			.flatMap((item) =>
				typeof item === 'number'
					? [
							{
								host: options.host,
								port: options.port ?? baseDefaultOptions.port,
								db: item,
							},
					  ]
					: fluent(item.dbs).map((db) => ({
							host: item.host,
							port: item.port ?? baseDefaultOptions.port,
							db,
					  })),
			)
			.map(
				({ host, db, port }) =>
					new IORedis(port, host, {
						db,
					}),
			)
			.toArray();
	}

	private getCurrentDb() {
		const now = Date.now();
		return (
			Math.floor(
				(now - this.options.baseTimestamp) /
					(DAY_SCALE * this.options.dayScale),
			) % this.redisPool.length
		);
	}

	protected get redisData(): Redis {
		return this.redisPool[this.getCurrentDb()] as Redis;
	}

	async *getHistory(key: string) {
		const baseDb = this.getCurrentDb();
		const { length } = this.redisPool;
		for (let i = length; i > 0; i--) {
			const redis = this.redisPool[(baseDb + i) % length] as Redis;
			const result = await this.internalGetFromRedis(redis, key);
			if (result !== undefined) {
				yield result;
			}
		}
	}
}
