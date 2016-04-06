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

function MongoQuick(options) {
	if (!options.installPath)
		throw new Error("MongoQuick requires option installPath");
	if (!options.version)
		throw new Error("MongoQuick requires option version");
	if (!options.dataPath)
		options.dataPath = path.resolve(options.installPath, "data");
	options.logPath |= path.resolve(options.installPath, "mongod.log");
	options.startPort |= 6000;
	options.endPort |= 6999;
	this.options = options;
	return this;
}

util.inherits(MongoQuick, EventEmitter);

MongoQuick.prototype.start = function start() {
	var self = this;
	return Promise.all([
		mongodbDownload({
			version: self.options.version,
			http_opts: self.options.http_opts
		}),
		fs.mkdirpAsync(path.resolve(self.options.installPath)),
		fs.mkdirpAsync(path.resolve(self.options.dataPath))
	]).then(function(results) {
		var archiveFilename = results[0];
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

		return self.options.port ||
			findPort(self.options.startPort, self.options.endPort);
	}).then(function (port) {
		var promise = new Promise(function (resolve, reject) {
			var process = spawn(
				path.resolve(self.options.installPath, "bin", "mongod"),
				[
					"--port", port,
					"--dbpath", self.options.dataPath,
					"--balls"
				], {
					stdio: 'pipe'
				}
			);
			process.on('error', function (code, signal) {
				if (promise.isPending)
					reject(new Error("Failed to start mongo, process exited with code " + code));
			});
			process.on('exit', function (code, signal) {
				if (promise.isPending)
					reject(new Error("Mongo process exited with code " + code));
			});
			readline.createInterface({
				input: process.stdout,
				terminal: false
			}).on("line", function (line) {
				if (promise.isPending) {
					if (/waiting for connections/.test(line))
						resolve();
				}
				self.emit("stdout", line);
			});
			readline.createInterface({
				input: process.stderr,
				terminal: false
			}).on("line", function (line) {
				self.emit("stderr", line);
			});
		});
		return promise;
	});
}

module.exports = MongoQuick;
