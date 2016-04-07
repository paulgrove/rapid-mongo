# rapid-mongo
MongoDB for the impatient - Download and run mongodb from nodejs

## Synopsis

```javascript
var RapidMongo = require('rapid-mongo'),
	rapid = new RapidMongo({
		installPath: "./mongo",
		version: "3.2.0"
	});
rapid.on("stdout", console.log);
rapid.on("stderr", console.error);
rapid.start().then(function (port) {
	console.log("Mongo is running on 127.0.0.1:"+port);
}).catch(console.error);
```

## Description

`rapid-mongo` is a module for the automatic download, unpacking and running of
mondodb directly from your program.  If no port is specified `rapid-mongo` will
pick an available port from a range.

The `mongod` process will end when node exits.

## Options

`RapidMongo` is constructed with an Object containing the following options.

### installPath - Required

`installPath` - where mongodb should be installed.  It is required.

### version - Required

`version` - The version of mongodb to download, OS and architechture is
auto detected, simply supply the version, eg: `"3.2.0"`.

### dbpath

`data` - The location for `mongod` to store the database.  defaults to the
`installPath + "/data"`.  This parameter is optional.

### port

`port` - The port that mongod will listen on.  This is optional, if not
specified then a free port will be selected from a range, see `startPort` and
`endPort`.

### startPort

`startPort` - If `port` is not specified then search from this port for a free
port to use.

### endPort

`endPort` - If `port` is not specifed then search until this port for a free
port to use.

### args

`args` is an optional parameter to pass arbitary options to the `mongod`
process.

This option should be an object with command line arguments supplied with the
key as the flag and the value as the argument value, use the value `true` to
enable a flag, and `false` to disable a flag.

example:

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

In the the arguments added to mongod would be:

`--upgrade --config ./config.conf`

The args `--dbpath` and `--port` are provided automaticly.  If you want to
override these values then use either the `dbpath` and `port` options to the
constructor, or use the `args` values `--dbpath` and `--port`.  If you wish to
disable these options entirely then set `--dbpath` or `--port` to `false`.

## start()

After constructing a `RapidMongo` object using the options above, you can
`start()` your mongo database.  This function returns a promise which resolves
to the port used by `mongod`.  If `mongod` fails to start then the promise will
be rejected with the error.

example:

```javascript
rapid.start().then(function (port) {
	console.log("Mongo is running on 127.0.0.1:"+port);
}).catch(console.error);
```

## Events

`RapidMongo` extends the `EventEmitter` class.  The following events are
available from the `.on()` methods.

### stdout

This event fires for each line from `mongod`'s stdout.  By default this will
be logging from the process.

### stderr

This event fires for each line from `mongod`'s stderr.

### debug

This event fires for any debugging inside the `rapid-mongo` module.

### error

This event fires if mongod fails to start.

### exit

This event fires when the mongod process exits.

## Notes on Other Modules

I looked for other modules with similar functionality before writing this
module, and I had found `mongodb-prebuilt`.  Unfortunatly at the time of writing
`mongo-prebuilt` was not fully functional.  Additionally its focus was on
command line access via the shell, although it has a programic interface
I was not able to get it to work correctly, and it wanted to fork and detatch
the mongod process.

This module is simpler and only provides the programic interface, it does not
by default fork and detach the mongod process meaning that `mongod` will end
when your program does.

I did however use the module `mongodb-download` in `rapid-mongo`, saving me
a great deal of effort.

If you are looking for a module to simply download mongodb, then look at
`mongodb-download`.

## Notes on Cross-Platform Compatibility

Effort has been made to support Windows and Mac OS, but currently only linux
has been tested.  This early release is made out of requirement, and a future
update will confirm support for other platforms.
