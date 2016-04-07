var _ = require("lodash"),
	Promise = require("bluebird"),
	path = require("path"),
	fs = Promise.promisifyAll(require("fs.extra")),
	mongodbDownload = Promise.promisify(require("mongodb-download")),
	findPort = Promise.promisify(require("find-free-port")),
	Decompress = Promise.promisifyAll(require("decompress")),
	readline = require('readline'),
	EventEmitter = require('events'),
	util = require('util'),
	spawn = require("cross-spawn-async");

function RapidMango(options) {
	if (!options.installPath)
		throw new Error("RapidMango requires option installPath");
	if (!options.version)
		throw new Error("RapidMango requires option version");
	options.dbpath = options.dbpath || path.resolve(options.installPath, "data");
	options.startPort = options.startPort || 6000;
	options.endPort = options.endPort || 6999;
	options.args = options.args || {};
	options.args["--dbpath"] = options.args["--dbpath"] != undefined ?
		options.args["--dbpath"] : options.dbpath;
	this.options = options;
	return this;
}

util.inherits(RapidMango, EventEmitter);

RapidMango.prototype.start = function start() {
	var self = this;
	return Promise.all([
		mongodbDownload({
			version: self.options.version,
			http_opts: self.options.http_opts
		}),
		fs.mkdirpAsync(path.resolve(self.options.installPath)),
	]).then(function(results) {
		var archiveFilename = results[0],
			archiveType;
		if (/\.tgz$/.test(archiveFilename))
			archiveType = "targz";
		if (/\.zip/.test(archiveFilename))
			archiveType = "zip";

		var decomp = Decompress({})
			.src(archiveFilename)
			.dest(self.options.installPath)
			.use(Decompress[archiveType]({
				strip: 1
			}));
		Promise.promisifyAll(decomp);
		return decomp.runAsync().then(function () {
			return self.options.port ||
				findPort(self.options.startPort, self.options.endPort);
		});
	}).then(function (port) {
		var args = [];
		self.options.args["--port"] =
			self.options.args["--port"] !== undefined ?
				self.options.args["--port"] : port;
		_.map(self.options.args, function (val, key) {
			if (val === true) {
				args.push(key);
			} else if (val !== false) {
				args.push(key);
				args.push(val);
			}
		});
		var promise = new Promise(function (resolve, reject) {
			var cmd = path.resolve(self.options.installPath, "bin", "mongod" + (
					process.platform === "win32" ? ".exe" : ""
				)), child;

			self.emit("debug", "spawning: ", cmd, args);
			child = spawn(cmd, args, {
				stdio: 'pipe'
			});
			child.on('error', function (code, signal) {
				if (promise.isPending)
					reject(new Error("Failed to start mongo, child exited with code " + code));
				self.emit('error', code, signal);
			});
			child.on('exit', function (code, signal) {
				if (promise.isPending)
					reject(new Error("Mongo child exited with code " + code));
				self.emit('error', code, signal);
			});
			readline.createInterface({
				input: child.stdout,
				terminal: false
			}).on("line", function (line) {
				if (promise.isPending) {
					if (/waiting for connections/.test(line))
						resolve(self.options.args["--port"]);
				}
				self.emit("stdout", line);
			});
			readline.createInterface({
				input: child.stderr,
				terminal: false
			}).on("line", function (line) {
				self.emit("stderr", line);
			});
		});
		return promise;
	});
}

module.exports = RapidMango;
