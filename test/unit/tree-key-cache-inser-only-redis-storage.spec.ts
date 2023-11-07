import { interval } from '@codibre/fluent-iterable';
const Redis = require('ioredis-mock');
jest.mock('ioredis', () => Redis);
import {
	TreeKeyCacheInsertOnlyRedisStorage,
	TreeKeyCacheSimpleRedisStorage,
} from 'src/index';
import { addSuffix, encodeInt } from 'src/utils';

const proto = TreeKeyCacheInsertOnlyRedisStorage.prototype;

describe(TreeKeyCacheInsertOnlyRedisStorage.name, () => {
	let target: TreeKeyCacheInsertOnlyRedisStorage<false>;

	beforeEach(() => {
		target = new TreeKeyCacheInsertOnlyRedisStorage({
			host: 'my host',
			treeDb: 1,
			bufferMode: false,
		});
	});

	afterEach(async () => {
		await target['redisData'].flushall();
	});

	it(`should be an instance of ${TreeKeyCacheSimpleRedisStorage.name}`, () => {
		expect(target).toBeInstanceOf(TreeKeyCacheSimpleRedisStorage);
	});

	describe(proto.get.name, () => {
		it('should return undefined even when there is a saved value', async () => {
			await target.set('my key', 'my value');

			const result = await target.get('my key');

			expect(result).toBeUndefined();
		});

		it('should return undefined when no value is found', async () => {
			await target.set('my key', 'my value');

			const result = await target.get('my key 2');

			expect(result).toBeUndefined();
		});
	});

	describe(proto.set.name, () => {
		beforeEach(() => {
			jest.spyOn(target['redisData'], 'set');
		});

		it('should save each call in a different key', async () => {
			const count = 1000;
			await interval(1, count).forEachAsync((x) =>
				target.set('my key', x.toString()),
			);

			const result = await interval(1, count)
				.map((x): [string, string] => [addSuffix('my key', x), x.toString()])
				.distinct(([x]) => x)
				.filterAsync(async ([k, v]) => (await target['redisData'].get(k)) === v)
				.count();
			expect(result).toEqual(count);
		});

		it('should escape special characters', async () => {
			const result = await target.set('my:key_\\123', 'abc');

			expect(result).toBeUndefined();
			expect(target['redisData'].set).toHaveCallsLike([
				'my:key\\0\\1123_!',
				'abc',
			]);
		});

		it('should reset counter key when it is not a number', async () => {
			await target['redisData'].set('my key', 'abc');

			const result = await target.set('my key', 'abc');

			expect(result).toBeUndefined();
			expect(target['redisData'].set).toHaveCallsLike(
				['my key', 'abc'],
				[`my key_${encodeInt(1)}`, 'abc'],
			);
		});
	});

	describe(proto.getHistory.name, () => {
		beforeEach(() => {
			jest.spyOn(target['redisData'], 'get');
		});

		it('should return an empty async iterable when no item is saved', async () => {
			const result = await target.getHistory('my key').toArray();

			expect(result).toEqual([]);
			expect(target['redisData'].get).toHaveCallsLike(['my key']);
		});

		it('should return an async iterable that yields items up to the first version when everyone are defined', async () => {
			await target.set('my key', 'a');
			await target.set('my key', 'b');
			await target.set('my key', 'c');

			const result = await target.getHistory('my key').toArray();

			expect(result).toEqual(['c', 'b', 'a']);
			expect(target['redisData'].get).toHaveCallsLike(
				['my key'],
				['my key_#'],
				['my key_"'],
				['my key_!'],
			);
		});

		it('should return an async iterable that yields items up to the first call that returns undefined', async () => {
			await target.set('my key', 'a');
			await target.set('my key', 'b');
			await target.set('my key', 'c');
			await target.set('my key', 'd');
			await target['redisData'].del('my key_"');

			const result = await target.getHistory('my key').toArray();

			expect(result).toEqual(['d', 'c']);
			expect(target['redisData'].get).toHaveCallsLike(
				['my key'],
				['my key_$'],
				['my key_#'],
				['my key_"'],
			);
		});

		it('should be able to read keys with special characters', async () => {
			const key = 'my:key_\\123';
			await target.set(key, 'abc');

			const result = await target.getHistory(key).toArray();

			expect(result).toEqual(['abc']);
		});
	});

	describe(proto.randomIterate.name, () => {
		it('should return only keys with no version suffix', async () => {
			await target.set('my\\key_1', 'a1');
			await target.set('my\\key_1', 'a2');
			await target.set('my key item 2', 'b1');
			await target.set('my key item 2', 'b2');
			await target.set('my key item 3', 'c1');
			await target.set('my key item 3', 'c2');

			const result = await target.randomIterate().toArray();

			expect(result).toEqual(['my\\key_1', 'my key item 2', 'my key item 3']);
		});

		it('should return only keys with no version suffix', async () => {
			await target.set('my\\key_1', 'a1');
			await target.set('my\\key_1', 'a2');
			await target.set('my key\\item 2', 'b1');
			await target.set('my key\\item 2', 'b2');
			await target.set('my key\\item 3', 'c1');
			await target.set('my key\\item 3', 'c2');

			const result = await target.randomIterate('*item*').toArray();

			expect(result).toEqual(['my key\\item 2', 'my key\\item 3']);
		});
	});
});
