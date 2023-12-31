const Redis = require('ioredis-mock');
jest.mock('ioredis', () => Redis);
import { TreeKeyCacheBaseRedisStorage } from 'src/tree-key-cache-base-redis-storage';
import { TreeKeyCacheSimpleRedisStorage } from 'src/index';

describe(TreeKeyCacheSimpleRedisStorage.name, () => {
	let target: TreeKeyCacheSimpleRedisStorage<false>;

	beforeEach(() => {
		target = new TreeKeyCacheSimpleRedisStorage({
			host: 'my host',
			treeDb: 1,
			bufferMode: false,
		});
	});

	it(`should be an instance of ${TreeKeyCacheBaseRedisStorage.name}`, () => {
		expect(target).toBeInstanceOf(TreeKeyCacheBaseRedisStorage);
	});
});
