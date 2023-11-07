import { fluentAsync } from '@codibre/fluent-iterable';
import Redis from 'ioredis-mock';
jest.mock('ioredis', () => Redis);
import {
	TreeKeyCacheBaseRedisStorage,
	TreeKeyCacheBaseRedisStorageOptions,
} from 'src/tree-key-cache-base-redis-storage';

const proto = TreeKeyCacheBaseRedisStorage.prototype;

class TestTreeKeyCacheBaseRedisStorage<
	BufferMode extends boolean,
> extends TreeKeyCacheBaseRedisStorage<
	BufferMode,
	Required<TreeKeyCacheBaseRedisStorageOptions<BufferMode>>
> {
	protected redisData = new Redis();
}

describe(TreeKeyCacheBaseRedisStorage.name, () => {
	let targetBuffer: TreeKeyCacheBaseRedisStorage<
		true,
		Required<TreeKeyCacheBaseRedisStorageOptions<true>>
	>;
	let targetString: TreeKeyCacheBaseRedisStorage<
		false,
		Required<TreeKeyCacheBaseRedisStorageOptions<false>>
	>;

	beforeEach(() => {
		targetBuffer = new TestTreeKeyCacheBaseRedisStorage({
			bufferMode: true,
			childrenDb: 1,
			childrenRegistry: false,
			defaultTtl: 0,
			port: 1234,
			host: 'abc',
		});
		targetString = new TestTreeKeyCacheBaseRedisStorage({
			bufferMode: false,
			childrenDb: 1,
			childrenRegistry: false,
			defaultTtl: 0,
			port: 1234,
			host: 'abc',
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

	describe(proto.set.name, () => {
		beforeEach(() => {
			jest.spyOn(targetBuffer['redisData'], 'set');
			jest.spyOn(targetBuffer['redisData'], 'setex');
		});

		it('should set the value with no ttl when ttl is not informed and there is no defaultTtl', async () => {
			const result = await targetBuffer.set('my key', Buffer.from('my value'));

			expect(result).toBeUndefined();
			expect(targetBuffer['redisData'].set).toHaveCallsLike([
				'my key',
				Buffer.from('my value'),
			]);
			expect(targetBuffer['redisData'].setex).toHaveCallsLike();
		});

		it('should set the value with ttl when ttl is not informed but there is a defaultTtl', async () => {
			targetBuffer['options'].defaultTtl = 100;

			const result = await targetBuffer.set('my key', Buffer.from('my value'));

			expect(result).toBeUndefined();
			expect(targetBuffer['redisData'].set).toHaveCallsLike();
			expect(targetBuffer['redisData'].setex).toHaveCallsLike([
				'my key',
				100,
				Buffer.from('my value'),
			]);
		});

		it('should set the value with ttl when ttl is informed', async () => {
			const result = await targetBuffer.set(
				'my key',
				Buffer.from('my value'),
				1919,
			);

			expect(result).toBeUndefined();
			expect(targetBuffer['redisData'].set).toHaveCallsLike();
			expect(targetBuffer['redisData'].setex).toHaveCallsLike([
				'my key',
				1919,
				Buffer.from('my value'),
			]);
		});
	});

	describe(proto.clearAllChildrenRegistry.name, () => {
		beforeEach(() => {
			jest.spyOn(targetBuffer['redisChildren'], 'flushdb');
		});

		it('should flush db', async () => {
			const result = await targetBuffer.clearAllChildrenRegistry();

			expect(result).toBeUndefined();
			expect(targetBuffer['redisChildren'].flushdb).toHaveCallsLike([]);
		});
	});

	describe(proto.getChildren.name, () => {
		it('should throw an error when getChildren is called but childrenRegistry is not enabled', async () => {
			let thrownError: any;

			try {
				await fluentAsync(targetBuffer.getChildren()).toArray();
			} catch (err) {
				thrownError = err;
			}

			expect(thrownError).toBeInstanceOf(Error);
		});

		it('should return every registered key for the root node, when no key is informed and childrenRegistry is enabled', async () => {
			targetString['options'].childrenRegistry = true;
			await targetString.registerChild(undefined, 'a');
			await targetString.registerChild(undefined, 'b');
			await targetString.registerChild(undefined, 'c');

			const result = await fluentAsync(targetString.getChildren()).toArray();

			expect(result).toEqual(['a', 'b', 'c']);
		});
	});

	describe(proto.getChildren.name, () => {
		it('should return undefined when no ttl is defined for the latest key version', async () => {
			await targetString.set('my key', 'a', 123);
			await targetString.set('my key', 'b');

			const result = await targetString.getCurrentTtl('my key');

			expect(result).toBeUndefined();
		});

		it('should return registered ttl for the latest key version', async () => {
			await targetString.set('my key', 'a');
			await targetString.set('my key', 'b', 123);

			const result = await targetString.getCurrentTtl('my key');

			expect(result).toBe(123);
		});
	});

	describe(proto.registerChild.name, () => {
		beforeEach(() => {
			jest.spyOn(targetBuffer['redisChildren'], 'sadd');
		});

		it('should not register child when childrenRegistry is false', async () => {
			const result = await targetBuffer.registerChild('a', 'b');

			expect(result).toBeUndefined();
			expect(targetBuffer['redisChildren'].sadd).toHaveCallsLike();
		});

		it('should register child when childrenRegistry is true', async () => {
			targetBuffer['options'].childrenRegistry = true;

			const result = await targetBuffer.registerChild('a', 'b');

			expect(result).toBeUndefined();
			expect(targetBuffer['redisChildren'].sadd).toHaveCallsLike(['a', 'b']);
		});

		it('should register for root node when childrenRegistry is true and parentKey is undefined', async () => {
			targetBuffer['options'].childrenRegistry = true;

			const result = await targetBuffer.registerChild(undefined, 'b');

			expect(result).toBeUndefined();
			expect(targetBuffer['redisChildren'].sadd).toHaveCallsLike(['', 'b']);
		});
	});
});
