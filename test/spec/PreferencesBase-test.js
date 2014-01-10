/*
 * Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

/*jslint vars: true, plusplus: true, devel: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global $, define, describe, it, xit, expect, beforeEach, afterEach, waitsFor, waitsForDone, runs, beforeFirst, afterLast, spyOn, brackets */
/*unittests: Preferences Base*/

define(function (require, exports, module) {
    'use strict';
    
    // Load dependent modules
    var PreferencesBase         = require("preferences/PreferencesBase"),
        FileSystem              = require("filesystem/FileSystem"),
        SpecRunnerUtils         = require("spec/SpecRunnerUtils"),
        _                       = require("thirdparty/lodash");
    
    var testPath = SpecRunnerUtils.getTestPath("/spec/PreferencesBase-test-files");

    describe("Preferences Base", function () {
        describe("Memory Storage", function () {
            it("should support get and save operations", function () {
                var sampleData = {
                    foo: 1,
                    bar: 2
                };
                
                var storage = new PreferencesBase.MemoryStorage(sampleData);
                
                // This storage is synchronous
                storage.load().then(function (data) {
                    expect(data).toEqual(sampleData);
                });
                
                storage.save({
                    foo: 3
                }).then(function () {
                    expect(storage.data).not.toEqual(sampleData);
                    expect(storage.data.foo).toEqual(3);
                    expect(storage.data.bar).not.toBeDefined();
                });
            });
        });
        
        describe("Path Layer", function () {
            var data = {
                spaceUnits: 4,
                useTabChar: false,
                path: {
                    "*.html": {
                        spaceUnits: 2
                    }
                }
            };
            
            it("handles a variety of glob patterns", function () {
                var data = {
                    "**.html": {
                        spaceUnits: 2
                    },
                    "lib/*.js": {
                        spaceUnits: 3
                    },
                    "lib/**.css": {
                        spaceUnits: 4
                    },
                    "*.{md,txt}": {
                        spaceUnits: 5
                    }
                };
                
                var layer = new PreferencesBase.PathLayer("/.brackets.prefs");
                
                expect(layer.get(data, "spaceUnits", {
                    filename: "/public/index.html"
                })).toBe(2);
                
                expect(layer.get(data, "spaceUnits", {
                    filename: "/lib/script.js"
                })).toBe(3);
                
                expect(layer.get(data, "spaceUnits", {
                    filename: "/lib/foo/script.js"
                })).toBeUndefined();
                
                expect(layer.get(data, "spaceUnits", {
                    filename: "/lib/foo/styles.css"
                })).toBe(4);
                
                expect(layer.get(data, "spaceUnits", {
                    filename: "/README.md"
                })).toBe(5);
                
                expect(layer.get(data, "spaceUnits", {
                    filename: "foo.js"
                })).toBeUndefined();
            });
        });
        
        describe("Scope", function () {
            it("should look up a value", function () {
                var data = {
                    spaceUnits: 4,
                    useTabChar: false
                };
                
                var scope = new PreferencesBase.Scope(new PreferencesBase.MemoryStorage(data));
                // MemoryStorage operates synchronously
                scope.load();
                
                expect(scope.get("spaceUnits")).toBe(4);
                expect(scope.getKeys().sort()).toEqual(["spaceUnits", "useTabChar"].sort());
            });
            
            it("should look up a value with a path layer", function () {
                var data = {
                    spaceUnits: 4,
                    path: {
                        "src/*js": {
                            spaceUnits: 2
                        }
                    }
                };
                
                var layer = new PreferencesBase.PathLayer("/");
                var scope = new PreferencesBase.Scope(new PreferencesBase.MemoryStorage(data));
                scope.load();
                
                scope.addLayer(layer);
                
                expect(scope.get("path")).toBeUndefined();
                expect(scope.get("spaceUnits")).toBe(4);
                
                expect(scope.get("spaceUnits", {
                    filename: "/src/foo.js"
                })).toBe(2);
                
                expect(scope.get("spaceUnits", {
                    filename: "/top.js"
                })).toBe(4);
            });
            
            it("can return its keys", function () {
                var data = {
                    spaceUnits: 4,
                    useEmojiForTabs: true,
                    path: {
                        "**.js": {
                            spaceUnits: 3,
                            showNonWhitespace: false
                        },
                        "README.md": {
                            markdown: false,
                            useEmojiForTabs: false
                        }
                    }
                };
                
                var scope = new PreferencesBase.Scope(new PreferencesBase.MemoryStorage(data));
                scope.addLayer(new PreferencesBase.PathLayer("/"));
                scope.load();
                
                var keys = scope.getKeys();
                var expected = ["spaceUnits", "useEmojiForTabs", "showNonWhitespace", "markdown"];
                expect(keys.sort()).toEqual(expected.sort());
                
                keys = scope.getKeys({
                    filename: "/coffeescript.ts"
                });
                expected = ["spaceUnits", "useEmojiForTabs"];
                expect(keys.sort()).toEqual(expected.sort());
                
                keys = scope.getKeys({
                    filename: "/README.md"
                });
                expected = ["spaceUnits", "useEmojiForTabs", "markdown"];
                expect(keys.sort()).toEqual(expected.sort());
            });
            
            it("notifies of changes", function () {
                var data1 = {
                    spaceUnits: 4,
                    cursorSize: 27,
                    path: {
                        "**.js": {
                            statusBarElephants: false
                        }
                    }
                };
                
                var storage = new PreferencesBase.MemoryStorage(data1);
                var scope = new PreferencesBase.Scope(storage);
                scope.addLayer(new PreferencesBase.PathLayer("/"));
                scope.load();
                
                var data2 = {
                    spaceUnits: 4,
                    path: {
                        "**.js": {
                            trafficLight: "green"
                        },
                        "**.md": {
                            statusBarElephants: true
                        }
                    }
                };
                
                storage.data = data2;
                var events = [];
                $(scope).on("change", function (e, data) {
                    events.push(data);
                });
                scope.load();
                
                expect(events.length).toBe(1);
                expect(events[0].ids.sort()).toEqual(
                    ["spaceUnits", "cursorSize", "statusBarElephants", "trafficLight"].sort()
                );
            });
        });
        
        describe("Preferences Manager", function () {
            it("should yield an error if a preference is redefined", function () {
                var pm = new PreferencesBase.PreferencesSystem();
                pm.definePreference("foo.bar", "string");
                try {
                    pm.definePreference("foo.bar", "string");
                    expect("We should have gotten an exception").toEqual("but we didn't");
                } catch (e) {
                }
            });
            
            
            it("will automatically wrap a Storage with a Scope", function () {
                var pm = new PreferencesBase.PreferencesSystem();
                pm.addScope("test", new PreferencesBase.MemoryStorage());
                pm.set("test", "testval", 27);
                expect(pm.get("testval")).toBe(27);
            });
            
            it("should find the default values", function () {
                var pm = new PreferencesBase.PreferencesSystem();
                pm.definePreference("foo.bar", "number", 0);
                expect(pm.get("nonexistent")).not.toBeDefined();
                expect(pm.get("foo.bar")).toBe(0);
            });
            
            it("should produce an error for setValue on undefined scope", function () {
                var pm = new PreferencesBase.PreferencesSystem();
                try {
                    pm.set("nonscope", "foo", false);
                    expect("Should have gotten an error for nonexistent scope").toBe("but didn't");
                } catch (e) {
                    expect(e.toString().indexOf("scope")).toBeGreaterThan(-1);
                }
            });
            
            it("supports nested scopes", function () {
                var pm = new PreferencesBase.PreferencesSystem();
                pm.definePreference("useTabChar", "boolean", false);
                pm.definePreference("tabSize", "number", 4);
                pm.definePreference("spaceUnits", "number", 4);
                var userScope = new PreferencesBase.Scope(new PreferencesBase.MemoryStorage());
                var projectScope = new PreferencesBase.Scope(new PreferencesBase.MemoryStorage());
                pm.addScope("user", userScope);
                pm.addScope("project", projectScope);
                
                expect(pm.get("spaceUnits")).toEqual(4);
                
                pm.set("user", "useTabChar", true);
                pm.set("user", "tabSize", 8);
                pm.set("user", "spaceUnits", 8);
                pm.set("project", "spaceUnits", 2);
                
                expect(pm.get("spaceUnits")).toBe(2);
                expect(pm.get("useTabChar")).toBe(true);
                expect(pm.get("tabSize")).toBe(8);
            });
            
            it("handles asynchronously loaded scopes", function () {
                var storage1 = new PreferencesBase.MemoryStorage({
                    testKey: 1
                });
                
                var deferred1 = $.Deferred();
                storage1.load = function () {
                    return deferred1;
                };
                
                var storage2 = new PreferencesBase.MemoryStorage({
                    testKey: 2
                });
                
                var deferred2 = $.Deferred();
                storage2.load = function () {
                    return deferred2;
                };
                
                var pm = new PreferencesBase.PreferencesSystem();
                pm.definePreference("testKey", "number", 0);
                pm.addScope("storage1", new PreferencesBase.Scope(storage1), {
                    before: "storage2"
                });
                pm.addScope("storage2", new PreferencesBase.Scope(storage2), {
                    before: "default"
                });
                
                expect(pm.get("testKey")).toBe(0);
                
                deferred1.resolve(storage1.data);
                expect(pm.get("testKey")).toBe(0);
                
                deferred2.resolve(storage2.data);
                expect(pm.get("testKey")).toBe(1);
            });
            
            it("can notify of preference changes through set", function () {
                var pm = new PreferencesBase.PreferencesSystem();
                pm.definePreference("spaceUnits", "number", 4);
                pm.addScope("user", new PreferencesBase.MemoryStorage());
                var eventData;
                pm.on("change", function (e, data) {
                    eventData = data;
                });
                
                pm.set("user", "testing", true);
                expect(eventData).toEqual({
                    ids: ["testing"]
                });
                
                eventData = undefined;
                pm.set("user", "spaceUnits", 4);
                expect(eventData).toEqual({
                    ids: ["spaceUnits"]
                });
            });
            
            it("can notify of preference changes via scope changes", function () {
                var pm = new PreferencesBase.PreferencesSystem();
                pm.definePreference("spaceUnits", "number", 4);
                
                var eventData = [];
                pm.on("change", function (e, data) {
                    eventData.push(data);
                });
                
                pm.addScope("user", new PreferencesBase.MemoryStorage({
                    spaceUnits: 4,
                    elephants: "charging"
                }));
                
                expect(eventData).toEqual([{
                    ids: ["spaceUnits", "elephants"]
                }]);
                
                eventData = [];
                pm.removeScope("user");
                expect(eventData).toEqual([{
                    ids: ["spaceUnits", "elephants"]
                }]);
            });
            
            it("notifies when there are layer changes", function () {
                var pm = new PreferencesBase.PreferencesSystem();
                
                var data = {
                    spaceUnits: 4,
                    useTabChar: false,
                    path: {
                        "foo.txt": {
                            spaceUnits: 2,
                            alpha: "bravo"
                        }
                    }
                };
                
                var scope = new PreferencesBase.Scope(new PreferencesBase.MemoryStorage(data));
                pm.addScope("user", scope);
                
                var eventData = [];
                pm.on("change", function (e, data) {
                    eventData.push(data);
                });
                
                scope.addLayer(new PreferencesBase.PathLayer("/"));

                expect(eventData).toEqual([{
                    ids: ["spaceUnits", "alpha"]
                }]);
                
                // Extra verification that layer keys works correctly
                var keys = scope._layers[0].getKeys(scope.data.path, {
                    filename: "/bar.txt"
                });
                
                expect(keys).toEqual([]);
                keys = scope._layers[0].getKeys(scope.data.path, {
                    filename: "/foo.txt"
                });
                expect(keys.sort()).toEqual(["spaceUnits", "alpha"].sort());
            });
            
            it("can notify changes for single preference objects", function () {
                var pm = new PreferencesBase.PreferencesSystem();
                var pref = pm.definePreference("spaceUnits", "number", 4);
                var retrievedPref = pm.getPreference("spaceUnits");
                expect(retrievedPref).toBe(pref);
                var changes = 0;
                pref.on("change", function (e) {
                    changes++;
                });
                var newScope = new PreferencesBase.Scope(new PreferencesBase.MemoryStorage({
                    spaceUnits: 2
                }));
                pm.addScope("new", newScope);
                expect(changes).toEqual(1);
                
                pref.off("change");
                pm.set("new", "spaceUnits", 10);
                expect(changes).toEqual(1);
                
                changes = 0;
                pm.on("change", "spaceUnits", function () {
                    changes++;
                });
                pm.set("new", "spaceUnits", 11);
                expect(changes).toEqual(1);
            });
            
            it("supports removal of scopes", function () {
                var pm = new PreferencesBase.PreferencesSystem();
                var events = [];
                pm.on("change", function (e, data) {
                    events.push(data);
                });
                
                pm.addScope("first", new PreferencesBase.MemoryStorage({
                    spaceUnits: 1
                }));
                pm.addScope("second", new PreferencesBase.MemoryStorage({
                    spaceUnits: 2
                }));
                
                events = [];
                expect(pm.get("spaceUnits")).toBe(2);
                pm.removeScope("second");
                expect(pm.get("spaceUnits")).toBe(1);
                expect(events).toEqual([
                    {
                        ids: ["spaceUnits"]
                    }
                ]);
            });
            
            it("can manage preferences files in the file tree", function () {
                var pm = new PreferencesBase.PreferencesSystem();
                
                pm.addScope("user", new PreferencesBase.MemoryStorage({
                    spaceUnits: 99
                }));
                
                pm.addScope("session", new PreferencesBase.MemoryStorage({}));
                
                var requestedFiles = [];
                var testScopes = {};
                function getScopeForFile(filename) {
                    requestedFiles.push(filename);
                    return testScopes[filename];
                }
                
                function checkExists(filename) {
                    var exists = testScopes[filename] !== undefined;
                    return new $.Deferred().resolve(exists).promise();
                }
                
                testScopes["/.brackets.prefs"] = new PreferencesBase.Scope(new PreferencesBase.MemoryStorage({
                    spaceUnits: 1,
                    first: 1,
                    path: {
                        "foo.js": {
                            spaceUnits: 2,
                            second: 2
                        },
                        "bar/baz.js": {
                            spaceUnits: 3,
                            third: 3
                        },
                        "projects/**": {
                            spaceUnits: 4,
                            fourth: 4
                        }
                    }
                }));
                
                testScopes["/projects/brackets/.brackets.prefs"] = new PreferencesBase.Scope(new PreferencesBase.MemoryStorage({
                    spaceUnits: 5,
                    fifth: 5,
                    path: {
                        "thirdparty/**": {
                            spaceUnits: 6,
                            sixth: 6
                        }
                    }
                }));
                testScopes["/projects/brackets/thirdparty/codemirror/.brackets.prefs"] = new PreferencesBase.Scope(new PreferencesBase.MemoryStorage({
                    spaceUnits: 7,
                    seventh: 7
                }));
                pm.addPathScopes(".brackets.prefs", {
                    getScopeForFile: getScopeForFile,
                    checkExists: checkExists,
                    before: "user"
                });
                
                var didComplete = false;
                
                var events = [];
                pm.on("change", function (e, data) {
                    events.push(data);
                });
                
                // this should resolve synchronously
                pm.setPathScopeContext("/README.txt").done(function () {
                    didComplete = true;
                    expect(requestedFiles).toEqual(["/.brackets.prefs"]);
                    expect(pm.get("spaceUnits")).toBe(1);
                    expect(pm._defaultContext.scopeOrder).toEqual(["session", "path:/.brackets.prefs", "user", "default"]);
                    expect(events.length).toEqual(1);
                    expect(events[0].ids.sort()).toEqual(["spaceUnits", "first", "second", "third", "fourth"].sort());
                });
                
                requestedFiles = [];
                events = [];
                pm.setPathScopeContext("/foo.js").done(function () {
                    expect(requestedFiles).toEqual([]);
                    expect(pm.get("spaceUnits")).toBe(2);
                    expect(events.length).toBe(1);
                    expect(events[0].ids.sort()).toEqual(["spaceUnits", "first", "second"].sort());
                });
                
                events = [];
                pm.setPathScopeContext("/bar/baz.js").done(function () {
                    expect(requestedFiles).toEqual([]);
                    expect(pm.get("spaceUnits")).toBe(3);
                    expect(events.length).toBe(1);
                    expect(events[0].ids.sort()).toEqual(["spaceUnits", "first", "second", "third"].sort());
                });
                
                events = [];
                pm.setPathScopeContext("/projects/README.txt").done(function () {
                    expect(requestedFiles).toEqual([]);
                    expect(pm.get("spaceUnits")).toBe(4);
                    expect(events.length).toBe(1);
                    expect(events[0].ids.sort()).toEqual(["spaceUnits", "first", "third", "fourth"].sort());
                });
                
                events = [];
                pm.setPathScopeContext("/projects/brackets/README.md").done(function () {
                    expect(requestedFiles).toEqual(["/projects/brackets/.brackets.prefs"]);
                    expect(pm._defaultContext.scopeOrder).toEqual(
                        ["session", "path:/projects/brackets/.brackets.prefs",
                            "path:/.brackets.prefs", "user", "default"]
                    );
                    expect(pm.get("spaceUnits")).toBe(5);
                    expect(events.length).toBe(2);
                    expect(events[0].ids.sort()).toEqual(["spaceUnits", "first", "fourth"].sort());
                    expect(events[1].ids.sort()).toEqual(["spaceUnits", "fifth", "sixth"].sort());
                });
                
                requestedFiles = [];
                events = [];
                pm.setPathScopeContext("/projects/brackets/thirdparty/requirejs/require.js")
                    .done(function () {
                        expect(requestedFiles).toEqual([]);
                        expect(pm.get("spaceUnits")).toBe(6);
                        expect(events.length).toBe(1);
                        expect(events[0].ids.sort()).toEqual(["spaceUnits", "first", "fourth", "fifth", "sixth"].sort());
                    });
                
                events = [];
                pm.setPathScopeContext("/projects/brackets/thirdparty/codemirror/cm.js")
                    .done(function () {
                        expect(requestedFiles)
                            .toEqual(["/projects/brackets/thirdparty/codemirror/.brackets.prefs"]);
                        expect(pm.get("spaceUnits")).toBe(7);
                        expect(events.length).toBe(2);
                        expect(events[0].ids.sort()).toEqual(["spaceUnits", "first", "fourth", "fifth", "sixth"].sort());
                        expect(events[1].ids.sort()).toEqual(["spaceUnits", "seventh"].sort());
                    });
                
                events = [];
                requestedFiles = [];
                pm.setPathScopeContext("/README.md").done(function () {
                    expect(requestedFiles).toEqual([]);
                    expect(pm.get("spaceUnits")).toBe(1);
                    expect(pm._defaultContext.scopeOrder).toEqual(["session", "path:/.brackets.prefs", "user", "default"]);
                    expect(events.length).toBe(3);
                    expect(events[0].ids.sort()).toEqual(["spaceUnits", "fifth", "sixth"].sort());
                    expect(events[1].ids.sort()).toEqual(["spaceUnits", "seventh"].sort());
                    expect(events[2].ids.sort()).toEqual(["spaceUnits", "first", "fourth"].sort());
                });
                
                events = [];
                requestedFiles = [];
                pm.setPathScopeContext("/projects/brackets/thirdparty/codemirror/cm.js").done(function () {
                    expect(_.keys(pm._scopes).length).toBe(6);
                    expect(requestedFiles.length).toBe(2);
                    expect(pm.get("spaceUnits")).toBe(7);
                    expect(events.length).toBe(3);
                    expect(events[0].ids.sort()).toEqual(["spaceUnits", "first", "fourth"].sort());
                    expect(events[1].ids.sort()).toEqual(["spaceUnits", "seventh"].sort());
                    expect(events[2].ids.sort()).toEqual(["spaceUnits", "fifth", "sixth"].sort());
                });
                
                expect(didComplete).toBe(true);
            });
        });
        
        describe("File Storage", function () {
            var settingsFile = FileSystem.getFileForPath(testPath + "/.brackets.prefs"),
                newSettingsFile = FileSystem.getFileForPath(testPath + "/new.prefs"),
                filestorage,
                originalText;
            
            beforeFirst(function () {
                var deferred = $.Deferred();
                settingsFile.read({}, function (err, text) {
                    if (err) {
                        deferred.reject(err);
                        return;
                    }
                    originalText = text;
                    deferred.resolve();
                });
                waitsForDone(deferred.promise());
            });
            
            beforeEach(function () {
                filestorage = new PreferencesBase.FileStorage(settingsFile.fullPath);
            });
            
            afterEach(function () {
                var deferred = $.Deferred();
                settingsFile.write(originalText, {}, function (err) {
                    if (err) {
                        deferred.reject(err);
                    } else {
                        deferred.resolve();
                    }
                });
                waitsForDone(deferred.promise());
                
                var deleted = false;
                runs(function () {
                    newSettingsFile.unlink(function () {
                        deleted = true;
                    });
                });
                waitsFor(function () {
                    return deleted;
                });
            });
            
            it("can load preferences from disk", function () {
                var filestorage = new PreferencesBase.FileStorage(settingsFile.fullPath);
                var pm = new PreferencesBase.PreferencesSystem();
                var projectScope = new PreferencesBase.Scope(filestorage);
                waitsForDone(pm.addScope("project", projectScope));
                runs(function () {
                    projectScope.addLayer(new PreferencesBase.PathLayer("/"));
                    expect(pm.get("spaceUnits")).toBe(92);
                    
                    expect(pm.get("spaceUnits", {
                        scopeOrder: ["project"],
                        filename: "/foo.go"
                    })).toBe(27);
                });
            });
            
            it("can save preferences", function () {
                var filestorage = new PreferencesBase.FileStorage(settingsFile.fullPath);
                var pm = new PreferencesBase.PreferencesSystem();
                var projectScope = new PreferencesBase.Scope(filestorage);
                waitsForDone(pm.addScope("project", projectScope));
                runs(function () {
                    var memstorage = new PreferencesBase.MemoryStorage();
                    pm.addScope("session", new PreferencesBase.Scope(memstorage));
                    pm.set("session", "unicorn-filled", true);
                    pm.set("project", "unicorn-filled", false);
                    waitsForDone(pm.save());
                    runs(function () {
                        expect(memstorage.data["unicorn-filled"]).toBe(true);
                    });
                });
            });
            
            it("can create a new pref file", function () {
                var filestorage = new PreferencesBase.FileStorage(newSettingsFile.fullPath, true);
                var pm = new PreferencesBase.PreferencesSystem();
                var newScope = new PreferencesBase.Scope(filestorage);
                waitsForDone(pm.addScope("new", newScope), "adding scope");
                runs(function () {
                    pm.set("new", "unicorn-filled", true);
                    expect(pm.get("unicorn-filled")).toBe(true);
                    
                    waitsForDone(pm.save(), "saving prefs");
                    
                    var deferred = $.Deferred();
                    runs(function () {
                        newSettingsFile.exists(function (err, exists) {
                            if (err || !exists) {
                                deferred.reject(err);
                            } else {
                                deferred.resolve();
                            }
                        });
                    });
                    
                    waitsForDone(deferred.promise(), "checking file");
                });
                
            });
            
            it("can load preferences later", function () {
                var filestorage = new PreferencesBase.FileStorage();
                var pm = new PreferencesBase.PreferencesSystem();
                var newScope = new PreferencesBase.Scope(filestorage);
                newScope.addLayer(new PreferencesBase.PathLayer("/"));
                var changes = [];
                waitsForDone(pm.addScope("new", newScope), "adding scope");
                pm.on("change", function (change, data) {
                    changes.push(data);
                });
                runs(function () {
                    expect(pm.get("spaceUnits")).toBeUndefined();
                    filestorage.setPath(settingsFile.fullPath);
                });
                waitsFor(function () {
                    return changes.length > 0;
                });
                runs(function () {
                    expect(pm.get("spaceUnits")).toBe(92);
                    expect(changes).toEqual([{
                        ids: ["spaceUnits"]
                    }]);
                });
            });
        });
    });
});
