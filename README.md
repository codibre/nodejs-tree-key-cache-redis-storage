[![Actions Status](https://github.com/Codibre/nodejs-tree-key-cache-redis-storage/workflows/build/badge.svg)](https://github.com/Codibre/nodejs-tree-key-cache-redis-storage/actions)
[![Actions Status](https://github.com/Codibre/nodejs-tree-key-cache-redis-storage/workflows/test/badge.svg)](https://github.com/Codibre/nodejs-tree-key-cache-redis-storage/actions)
[![Actions Status](https://github.com/Codibre/nodejs-tree-key-cache-redis-storage/workflows/lint/badge.svg)](https://github.com/Codibre/nodejs-tree-key-cache-redis-storage/actions)
[![Test Coverage](https://api.codeclimate.com/v1/badges/993e7bae8e5cada681ae/test_coverage)](https://codeclimate.com/github/codibre/nodejs-tree-key-cache-redis-storage/test_coverage)
[![Maintainability](https://api.codeclimate.com/v1/badges/993e7bae8e5cada681ae/maintainability)](https://codeclimate.com/github/codibre/nodejs-tree-key-cache-redis-storage/maintainability)
[![Packages](https://david-dm.org/Codibre/nodejs-tree-key-cache-redis-storage.svg)](https://david-dm.org/Codibre/nodejs-tree-key-cache-redis-storage)
[![npm version](https://badge.fury.io/js/%40tree-key-cache%2Favro.svg)](https://badge.fury.io/js/%40tree-key-cache%2Favro)

Redis storage implementations for tree-key-cache

## How to Install

```
npm i @tree-key-cache/redis-storage
```


## How to use it

This library offers three implementation flavors:

### Simple Redis Storage

This is the most straight forward one, the one aiming to attend the most cases: just a simple get and set proxy.
You also have a randomIterate implementation ready to go, and optional getChildren and registerChild implementations using **sadd** and **sscan** to control key level keys children.
To use it without children registration:

```ts
const storage = new TreeKeyCacheSimpleRedisStorage({
  host: 'my-redis-host',
  treeDb: 1,
})
```

To use it with children registration:
```ts
const storage = new TreeKeyCacheSimpleRedisStorage({
  host: 'my-redis-host',
  treeDb: 1,
  childrenDb: 2,
  childrenRegistry: true,
})
```

## Insert Only Redis Storage

This is a key history enabled implementation, ideal if you need to keep every registered value for a key separated. Aside from all the functionalities that **TreeKeyCacheSimpleRedisStorage** delivers, it also implement **getHistory**, which will return every single non expired value of the given key, from the latest to the oldest.
Although we don't explicit control it, this implementation assumes that older keys expire first, so, be aware that, if you have N keys registered and, for some reason, a key in the middle of the way is evicted, getHistory will not yield the keys older than it.
Also be aware of the memory of your instance, as this implementation tends to consume much more than the simple one. We recommend you to practice low ttl when using it.

To use it:
```ts
const storage = new TreeKeyCacheSimpleRedisStorage({
  host: 'my-redis-host',
  treeDb: 1,
  childrenDb: 2,
  childrenRegistry: true, // optional
})
```

## Timed round robin Redis Storage

This is a key history enabled implementation that is in the middle of the way between the insertOnly and the simple one. With this one, you can have a redis db pool to control key history. Based on a measure of day, a redis db is set as the current one, making all the new persistence being written in it. This will make older versions of each key to be stored in the other redis versions, making it possible to recover the history, also ordered from the latest to the oldest.
The redis db pool can use dbs from the same main host, or even from totally separated redis instances! The only drawback is that, if you want children registry, this will be controlled in a single redis db instance: the main one.

To use it:
```ts
const storage = new TreeKeyCacheTimedRoundRobinRedisStorage({
  host: 'my-main-redis-host',
  treeDbPool: [1, 2, 3, {
    host: 'another-redis-host',
    dbs: [1, 2, 3, 4]
  }],
  childrenDb: 16,
  childrenRegistry: true, // optional
  // Db timed round trip will use this as the base date for db change
  baseTimestamp: new Date('2023-10-01T00:00:00Z').getTime(),
  // How many days does it take to change db, ie, every db will be the main one for 7 days
  dayScale: 7,
})
```


## License

Licensed under [MIT](https://en.wikipedia.org/wiki/MIT_License).
