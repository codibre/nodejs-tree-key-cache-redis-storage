export type RedisStorageValueType<BufferMode extends boolean> =
	BufferMode extends true ? Buffer : string;
