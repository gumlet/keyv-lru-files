#!/usr/bin/env node

// require node modules
var fs = require("fs");
var path = require("path");
var stream = require("stream");
var utils = require("./utils");

// require npm modules
var rimraf = require("rimraf");

function filecache(opts){
	if (!(this instanceof filecache)) return new filecache(opts);

	var self = this;

	// get options
	self.opts = self.parseopts(opts);

	// initialize
	self.init();

	return this;

};

// check and apply options
filecache.prototype.parseopts = function(opts) {
	var self = this;
	var o = {};

	if (!opts.hasOwnProperty("root") || typeof opts.root !== "string") opts.root = require.main.filename;
	
	// determine cache directory
	if (!opts.hasOwnProperty("dir") || typeof opts.dir !== "string") opts.dir = "cache";
	o.dir = path.join(opts.root, "..", opts.dir);

	// determine maximal total number of files
	opts.files = (!opts.hasOwnProperty("files")) ? false : parseInt(opts.files,10);
	o.files = (isNaN(opts.files) || opts.files === 0) ? false : opts.files;

	// determine maximal total file size
	if (!opts.hasOwnProperty("size")) opts.size = false;
	if (typeof opts.size === "string") opts.size = utils.filesize(opts.size);
	if (typeof opts.size !== "number" || isNaN(opts.size) || opts.size === 0) opts.size = false;
	o.size = opts.size;


	// determine cleanup interval
	if (!opts.hasOwnProperty("check")) {
		o.check = 10 * 60 * 1000; // default check interval is 10 min
	} else {
		o.check = opts.check * 60 * 1000 // convert passed minutes to milliseconds...
	}

	return o;
};

// initialize file cache
filecache.prototype.init = function() {
	var self = this;

	try {
		fs.mkdirSync(self.opts.dir);
	} catch (err){

	}


	// setup cleanup timer
	if (self.opts.check && (self.opts.files || self.opts.size)) {
		setInterval(function(){
			self.cache_cleaner();
		}, self.opts.check).unref();
	}

	return this;
};

filecache.prototype.keys = async function(){
	var self = this;
	return new Promise((resolve, reject) => {
		fs.readdir(self.opts.dir, async function(err, files){
			if(err){
				resolve([]);
			} else {
				resolve(files);
			}
		});
	});
};

// check if a file exists
filecache.prototype.has = async function(file, resolved_path) {
	var self = this;
	if(!resolved_path){
		file = path.resolve(self.opts.dir, utils.sanitize(file));
	}
	return new Promise((resolve, reject) => {
		fs.access(file, (err) => {
				if(err){
					resolve(false);
				} else {
					resolve(true);
				}
		});
	});
};

// add a file
filecache.prototype.set = async function(file, data) {
	var self = this;

	if(file.indexOf("/") >= 0){
		throw new Error("'/' is not supported character as key.");
	}

	var file = path.resolve(this.opts.dir, utils.sanitize(file));

	return new Promise((resolve, reject) => {
		if ((data instanceof stream) || (data instanceof stream.Readable) || (data.readable === true)) {
			// pipe stream to file
			data.pipe(fs.createWriteStream(file).on("finish", function(){
				resolve(file);
			}).on("error", function(err){
				reject(err);
			}));

		} else if (data instanceof Buffer) {

			// write buffer to file
			fs.writeFile(file, data, function(err){
				if(err){
					reject(err);
				} else {
					resolve(file);
				}
			});

		} else if (typeof data === "object") {

			// serialize object and write to file
			try {
				fs.writeFile(file, JSON.stringify(data), function(err){
					if(err){
						reject(err);
					} else {
						resolve(file);
					}
				});
			} catch (err) {
				return reject(err);
			};

		} else {
			// write to file
			fs.writeFile(file, data, function(err){
				if(err){
					reject(err);
				} else {
					resolve(file);
				}
			});

		};
	});
};

// remove file from cache
filecache.prototype.delete = async function(file) {
	var self = this;

	var file = path.resolve(this.opts.dir, utils.sanitize(file));

	if(await self.has(file, true)){
		return new Promise((resolve, reject) => {
			fs.unlink(file, function(err){
				if (err){
					reject(err);
				} else {
					resolve(true);
				}
			});
		});
	} else {
		return false;
	}
};

// update file access time
filecache.prototype.touch = async function(file, time) {
	var self = this;

	if(!time){
		time = Date.now();
	}

	var file = path.resolve(this.opts.dir, utils.sanitize(file));

	return new Promise((resolve, reject) => {
		fs.utimes(file, time, time, function(err){
			if(err){
				reject(err);
			} else {
				resolve(true);
			}
		});
	});
};

// get a file as buffer
filecache.prototype.get = async function(file) {
	var self = this;

	var file = path.resolve(this.opts.dir, utils.sanitize(file));

	if(await self.has(file, true)){
		return new Promise((resolve, reject) => {
			fs.readFile(file, function(err, buffer){
				if (err) {
					reject(err);
				} else {
					resolve(buffer);
				}
			});
		});
	} else {
		return undefined;
	}
};

// get a file as stream
filecache.prototype.stream = async function(file) {
	var self = this;
	var file = path.resolve(this.opts.dir, utils.sanitize(file));

	if(await self.has(file, true)){
		return fs.createReadStream(file);
	} else {
		return undefined;
	}
};

// empty the file store
filecache.prototype.clear = async function() {
	var self = this;

	return new Promise((resolve, reject) => {
		rimraf(self.opts.dir, (err) => {
			if(err){
				reject(err);
			} else {
				resolve(true);
			}
		});
	});
};

// cleanup files
filecache.prototype.cache_cleaner = async function() {
	var self = this;

	return new Promise((resolve, reject) => {
		fs.readdir(self.opts.dir, async function(err, files){
			let remove = [];
			let size = 0;

		  files = files.map(function (fileName) {
				let stats = fs.statSync(self.opts.dir + '/' + fileName)
		    return {
		      name: fileName,
		      atime: stats.atime.getTime(),
					size: stats.size
		    };
		  }).sort(function (a, b) {
		    return a.atime - b.atime;
			});



			// check for filecount violation
			if (self.opts.files) while (files.length > self.opts.files) {
				remove.push(files.shift());
			};

			// check for filesize violations
			if (self.opts.size) while (self.opts.size > size && files.length) {
				size += files.pop().size;
			};

			remove = remove.concat(files);


			// check if there are removable files
			if (remove.length === 0) return;

			for(const file of remove){
				await self.delete(file.name);
			}
			resolve(true);
		});
	});
};


// export
module.exports = filecache;
