const Redis = require('ioredis-mock');
jest.mock('ioredis', () => Redis);
import { TreeKeyCacheBaseRedisStorage } from 'src/tree-key-cache-base-redis-storage';
import { TreeKeyCacheTimedRoundRobinRedisStorage } from 'src/index';

describe(TreeKeyCacheTimedRoundRobinRedisStorage.name, () => {
	let target: TreeKeyCacheTimedRoundRobinRedisStorage<false>;

	beforeEach(() => {
		target = new TreeKeyCacheTimedRoundRobinRedisStorage({
			host: 'my host',
			treeDbPool: [1, 2, 3],
			bufferMode: false,
		});
	});

	it(`should be an instance of ${TreeKeyCacheBaseRedisStorage.name}`, () => {
		expect(target).toBeInstanceOf(TreeKeyCacheBaseRedisStorage);
	});
});
