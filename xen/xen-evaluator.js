//  ********* EVALUATOR *********
import operators from "./operators";
import macros from "./macros";
import xen from "./constants";
import { displayType } from "./helpers";

var args = {};

export default function evaluate(parseTree) {
    xen.__break = false;
    xen.__return = undefined;

    var parseNode = function(node) {
        if (xen.__break || node == undefined) return;

        let result;

        if (node.type === "number") {
            result = node.value;
        } else if (operators[node.type]) {
            let fn = operators[node.type];
            let left = parseNode(node.left);
            let right = parseNode(node.right);
            let args = (node.right && node.left)? [left, right] : [left || right];

            result = call(fn, args, "", node.type);
        } else if (node.type === "identifier") {
            var value = args.hasOwnProperty(node.value) ? args[node.value] : xen[node.value];
            if (typeof value === "undefined") throw node.value + " is undefined";
            if (value instanceof Function && !xen.__functionsAsData) throw new SyntaxError(`Missing parentheses in call to ${node.value}()`);
            result = value;
        } else if (node.type === "assign") {
            xen[node.name] = parseNode(node.value);
        } else if (node.type === "call") {
            let args = node.args.map(parseNode);
            let fn = xen[node.name];
            if (typeof fn === 'undefined') throw node.name + "() is undefined";

            result = call(fn, args, node.name);

        } else if (node.type === "function") {
            xen[node.name] = function() {
                for (var i = 0; i < node.args.length; i++) {
                    args[node.args[i].value] = arguments[i];
                }
                var ret = parseNode(node.value);
                args = {};
                return ret;
            };
        } else if (node.type === "macro") {
            let value = node.value;
            let fn = macros[value.macroId];
            if (fn != undefined) return fn(value.pre, value.block);
        }
        xen.__break = false;
        //console.log("unbreaking");
        return result;
    };
    //console.log("Evaling tree:",parseTree);
    // eval the parseTree, returning all vals in an array of value-type pairs
    let output = parseTree.map((node) => {
        var value = parseNode(node);
        if (typeof value !== "undefined") {
            let type = displayType(value);
            // store answer
            xen.ans = value;
            if (typeof value == 'symbol') return {value: value.description, type};
            else return {value, type};
        }
    });
    if (xen.__return != undefined) return [{value: xen.__return, type: displayType(xen.__return)}];
    else return output;
};



function call(fn, args, fnName, operator) {
    try {
        return fn(...args);
    } catch (e) {
        //console.log("error!",e);
        if (args.some(isPartiallyEvaluated)) {
            return partialFunction(fn, args, fnName, operator)
        } else {
            throw e;
        }
    }
}

function partialFunction(fn, args, name = fn.name, operator) {
    let argsCopy = args.slice(0);

    let f = function(...curriedArgs) {
        /* console.log(name, "called with", curriedArgs);
        console.log("current argsCopy:", argsCopy); */
        for (let i = 0, j = 0; i < argsCopy.length; i++) {
            if (isPartiallyEvaluated(argsCopy[i]) && curriedArgs[j]) {
                // replace holes
                if (argsCopy[i] == xen["..."]) {
                    //console.log("replacing", argsCopy[i], "with", curriedArgs[j]);
                    argsCopy[i] = curriedArgs[j++];
                    continue;
                }
                // while the function is unevaluated, fill its holes
                while (argsCopy[i].partialArgs && curriedArgs[j]) {
                    //console.log("filling in an arg:", argsCopy[i], "with", curriedArgs[j]);
                    argsCopy[i] = argsCopy[i](curriedArgs[j++]);
                }
            }
        }
        return call(fn, argsCopy, name, operator)
    }
    // total all the number of ... in the given arguments
    f.partialArgs = args.reduce((total, e) => numPartialArgs(e) + total, 0);
    if (operator) {
        f.toString = () => `(${displayPartial(args[0])} ${operator} ${displayPartial(args[1])})`;
    } else {
        f.toString = () => `${name}(${args.map(displayPartial)})`;
    }
    return f;
}

function isPartiallyEvaluated(expr) {
/*     console.log("called iPE with", expr); */
    if (expr) {
        return expr == xen["..."] || !!expr.partialArgs;
    } else {
        return false;
    }
}

function numPartialArgs(expr) {
    if (expr == xen["..."]) return 1;
    else if (expr) return expr.partialArgs || 0;
    else return 0;
}

function displayPartial(expr) {
/*     console.log("calling displayp") */
    return (expr == xen["..."])? "..." : (expr || "");
}