import { performance } from 'perf_hooks';
import IORedis, { Redis } from 'ioredis';
import {
	TreeKeyCacheBaseRedisStorage,
	TreeKeyCacheBaseRedisStorageOptions,
} from './tree-key-cache-base-redis-storage';
import { applyScape, isBaseKey } from './utils';
import { fluent, fluentAsync } from '@codibre/fluent-iterable';
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

const DAY_SCALE = 86400;
const today = Date.now() - performance.now();
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
					? [{ host: options.host, port: options.port, db: item }]
					: fluent(item.dbs).map((db) => ({
							host: item.host,
							port: item.port,
							db,
					  })),
			)
			.map(
				({ host, db }) =>
					new IORedis(this.options.port, host, {
						db,
					}),
			)
			.toArray();
	}

	private getCurrentDb() {
		return Math.floor(
			(performance.now() / DAY_SCALE + today - this.options.baseTimestamp) /
				(DAY_SCALE * this.options.dayScale),
		);
	}

	protected get redisData(): Redis {
		const redis = this.redisPool[this.getCurrentDb()];
		if (!redis) {
			throw new Error('Invalid redis index!');
		}
		return redis;
	}

	async *getHistory(key: string) {
		const baseDb = this.getCurrentDb();
		const { length } = this.redisPool;
		for (let i = length; i > 0; i--) {
			const redis = this.redisPool[(baseDb + i) % length];
			const result = redis
				? await this.internalGetFromRedis(redis, key)
				: undefined;
			if (result !== undefined) {
				yield result;
			}
		}
	}

	randomIterate(pattern?: string | undefined) {
		return fluentAsync(
			super.randomIterate(pattern ? applyScape(pattern) : pattern),
		).filter(isBaseKey);
	}
}
