# rapid-mongo
MongoDB for the lazy - Download, unpack and run mongodb from your program.

Supports most Linux, OSX and Win32.

## Synopsis

*short example*

```javascript

var RapidMongo = require('rapid-mongo');

(new RapidMongo()).start().then(function (port) {
	console.log("Hurray! mongodb is now installed and running on port " + port);
	console.log("And it will stop running when this script ends");
}).catch(console.error);

```

Download can take a while, the following example outputs the progress and the
output from mongod:

*longer example*

```javascript

var RapidMongo = require('rapid-mongo'),
	rapid = new RapidMongo({
		installPath: "./mongo",
		version: "3.2.0"
	});

// verbose event for rapid-json messages
rapid.on("verbose", console.log);

// stdout/stderr events for mongod process output
rapid.on("stdout", console.log);
rapid.on("stderr", console.error);

// progress event for mongod download progress
rapid.on("progress", function (percent, mb) {
	console.log("Download progress: " + percent + "% " + mb + "MB");
});

// Start MongoDB
rapid.start().then(function (port) {
	console.log("Mongo is running on 127.0.0.1:" + port);
}).catch(console.error);

```

## Description

Designed for rapid development, proof of concept, and smaller projects.

`rapid-mongo` is a module for the automatic download, unpacking and running of
mongodb directly from your program.  If no port is specified `rapid-mongo` will
pick an available port from a range.

The `mongod` process will end when node exits.

Unfortunately it pains me to say, I have had to resort to using a watcher
process, mongodb will be killed by `tie-process.js` once your parent process
has ended.

## Options

`RapidMongo` is constructed with an Object containing the following options.

### installPath

`installPath` - where mongodb should be installed.  Optional, defaults to
`<parent script dir>/mongo`

### version

`version` - The version of mongodb to download, defaults to `"3.2.0"`.

### dbpath

`dbpath` - The location for `mongod` to store the database.  Defaults to the
`installPath + "/data"`.  This parameter is optional.

### port

`port` - The port that mongod will listen on.  This is optional, if not
specified then a free port will be selected from a range, see `startPort` and
`endPort`.

### startPort

`startPort` - If `port` is not specified then search from this port for a free
port to use.

### endPort

`endPort` - If `port` is not specified then search until this port for a free
port to use.

### args

`args` is an optional parameter to pass arbitrary options to the `mongod`
process.

This option should be an object with command line arguments supplied with the
key as the flag and the value as the argument value, use the value `true` to
enable a flag, and `false` to disable a flag.

Example:

```javascript
var RapidMongo = require('rapid-mongo'),
	rapid = new RapidMongo({
		installPath: "./mongo",
		version: "3.2.0",
		args: {
			"--upgrade": true,
			"--config": "./mongo.conf"
		}
	});
```

In the arguments added to mongod would be:

`--upgrade --config ./config.conf`

The args `--dbpath` and `--port` are provided automatically.  If you want to
override these values then use either the `dbpath` and `port` options to the
constructor, or use the `args` values `--dbpath` and `--port`.  If you wish to
disable these options entirely then set `--dbpath` or `--port` to `false`.

### arch

Set `arch` to override the detected architecture, options: `ia32` or `x64`.

### platorm

Set `platorm` to override the detected platform, options: `win32`, `darwin`,
`osx`, `linux` or `elementary OS`.

### httpOpts

Options to pass to http library, example:

```javascript
httpOpts: {
	agent: new https_proxy_agent("https://127.0.0.1:8080")
}
```

## download()

Optionally call `download()` to download mongo.  No need to call this function
directly, just call `start()`.

## install()

Optionally call `install()` to download and unpack mongo without running.  This
is called by `start()` so usually there is no reason to call this method.

## start()

After constructing a `RapidMongo` object using the options above, you can
`start()` your mongo database.  This function returns a promise which resolves
to the port used by `mongod`.  If `mongod` fails to start then the promise will
be rejected with the error.

Example:

```javascript
rapid.start().then(function (port) {
	console.log("Mongo is running on 127.0.0.1:"+port);
}).catch(console.error);
```

After successful installation, the mongo archive will automatically be removed.

## Events

`RapidMongo` extends the `EventEmitter` class.  The following events are
available from the `.on()` methods.

### verbose

Verbose messages from `rapid-mongo`.  Use This to find out what `rapid-mongo`
is currently doing.

### progress

Used during download to indicate progress, `function(percent, mb)`.

### stdout

This event fires for each line from `mongod`'s stdout.  By default this will
be logging from the process.

### stderr

This event fires for each line from `mongod`'s stderr.

### debug

This event fires for any debugging inside the `rapid-mongo` module.

### exit

This event fires when the mongod process exits.

## Notes on Other Modules

I looked for other modules with similar functionality before writing this
module, and I had found `mongodb-prebuilt`.  Unfortunately at the time of writing
`mongo-prebuilt` was not fully functional.  Additionally its focus was on
command line access via the shell, although it has a programmable interface
I was not able to get it to work correctly, and it wanted to fork and detach
the mongod process.

This module is simpler and only provides the programmable interface.

I used code modified from `mongodb-download` to determine and download the
correct mongo archive.

If you are looking for a module to simply download mongodb, then look at
`mongodb-download`.

## Node support

This module was developed on node `v5.10.0` compatibility with older versions
of node is unknown, however few if any ES6 features were used.

## Notes on Cross-Platform Compatibility

Known working on Ubuntu and most Linux, OSX, Windows.
