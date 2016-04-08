// Sigh couldn't get mongod to stay attached to parent process.  This crappy
// watcher script is the result.
//
// First argument (argv[2]) is the parent process.
// Second argument (argv[2]) is the child process.
//
// If the parent dies, then the child will be killed, and this process exits.
//
// This method suffers from potential race conditions regarding killing the
// wrong process after process id reuse.  However the second check should
// minimise the chances of this happening.
//
setInterval(function () {
	try {
		// if parent dies
		process.kill(process.argv[2],0);
	} catch (e) {
		// then try to kill child
		try {
			process.kill(process.argv[3]);
		} catch (e) { }
		// then exit
		process.exit();
	}
	try {
		// if child dies
		process.kill(process.argv[3],0);
	} catch (e) {
		// just exit
		process.exit();
	}
}, 1000);
