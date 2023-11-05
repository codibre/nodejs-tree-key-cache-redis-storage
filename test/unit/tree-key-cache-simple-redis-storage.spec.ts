const Redis = require('ioredis-mock');
jest.mock('ioredis', () => Redis);
import { TreeKeyCacheSimpleRedisStorage } from 'src/tree-key-cache-simple-redis-storage';

const proto = TreeKeyCacheSimpleRedisStorage.prototype;

describe(TreeKeyCacheSimpleRedisStorage.name, () => {
	let targetBuffer: TreeKeyCacheSimpleRedisStorage<true>;
	let targetString: TreeKeyCacheSimpleRedisStorage<false>;

	beforeEach(() => {
		targetBuffer = new TreeKeyCacheSimpleRedisStorage({
			host: 'my host',
			treeDb: 1,
		});
		targetString = new TreeKeyCacheSimpleRedisStorage({
			host: 'my host',
			treeDb: 1,
			bufferMode: false,
		});
	});

	describe(proto.get.name, () => {
		it('should return the saved value', async () => {
			await targetBuffer['redisData'].set('my key', 'my value');

			const result = await targetBuffer.get('my key');

			expect(result).toEqual(Buffer.from('my value'));
		});

		it('should return undefined when no value is found', async () => {
			await targetBuffer['redisData'].set('my key', 'my value');

			const result = await targetBuffer.get('my key 2');

			expect(result).toBeUndefined();
		});

		it('should return the saved value as string when BufferMode is false', async () => {
			targetString['options'].bufferMode = false;

			await targetString['redisData'].set('my key', 'my value');

			const result = await targetString.get('my key');

			expect(result).toEqual('my value');
		});
	});
});
