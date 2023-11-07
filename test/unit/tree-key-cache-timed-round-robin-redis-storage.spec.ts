import { performance } from 'perf_hooks';
const Redis = require('ioredis-mock');
const now = Date.now();
jest.mock('ioredis', () => Redis);
import { TreeKeyCacheBaseRedisStorage } from 'src/tree-key-cache-base-redis-storage';
import { TreeKeyCacheTimedRoundRobinRedisStorage } from 'src/index';
import { fluentAsync } from '@codibre/fluent-iterable';

const proto = TreeKeyCacheTimedRoundRobinRedisStorage.prototype;
const baseTimestamp = Date.now() - performance.now();
const DAY_SCALE = 60 * 60 * 24 * 1000;
describe(TreeKeyCacheTimedRoundRobinRedisStorage.name, () => {
	let target: TreeKeyCacheTimedRoundRobinRedisStorage<false>;

	beforeEach(() => {
		target = new TreeKeyCacheTimedRoundRobinRedisStorage({
			host: 'my host',
			treeDbPool: [1, { host: 'pool2', dbs: [2] }, { host: 'pool3', dbs: [3] }],
			bufferMode: false,
			childrenDb: 16,
			baseTimestamp,
		});
		jest.useFakeTimers();
	});

	afterEach(async () => {
		await fluentAsync(target['redisPool'])
			.append(target['redisChildren'])
			.forEach((x) => x.flushall());
		jest.setSystemTime(now);
	});

	it(`should be an instance of ${TreeKeyCacheBaseRedisStorage.name}`, () => {
		expect(target).toBeInstanceOf(TreeKeyCacheBaseRedisStorage);
	});

	describe(proto.set.name, () => {
		it('should save in a different db for calls in after passed time periods', async () => {
			const result1 = await target.set('a', '1');
			jest.advanceTimersByTime(DAY_SCALE);
			const result2 = await target.set('a', '2');
			jest.advanceTimersByTime(DAY_SCALE);
			const result3 = await target.set('a', '3');

			expect(result1).toBeUndefined();
			expect(result2).toBeUndefined();
			expect(result3).toBeUndefined();
			expect(await target['redisPool'][0]?.get('a')).toBe('1');
			expect(await target['redisPool'][1]?.get('a')).toBe('2');
			expect(await target['redisPool'][2]?.get('a')).toBe('3');
		});

		it('should write at first db again after cycling ending', async () => {
			const result1 = await target.set('a', '1');
			jest.advanceTimersByTime(3 * DAY_SCALE);
			const result2 = await target.set('a', '2');

			expect(result1).toBeUndefined();
			expect(result2).toBeUndefined();
			expect(await target['redisPool'][0]?.get('a')).toBe('2');
			expect(await target['redisPool'][1]?.get('a')).toBeNull();
			expect(await target['redisPool'][2]?.get('a')).toBeNull();
		});
	});

	describe(proto.get.name, () => {
		it('should return undefined when trying to get a key from yesterday', async () => {
			const result1 = await target.set('a', '1');
			jest.advanceTimersByTime(DAY_SCALE);
			const result2 = await target.get('a');

			expect(result1).toBeUndefined();
			expect(result2).toBeUndefined();
		});

		it('should return undefined when trying to get a key from today', async () => {
			const result1 = await target.set('a', '1');
			const result2 = await target.get('a');

			expect(result1).toBeUndefined();
			expect(result2).toBe('1');
		});
	});

	describe(proto.getHistory.name, () => {
		it('should return key history from the latest to the oldest', async () => {
			const result1 = await target.set('a', '1');
			jest.advanceTimersByTime(DAY_SCALE);
			const result2 = await target.set('a', '2');
			jest.advanceTimersByTime(DAY_SCALE);
			const result3 = await target.set('a', '3');
			const result4 = await fluentAsync(target.getHistory('a')).toArray();

			expect(result1).toBeUndefined();
			expect(result2).toBeUndefined();
			expect(result3).toBeUndefined();
			expect(result4).toEqual(['3', '2', '1']);
		});

		it('should return not return an empty value of any db', async () => {
			const result1 = await target.set('a', '1');
			jest.advanceTimersByTime(2 * DAY_SCALE);
			const result3 = await target.set('a', '3');
			const result4 = await fluentAsync(target.getHistory('a')).toArray();

			expect(result1).toBeUndefined();
			expect(result3).toBeUndefined();
			expect(result4).toEqual(['3', '1']);
		});
	});

	describe(proto.randomIterate.name, () => {
		it('should yield only keys from the current database', async () => {
			await target.set('a1', '1');
			await target.set('b1', '2');
			await target.set('c1', '3');
			jest.advanceTimersByTime(DAY_SCALE);
			await target.set('a2', '4');
			await target.set('b2', '5');
			await target.set('c2', '6');
			jest.advanceTimersByTime(DAY_SCALE);
			await target.set('a3', '7');
			await target.set('b3', '8');
			await target.set('c3', '9');

			const result = await fluentAsync(target.randomIterate()).toArray();

			expect(result).toEqual(['a3', 'b3', 'c3']);
		});
		it('should filter by pattern', async () => {
			await target.set('a1', '1');
			await target.set('b1', '2');
			await target.set('c1', '3');
			jest.advanceTimersByTime(DAY_SCALE);
			await target.set('a2', '4');
			await target.set('b2', '5');
			await target.set('c2', '6');
			jest.advanceTimersByTime(DAY_SCALE);
			await target.set('a4', '7');
			await target.set('b3', '8');
			await target.set('c3', '9');

			const result = await fluentAsync(target.randomIterate('*3')).toArray();

			expect(result).toEqual(['b3', 'c3']);
		});
	});
});
