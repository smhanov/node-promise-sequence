# promise-sequence

Promise-sequence extends promises to lets you queue up sequential operations in
node.js. It supports sequences and loops.

## API

The PromiseSequence class is created using new, and has the following methods.

### PromiseSequence.add( fn )
Adds a function to the sequence. The function should take a single
argument, which is the result of the previous operation. If there was not
previous operation, the argument is what was passed to the run() function.

The return value of the function will be passed to the next function in the
sequence. If function returns a promise, the promise is first resolved, and
the result of the promise is then passed to the next function in the
sequence.

The function may prematurely terminate the sequence by calling the reject()
or resolve() functions. The sequence will then terminate with the argument
passed to these functions.

### PromiseSequence.loop( nextFn, bodyFn )

Adds a loop to the sequence. Loops have two parts: A next function, and a
body function.

When the loop executes, the nextFunction is called first. Its argument is
the result of the previous operation in the sequence. The argument passed
to the nextFunction on repeated calls never changes.

When the nextFunction completes, the bodyFunction is called with the result
of the nextFunction. The result of the bodyFunction is not used. When the
bodyFunction completes, the nextFunction will again be called, continuing
the loop.

The loop terminates whenever exitLoop() is called, and the result of the
loop is the argument passed to exitLoop().

### PromiseSequence.reject( result )
Rejects the entire sequence, returning the given result. This is usually called
from within a function added with add() or loop().


### PromiseSequence.resolve( result )
Resolves the entire sequence, returnig the given result. This is usually called
from within a function added with add() or loop().

### PromiseSequence.exitLoop( result )
Terminates the current loop, and passes the result to the next function in the
sequence. If there is no item in the sequence, the entire sequence is resolved
with the given result.

### Promise.run( arg )

Starts the sequence. Returns a promise. If any item in the sequence is
rejected, then the returned promise is also rejected. Otherwise, all items
are executed in sequence.

"arg" is an optional argument to be passed to the first item in the
sequence.


## Example
<code>
    // Read all the files in the folder in a sequence, using Promises
    var fs = require("fs");
    var Promise = require("promise");
    var PromiseSequence = require("./PromiseSequence").PromiseSequence;

    // Wrap the io functions with ones that return promises.
    var readdir_promise = Promise.convertNodeAsyncFunction(fs.readdir);
    var readFile_promise = Promise.convertNodeAsyncFunction( fs.readFile );

    var seq = new PromiseSequence();
    var index = 0;
    var totalBytes = 0;
    var files = null;

    seq.add( function() {
        return readdir_promise( "." );
    });

    seq.loop( 
        // The "next" function of the loop takes the result of the readdir and
        // reads the file. It is executed when the loop is entered, and again after
        // each time the body is executed.
        function( files_arg ) {
            files = files_arg;
            if ( index == files.length ) {
                seq.exitLoop(totalBytes);
                return;
            } else {
                console.log("Reading file " + files[index]);
                return readFile_promise( files[index++] );
            }
        },

        // The "body" function of the loop is called with the result of the "next" function.
        // It simply sums the length of the file.
        function( contents ) {
            totalBytes += contents.length;
        }
    );

    seq.run().then( function(total) {
        console.log("Done reading file. Total bytes: " + total);
    }, function(error) {
        console.log("Error reading files: ", error);
    });
</code>
