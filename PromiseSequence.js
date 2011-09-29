/*
    By Steve Hanov (steve.hanov@gmail.com)

    Released to the Public Domain.
*/
var Promise = require("promise");

/*
    Constructs a new PromiseSequence object.
*/
function PromiseSequence() {
    this.calls = [];
}

/*
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
*/
PromiseSequence.prototype.add = function(fn) {
    this.calls.push( {fn: fn} );
};

/*
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
*/
PromiseSequence.prototype.loop = function( nextFn, bodyFn )
{
    this.calls.push( {nextFn: nextFn, bodyFn: bodyFn} );
};

PromiseSequence.prototype.reject = function( result ) {
    if ( result !== undefined ) {
        this.result = result;
    }
    this.rejected = true;
};

PromiseSequence.prototype.resolve = function( result ) {
    if ( result !== undefined ) {
        this.result = result;
    }
    this.resolved = true;
};

PromiseSequence.prototype.exitLoop = function( result ) {
    if ( result !== undefined ) {
        this.result = result;
    }

    this.loopExited = true;
};

/*
    Starts the sequence. Returns a promise. If any item in the sequence is
    rejected, then the returned promise is also rejected. Otherwise, all items
    are executed in sequence.

    @param arg is an optional argument to be passed to the first item in the
    sequence.
*/
PromiseSequence.prototype.run = function( arg ) {
    var promise = new Promise.Promise();
    var index = 0;
    var self = this;

    // A helper function that calls an item in the sequence, and handles
    // rejection and resolution. The continuation function is called only if
    // the sequence is not rejected or resolved
    var callFunction = function( fn, arg, continuation ) {
        var result = fn( arg );

        // the item could have rejected the whole sequence
        if ( self.rejected ) { 
            promise.reject( self.result || result );

        // or the item could have resolved the whole sequence.
        } else if ( self.resolved ) {
            promise.resolve( self.result || result );

        // or the item could have returned a promise
        } else if ( result && result.then ) {
            result.then( function( arg ) {
                continuation( arg );
            }, function( error ) {
                promise.reject( error );
            });

        // or the item could have returned something else to be passed
        // to the next item in the sequence.
        } else {
            continuation( result );
        }
    };

    var runNext = function( arg ) {
        // if we have reached the end of the list, resolve the promise.
        if ( index == self.calls.length ) {
            promise.resolve( arg );

        // if the next item is not a loop,
        } else if ( self.calls[index].fn ) {
            callFunction( self.calls[index].fn, arg, function( result ) {
                index += 1;
                runNext( result );
            });

        // if the item is a loop and has not been started,
        } else if ( !self.calls[index].stage ) {
            self.loopExited = false;
            delete self.result;
            self.calls[index].initialArg = arg;
            callFunction( self.calls[index].nextFn, arg, function( result ) {
                //console.log( "   Result is ", result );
                self.calls[index].stage = 1;
                if ( self.loopExited ) {
                    index += 1;
                    result = self.result || result;
                }
                runNext( result );
            });

        // if the item is a loop and we need to run the body,
        } else if ( self.calls[index].stage == 1 ) {
            callFunction( self.calls[index].bodyFn, arg, function( result ) {
                self.calls[index].stage = 2;
                if ( self.loopExited ) {
                    index += 1;
                    result = self.result || result;
                }
                runNext( result );
            });

        // if the item is a loop and we need to run the step function again,
        } else if ( self.calls[index].stage == 2 ) {
            callFunction( 
                self.calls[index].nextFn, 
                self.calls[index].initialArg, 
                function( result ) {
                    self.calls[index].stage = 1;
                    if ( self.loopExited ) {
                        index += 1;
                        result = self.result || result;
                    }
                    runNext( result );
                }
            );
        }
    };

    runNext( arg );

    return promise;
};

exports.PromiseSequence = PromiseSequence;
