var _ = require("lodash"),
	Promise = require("bluebird"),
	path = require("path"),
	fs = Promise.promisifyAll(require("fs.extra")),
	os = require('os'),
	http = require('https'),
	getos = Promise.promisify(require('getos')),
	url = require('url'),
	findPort = Promise.promisify(require("find-free-port")),
	Decompress = Promise.promisifyAll(require("decompress")),
	readline = require('readline'),
	EventEmitter = require('events').EventEmitter,
	util = require('util'),
	spawn = require('child_process').spawn,
	DOWNLOAD_URI = "https://fastdl.mongodb.org";

function RapidMango(options) {
	options = options || {};
	options.installPath = options.installPath ||
		path.resolve(path.dirname(module.parent.filename), "mongo");
	options.version = options.version ||
		"3.2.0"
	options.dbpath = options.dbpath || path.resolve(options.installPath, "data");
	options.startPort = options.startPort || 6000;
	options.endPort = options.endPort || 6999;
	options.args = options.args || {};
	options.deleteTemporaryFiles = options.deleteTemporaryFiles === undefined ?
		false : options.deleteTemporaryFiles;

	options.args["--dbpath"] = options.args["--dbpath"] != undefined ?
		options.args["--dbpath"] : options.dbpath;
	options.mongodBin = path.resolve(options.installPath, "bin", "mongod" +
		(process.platform === "win32" ? ".exe" : ""));
	this.options = options;
	this.child = null;
	return this;
}

util.inherits(RapidMango, EventEmitter);

