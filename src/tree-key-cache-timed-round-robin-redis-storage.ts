import { performance } from 'perf_hooks';
import IORedis, { Redis } from 'ioredis';
import { TreeKeyCacheBaseRedisStorage } from './tree-key-cache-base-redis-storage';
import { applyScape, isBaseKey } from './utils';
import { fluent, fluentAsync } from '@codibre/fluent-iterable';
import {
	TreeKeyCacheSimpleRedisStorageNonRequiredOptions,
	simpleDefaultOptions,
} from './tree-key-cache-simple-redis-storage';

export interface TreeKeyCacheTimedRoundRobinRedisStorageNonRequiredOptions
	extends TreeKeyCacheSimpleRedisStorageNonRequiredOptions {
	baseTimestamp: number;
	dayScale: number;
}

export interface TreeKeyCacheTimedRoundRobinRedisStorageOptions
	extends Partial<TreeKeyCacheTimedRoundRobinRedisStorageNonRequiredOptions> {
	host: string;
	treeDbPool: (number | { host: string; dbs: number[] })[];
}

const DAY_SCALE = 86400;
const today = Date.now() - performance.now();
const defaultOptions: TreeKeyCacheTimedRoundRobinRedisStorageNonRequiredOptions =
	{
		...simpleDefaultOptions,
		baseTimestamp: 0,
		dayScale: 1,
	};

export class TreeKeyCacheTimedRoundRobinRedisStorage<
	BufferMode extends boolean = true,
> extends TreeKeyCacheBaseRedisStorage<BufferMode> {
	private options: Required<TreeKeyCacheTimedRoundRobinRedisStorageOptions>;
	protected redisGet: BufferMode extends true ? 'getBuffer' : 'get';
	protected redisChildren: Redis;
	private redisPool: Redis[];
	protected childrenRegistry: boolean;

	constructor(
		options: TreeKeyCacheTimedRoundRobinRedisStorageOptions & {
			bufferMode?: BufferMode;
		},
	) {
		super();
		this.options = {
			...defaultOptions,
			...options,
		};
		this.redisGet = (
			this.options.bufferMode ? 'getBuffer' : 'get'
		) as typeof this.redisGet;
		this.redisChildren = new IORedis(this.options.port, options.host, {
			db: options.childrenDb,
		});
		this.redisPool = fluent(options.treeDbPool)
			.flatMap((item) =>
				typeof item === 'number'
					? [{ host: options.host, db: item }]
					: fluent(item.dbs).map((db) => ({ host: item.host, db })),
			)
			.map(
				({ host, db }) =>
					new IORedis(this.options.port, host, {
						db,
					}),
			)
			.toArray();
		this.childrenRegistry = this.options.childrenRegistry;
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

	protected getChildrenKey(key: string | undefined) {
		return key ?? '';
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
