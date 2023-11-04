export interface TreeKeyCacheRedisStorageNonRequiredOptions {
	port: number;
	insertOnly: boolean;
	bufferMode: boolean;
	childrenDb: number;
	dbPoolDaysCount: number;
}

export interface TreeKeyCacheRedisStorageOptions
	extends Partial<TreeKeyCacheRedisStorageNonRequiredOptions> {
	host: string;
	treeDb: number | number[];
}
