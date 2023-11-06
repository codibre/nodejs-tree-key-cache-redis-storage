export type RedisStorageValueType<BufferMode extends boolean> =
	BufferMode extends true ? Buffer : string;

export interface RedisConnection {
	host: string;
	port?: number;
}

export interface RedisDbPool extends RedisConnection {
	dbs: number[];
}