RapidMango.prototype.download = function download() {
	var self = this,
		dl_uri = DOWNLOAD_URI;
	return new Promise(function (resolve, reject) {
		var platform = self.options.platform || os.platform(),
			mongo_platform = "";
		switch(platform) {
			case "darwin":
				mongo_platform = "osx";
				break;
			case "win32":
				mongo_platform = "win32";
				break;
			case "linux":
				mongo_platform = "linux";
				break;
			case "elementary OS":	//os.platform() doesn't return linux for elementary OS.
				mongo_platform = "linux";
				break;
			case "sunos":
				mongo_platform = "sunos5";
				break;
			default:
				self.emit("debug", "unsupported platform %s by MongoDB", platform);
				throw new Error("unsupported OS");
		}

		self.emit("debug", "selected platform %s", mongo_platform);
		dl_uri += "/" + mongo_platform;

		var arch = self.options.arch || os.arch();

		if ( arch === "ia32" ) {
			if ( platform === "linux" ) {
				mongo_arch = "i686";
			} else if ( platform === "win32" ) {
				mongo_arch = "i386";
			} else {
				self.emit("debug", "unsupported platform and os combination");
				throw new Error("unsupported architecture");
			}
		} else if ( arch === "x64" ) {
			mongo_arch = "x86_64";
		} else {
			self.emit("debug", "unsupported architecture");
			throw new Error("unsupported architecture, ia32 and x64 are the only valid options");
		}
		
		self.emit("debug", "selected architecture %s", mongo_arch);

		var mongo_version = self.options.version || undefined;
		if (! mongo_version )
			throw new Error("missing version");
		
		self.emit("debug", "selected version: %s", mongo_version);

		var name = "mongodb-" + mongo_platform + "-" + mongo_arch;

		if ( mongo_platform === "linux" && mongo_arch !== "i686" ) {
			return getos().then(function(os) {
				self.emit("debug", "os dump", os);
				if ( /ubuntu/i.test(os.dist) ) {
					name += "-ubuntu";
					var ubuntu_version = os.release.split('.'),
						major_version = ubuntu_version[0],
						minor_version = ubuntu_version[1];
					if ( os.release == "14.04" || major_version > 14) {
						name += "1404";
					} else if ( os.release == "12.04" ) {
						name += "1204";
					} else if ( os.release == "14.10" ) {
						name += "1410-clang";
					} else {
						self.emit("debug", "using legacy release");
					}
				} else if ( /elementary OS/i.test(os.dist) ) {
					//use ubuntu version since Elementary OS Freya is based on Ubuntu 14.04
					//unfortunately os didn't seem to contain release field for Elementary OS.
					name += "-ubuntu";
					name += "1404";
				} else if ( /suse/i.test(os.dist) ) {
					name += "-suse";
					if ( /^11/.test(os.release) ) {
						name += "11";
					} else {
						self.emit("debug", "using legacy release");
					}
				} else if ( /rhel/i.test(os.dist) || /centos/i.test(os.dist) || /scientific/i.test(os.dist) ) {
					name += "-rhel";
					if ( /^7/.test(os.release) ) {
						name += "70";
					} else if ( /^6/.test(os.release) ) {
						name += "62";
					} else if ( /^5/.test(os.release) ) {
						name += "55";
					} else {
						self.emit("debug", "using legacy release");
					}
				} else if ( /fedora/i.test(os.dist) ) {
					// based on https://fedoraproject.org/wiki/Red_Hat_Enterprise_Linux?rd=RHEL#History
					name += "-rhel";
					var fedora_version = Number(os.release);
					if ( fedora_version > 18 ) {
						name += "70";
					} else if ( fedora_version < 19 && fedora_version >= 12 ) {
						name += "62";
					} else if ( fedora_version < 12 && fedora_version >= 6 ) {
						name += "55";
					} else {
						self.emit("debug", "using legacy release");
					}
				} else if ( /debian/i.test(os.dist) ) {
					name += "-debian";
					if ( /^(7|8)/.test(os.release) ) {
						name += "71";
					} else {
						//throw new Error("unsupported release of Debian " + os.release);
						self.emit("debug", "using legacy release");
					}
				} else {
					self.emit("debug", "using legacy release");
				}
				name += "-" + mongo_version;
				return resolve([name, mongo_platform]);
			});
		} else {
			name += "-" + mongo_version;
			return resolve([name, mongo_platform]);
		}
	}).then(function (results) {
		var mongo_archive = "",
			name = results[0],
			mongo_platform = results[1];

		if ( mongo_platform === "win32" ) {
			mongo_archive = "zip";
		} else {
			mongo_archive = "tgz";
		}
		self.emit("debug", "selected archive %s", mongo_archive);

		name += "." + mongo_archive;
		self.emit("debug", "final name: %s", name);
		dl_uri += "/" + name;
		self.emit("verbose", "Downloading: %s", dl_uri);

		var temp_dir = self.options.downloadDir || path.resolve(os.tmpdir(), 'mongodb-download'),
			downloadDir = path.resolve(temp_dir);

		return fs.mkdirpAsync(downloadDir).then(function () {
			return new Promise(function (resolve, reject) {
				self.emit("debug", "download directory: %s", temp_dir);
				var download_location = path.resolve(downloadDir, name);
				
				var temp_download_location = path.resolve(downloadDir, name + ".in_progress");
				self.emit("debug", "download complete path: %s", download_location);

				try {
					var stats = fs.lstatSync(download_location);
					self.emit("debug", "sending file from cache");
					return resolve(download_location);
				} catch (e) {
					if ( e.code !== "ENOENT" ) throw e;
				}

				var file = fs.createWriteStream(temp_download_location),
					httpOpts = self.options.httpOpts || {},
					download_url = url.parse(dl_uri);

				httpOpts.protocol = download_url.protocol;
				httpOpts.hostname = download_url.hostname;
				httpOpts.path = download_url.path;

				self.emit("debug", "http self.options:", httpOpts);
				var request = http.get(httpOpts, function(response) {
					var cur = 0,
						len = parseInt(response.headers['content-length'], 10),
						total = len / 1048576;

					response.pipe(file);
					file.on('finish', function() {
						file.close(function() {
							fs.renameAsync(temp_download_location, download_location).then(function () {
								resolve(download_location);
							}).catch(function () {
								reject("Failed to rename temp file");
							});
						});
					});

					var last_percent = 0;
					response.on("data", function(chunk) {
						cur += chunk.length;
						var percent_complete = (100.0 * cur / len).toFixed(1);
						var mb_complete = (cur / 1048576).toFixed(1);
						if (percent_complete != last_percent)
							self.emit("progress", percent_complete, mb_complete);
						last_percent = percent_complete;
					});

					request.on("error", function(e){
						self.emit("debug", "request error:", e);
						reject(e);
					});
				});
			});
		});
	}).bind(this);
};

