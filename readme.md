# Keyv lru files

[![Build Status](https://travis-ci.org/gumlet/keyv-lru-files.svg?branch=master)](https://travis-ci.org/gumlet/keyv-lru-files)

A file cache inspired by [kevy-lru-files](https://github.com/isaacs/node-lru-cache).
Least recently used files are deleted. It's helpful if your filesystem uses `atime`.
Everything is written to files and nothing is kept in-memory.

## Install

````
npm install keyv-lru-files
````

## Usgae

```` javascript

var lrufiles = require("keyv-lru-files");

var cache = new lrufiles({
	dir: "cache" 			// directory to store caches files
	files: 100,       // maximum number of files
	size: "1 GB",     // maximum total file size
	check: 10,  // interval of stale checks in minutes
});

// add a file to cache. you can submit a buffer...
await cache.set("filename.ext", new Buffer("data"));

// ... readable stream ...
await cache.set("otherfile.ext", fs.createReadableStream("/some/filename.ext"));

// ... or object
await cache.set("objectfile.json", {hello: "world"});

// get a file from cache
// the value is a Buffer
let value = cache.get("somefile.ext");

// get a readable stream to a cached file, straight...
let stream = await cache.stream("anyfile.ext");

// check if a file is cached
let exists = await cache.has("filename.ext");

// update a files access time
await cache.touch("file/changed.txt");

// get list of all files cached
let keys = await cache.keys();

// remove a file from cache
let deleted = await cache.delete("file/changed.txt");

// manually remove old files
await cache.cache_cleaner();

// empty everything
await cache.clear();

// All functions return a promise so following syntax can be used for all functions
// this is alternate way when you don't want to use async / await.
cache.has("filename.ext").then(function(exists){
	// do something...
}).catch(function(err){
	// there was error checking file existence
});

````
