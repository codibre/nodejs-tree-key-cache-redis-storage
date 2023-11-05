const Redis = require('ioredis-mock');
jest.mock('ioredis', () => Redis);
import { TreeKeyCacheSimpleRedisStorage } from 'src/tree-key-cache-simple-redis-storage';

const proto = TreeKeyCacheSimpleRedisStorage.prototype;

describe(TreeKeyCacheSimpleRedisStorage.name, () => {
	let target: TreeKeyCacheSimpleRedisStorage;

	beforeEach(() => {
		target = new TreeKeyCacheSimpleRedisStorage({
			host: 'my host',
			treeDb: 1,
		});
	});

	describe(proto.get.name, () => {
		it('should return the saved value', async () => {
			await target['redisData'].set('my key', 'my value');

			const result = await target.get('my key');

			expect(result).toEqual(Buffer.from('my value'));
		});

		it('should return undefined when no value is found', async () => {
			await target['redisData'].set('my key', 'my value');

			const result = await target.get('my key 2');

			expect(result).toBeUndefined();
		});
	});
});