RapidMango.prototype.install = function install() {
	var self = this,
		fileExists;
	self.emit("verbose", "Checking for mongod binary: " +
			  self.options.mongodBin);
	if (fs.accessAsync) {
		self.emit("debug", "using fs.access");
		fileExists = fs.accessAsync(self.options.mongodBin, fs.F_OK);
	} else if (fs.statAsync) {
		self.emit("debug", "using fs.stat");
		fileExists = fs.statAsync(self.options.mongodBin).then(function (stat) {
			self.emit("debug", stat);
		});
	} else if (fs.exists) {
		self.emit("debug", "using fs.exists");
		fileExists = new Promise(function (resolve, reject) {
			fs.exists(function (exists) {
				if (exists) {
					resolve();
				} else {
					reject(new Error("File does not exist"));
				}
			});
		});
	} else {
		return Promise.reject(new Error("Can't find file exists type method, downloading anyway..."));
	}
	return fileExists.catch(function (err) {
		self.emit("debug", err);
		return Promise.all([
			self.download(),
			fs.mkdirpAsync(path.resolve(self.options.installPath))
		]).then(function(results) {
			var archiveFilename = results[0],
				archiveType;
			self.emit("verbose", "Decompressing archive...");
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
				if(self.options.deleteTemporaryFiles)
					return fs.unlinkAsync(archiveFilename);
			});
		});
	}).bind(this);
};

RapidMango.prototype.start = function start() {
	var self = this;
	return self.install().then(function () {
		return fs.mkdirpAsync(path.resolve(self.options.args["--dbpath"]))
	})
	.then(function () {
		return self.options.port ||
			findPort(self.options.startPort, self.options.endPort);
	})
	.then(function (port) {
		self.emit("verbose", "Starting mongod...");
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
			self.emit("debug", "spawning: ", self.options.mongodBin, args);
			self.child = spawn(self.options.mongodBin, args, {
				stdio: 'pipe'
			});
			self.child.on('error', function (code, signal) {
				if (promise.isPending)
					reject(new Error("Failed to start mongo, child exited with code " + code));
				delete self.child;
				self.emit('exit', code, signal);
			});
			self.child.on('exit', function (code, signal) {
				if (promise.isPending)
					reject(new Error("Mongo child exited with code " + code));
				delete self.child;
				self.emit('exit', code, signal);
			});
			readline.createInterface({
				input: self.child.stdout,
				terminal: false
			}).on("line", function (line) {
				if (promise.isPending) {
					if (/waiting for connections/.test(line))
						resolve(self.options.args["--port"]);
				}
				self.emit("stdout", line);
			});
			readline.createInterface({
				input: self.child.stderr,
				terminal: false
			}).on("line", function (line) {
				self.emit("stderr", line);
			});
			// tie process, if parent dies, kill child.
			// I hate this hack
			spawn(process.execPath, [
					path.resolve(__dirname, "tie-process.js"),
					process.pid,
					self.child.pid
			], {
				stdio: 'ignore'
			});
		});
		return promise;
	}).bind(this);
};

RapidMango.prototype.stop = function stop() {
	var self = this;
	return new Promise(function (resolve, reject) {
		if (self.child === undefined) {
			resolve(0);
			return;
		}
		self.child.on('close', function (code) {
			resolve(code);
		});
		self.child.on('error', function (err) {
			reject(err);
		});
		try {
			self.child.kill();
			delete self.child;
		} catch (err) {
			reject(err);
		}
	}).bind(this);
};

RapidMango.prototype.status = function status() {
	var result = {
		status: 'stopped',
		pid: null,
	}

	if(this.child && this.child.pid) {
		result.status = 'started'
		result.pid = this.child.pid
	}

	return new Promise(function (resolve) {
		resolve(result)
	}).bind(this);
};
module.exports = RapidMango;
