/*
DBi.js

Provides an interface to HTML 5 database objects

This software is released under the MIT License.

Copyright (c) 2011 Daniel J. Pinter, http://DataZombies.com/

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/
/*jslint devel: true, bitwise: true, regexp: true, sloppy: true, white: true, nomen: true, plusplus: true, maxerr: 50, indent: 2 */
(function () {
  // Constructor
  var DBi = function (settings) {
      var i, that = this;

      that.db = {};
      that.error = null;
      that.isInitialized = false;
      that.longName = null;
      that.maxSize = null;
      that.schema = {};
      that.schemaReady = false;
      that.shortName = null;
      that.version = null;
      that.settings = {
        debug: false,
        jsonAsynchronous: false,
        reset: false,
        schemaFile: null,
        schemaObject: null
      };

      // Apply user's settings
      for (i in settings) {
        if (settings.hasOwnProperty(i)){
          that.settings[i] = settings[i];
        }
      }
      that.initialization();
  },
  regexParseSQL = /(ALTER|CREATE|UPDATE)\s+(?:(?:UNIQUE\s+)?(INDEX|TABLE|TRIGGER|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?)?(?:(?:OR\s+(?:ABORT|FAIL|IGNORE|REPLACE|ROLLBACK)\s+))?(\w+)\s*(?:\((.*)\))?/i,
  regexTableConstraints = /,\s?((?:CHECK|FOREIGN\s+KEY|PRIMARY\s+KEY|UNIQUE).*)/i;

  // Prototype
  DBi.prototype = {
    // *****************************************************************************
    // _debug ()
    // If debug is true output a string to the console.
    // *****************************************************************************
    _debug: function (a) {
      if (this.settings.debug) {
        console.log(a);
      }
    },

    //****************************************************************************
    // _errorHandler ()
    // Sends error message to console regardless of value in debug.
    //****************************************************************************
    _errorHandler: function (a, b, c) {
      if (a !== null && typeof (b) === 'undefined') {
        if (-1 !== a.message.indexOf('callback did not return false')) {
          return true;
        }
        c = 'Transaction Error ' + a.code + ' - ' + a.message;
      } else if (b !== null) {
        c = 'SQL Error ' + b.code + ' - ' + b.message;
      }
      this.error = c;
      console.log('**********\n* ' + c + '\n**********');
      return true;
    },


    //****************************************************************************
    // initialization ()
    // Initialize, create & populate and/or upgrade a database in one transaction
    // with a JSON file or object.
    //****************************************************************************
    initialization: function () {
      var jDB, json, jStorage, that = this,

        // insert records
        populateTable = function (t, name, tbl) {
          var arrVal, i = tbl.records.length - 1, j, strCol, strVal;
          for (i; i >= 0; --i) {
            arrVal = [];
            strCol = '';
            strVal = '';
            for (j in tbl.records[i]) {
              if (tbl.records[i].hasOwnProperty(j)) {
                arrVal.push(tbl.records[i][j]);
                strCol += j + ', ';
                strVal += '?, ';
              }
            }
            t.executeSql(
              'INSERT INTO ' + name + ' (' + strCol.substr(0, strCol.lastIndexOf(', ')) + ') VALUES (' + strVal.substr(0, strVal.lastIndexOf(', ')) + ');',
              arrVal,
              null,
              that._errorHandler
            );
          }
          that._debug('Table ' + that.shortName + '.' +  name + ' populated.');
        },

        // create indices, tables, triggers and views
        executeDDL = function (t, type, name, obj) {
          var action, i, sql;
          if (typeof (obj.sql) !== 'undefined') {
            sql = obj.sql;
          } else {
            sql = 'CREATE ' + type + ' IF NOT EXISTS ' + obj.name + ' (';
            for (i in obj.columns) {
              if (obj.columns.hasOwnProperty(i)) {
                sql += i + ' ' + obj.columns[i] + ', ';
              }
            }
            sql = sql.substr(0, sql.lastIndexOf(', ')) + (typeof (obj.tableConstraint) !== 'undefined' ? ', ' + obj.tableConstraint : '') + ');';
          }
          action = sql.match(regexParseSQL)[1];
          t.executeSql(
            sql,
            [],
            function (t, r) {
              that._debug(action + ' ' + type + ' ' + that.shortName + '.' + name + '.');
              if (typeof (obj.records) !== 'undefined' && obj.records.length > 0) {
                populateTable(t, name, obj);
              }
            },
            that._errorHandler
          );
        },

        // remove objects from the database
        dropObject = function (t, type, name, tbl) {
          t.executeSql(
            'DROP ' + type + ' IF EXISTS ' + name + ';',
            [],
            function (t, r) {
              that._debug('DROP ' + type + ' ' + that.shortName + '.' + name + '.');
              if (typeof (tbl) !== 'undefined' && tbl !== null) {
                executeDDL(t, type, name, tbl);
              }
            },
            that._errorHandler
          );
        },

        // create localStorage and sessionStorage objects if they don't exist
        createStorages = function (dbSN, jStorage) {
          var newS = function (m, s, j) {
                var i, n;
                for (i in j) {
                  if (j.hasOwnProperty(i)) {
                    n = m + '_' + i;
                    if (!(n in s)) {
                      s[n] = j[i];
                      that._debug('Storage ' + n + ' added with value "' + j[i] + '".');
                    }
                  }
                }
              };
          if (typeof (jStorage) !== 'undefined') {
            newS(dbSN, localStorage, jStorage.local);
            newS(dbSN, sessionStorage, jStorage.session);
          }
        },

        // delete localStorage and sessionStorage objects
        deleteStorage = function (dbSN, jStorage) {
          var delS = function (n, s) {
                var i;
                for (i in s) {
                  if (s.hasOwnProperty(i)) {
                    if (i.substr(0, n.length + 1).toLowerCase() === n.toLowerCase() + '_') {
                      delete s[i];
                      that._debug('Storage ' + i + ' deleted.');
                    }
                  }
                }
              };
          delS(dbSN, localStorage);
          delS(dbSN, sessionStorage);
        },

        // open a database
        openDB = function (SN, V, LN, MS) {
          if (SN === null || SN === '' || LN === null || LN === '' || MS === null || MS === '') {
            that._errorHandler(null, null, 'Error - Database attributes error\n  shortName: ' + SN + '\n  longName: ' + LN + '\n  maxSize: ' + MS + '.');
            return false;
          }
          try {
            that.db = openDatabase(SN, '', LN, MS);
          } catch (err) {
            that._errorHandler(null, null, 'Error - Database failed to open. Unknown error ' + err + '.');
            return false;
          }
          if (typeof (that.db) !== 'undefined') {
            that.shortName = SN;
            that.version = that.db.version;
            that.longName = LN;
            that.maxSize = MS;
            that._debug('Database ' + that.shortName + ' opened.\n  version: ' + that.version + '\n  longName: ' + that.longName + '\n  maxSize: ' + that.maxSize + ' bytes (' + ~~ ((that.maxSize / 10488576 * 1000) + 0.5) / 1000 + ' MB)');
            return true;
          } else {
            that._errorHandler(null, null, 'Error - Failed to open the database.');
            return false;
          }
        },

        // called on the app's 1st run or when reset = true
        resetOrNewSchema = function (jDB, jStorage) {
          var exclusions = '', i, j, type = '';
          that._debug('reset or new.');
          deleteStorage(jDB.shortName, jStorage);
          createStorages(jDB.shortName, jStorage);
          for (i in jDB) {
            if (jDB.hasOwnProperty(i) && i !== 'upgrades') {
              type = (i === 'indices' ? 'index' : i.substr(0, i.length - 1));
              for (j in jDB[i]) {
                if (jDB[i].hasOwnProperty(j)) {
                  exclusions += ',"' + type + jDB[i][j].name + '"';
                }
              }
            }
          }
          that.db.transaction(
            function (t) {
              t.executeSql(
                'SELECT upper(type) type, name FROM sqlite_master WHERE type||name Not In("table__WebKitDatabaseInfoTable__"' + exclusions + ') AND name NOT LIKE "sqlite_%"',
                [],
                function (t, r) {
                  var i = r.rows.length - 1;
                  if (r.rows.length !== -1) {
                    for (i; i >= 0; --i) {
                      dropObject(t, r.rows.item(i).type, r.rows.item(i).name, null);
                    }
                  }
                },
                that._errorHandler
              );
            },
            that._errorHandler,
            function () {
              that.db.transaction(
                function (t) {
                  var i, getName = function (obj) {
                      var name, sql;
                      if (typeof (obj.sql) !== 'undefined') {
                        sql = obj.sql.replace(/\s{2,}/g, ' ');
                        name = obj.sql.match(regexParseSQL)[3];
                      } else {
                        name = obj.name;
                      }
                      return name;
                    };
                  for (i in jDB.tables) {
                    if (jDB.tables.hasOwnProperty(i)) {
                      dropObject(t, 'Table', getName(jDB.tables[i]), jDB.tables[i]);
                    }
                  }
                  for (i in jDB.indices) {
                    if (jDB.indices.hasOwnProperty(i)) {
                      dropObject(t, 'Index', getName(jDB.indices[i]), jDB.indices[i]);
                    }
                  }
                  for (i in jDB.triggers) {
                    if (jDB.triggers.hasOwnProperty(i)) {
                      dropObject(t, 'Trigger', getName(jDB.triggers[i]), jDB.triggers[i]);
                    }
                  }
                  for (i in jDB.views) {
                    if (jDB.views.hasOwnProperty(i)) {
                      dropObject(t, 'View', getName(jDB.views[i]), jDB.views[i]);
                    }
                  }
                },
                that._errorHandler,
                function () {
                  that.db.changeVersion(
                    that.db.version,
                    jDB.version,
                    function (t) {},      // callback
                    function (err) {},    // errorCallback
                    function () {         // successCallback
                      that.version = that.db.version;
                      that.isInitialized = true;
                      that._debug(that.shortName + ', version ' + that.version +', is initialized.');
                    }
                  );
                }
              );
            }
          );
        },

        // performs upgrades to database schema and records when the upgrades object is present in the JSON file
        upgradeSchema = function (jDB, jStorage) {
          // under construction
        },

        // load a JSON object or a JSON data file asynchronously/non-asynchronously depending on the value in jsonAsynchronous
        AE_35 = function (jsonObj, jsonURL) {
          var jsonData = new XMLHttpRequest(),
              jsonStatus = false,
              processJSONdata = function () {
                if (jsonStatus) {
                  if ('openDatabase' in window) {
                    jDB = jsonData.database;
                    jStorage = jsonData.storage;
                    if (openDB(jDB.shortName, jDB.version, jDB.longName, jDB.maxSize)) {
                      if (that.settings.reset || that.version === '') {
                        that.settings.reset = true;
                        resetOrNewSchema(jDB, jStorage);
                      } else {
                        if (jDB.version > that.version && that.version !== '') {
                          //upgradeSchema(jDB, jStorage);
                          // under construction
                        } else {
                          that.isInitialized = true;
                          that._debug('same version, no reset - just open db.');
                          that._debug(that.shortName + ', version ' + that.version +', is initialized.');
                        }
                      }
                    }
                  } else {
                    that._errorHandler(null, null, 'Error - Databases are not supported on this platform.');
                  }
                }
              },
              handleJSONresponse = function () {
                if (!jsonData || jsonData === null || jsonData.status !== 200) {
                  that._errorHandler(null, null, 'JSON Error ' + jsonData.status + ' - file "' + jsonURL + '" ' + jsonData.statusText + '.');
                } else {
                  that._debug('JSON file "' + jsonURL + '" loaded.');
                  try {
                    jsonData = JSON.parse(jsonData.responseText);
                    jsonStatus = true;
                  } catch (err) {
                    that._errorHandler(null, null, err);
                    jsonStatus = false;
                  }
                }
              };

          if(typeof (jsonURL) !== 'undefined' && jsonURL !== null) {
            jsonData.open("GET", jsonURL, that.settings.jsonAsynchronous);
            try {
              jsonData.send(null);
            } catch (err) {
              that._errorHandler(null, null, err);
              jsonData = null;
            }
            if (that.settings.jsonAsynchronous) {
              jsonData.onreadystatechange = function () {
                if (jsonData.readyState === 4) {
                  handleJSONresponse();
                  processJSONdata();
                }
              };
            } else {
              handleJSONresponse();
              processJSONdata();
            }
          } else {
            jsonData = jsonObj;
            jsonStatus = true;
            processJSONdata();
          }
        };

      if((typeof (that.settings.schemaFile) !== 'undefined' && that.settings.schemaFile !== null) ||
      (typeof (that.settings.schemaObject) !== 'undefined' && that.settings.schemaObject !== null)) {
        AE_35(that.settings.schemaObject, that.settings.schemaFile);
      } else {
        that._errorHandler(null, null, 'Error - schemaFile or schemaObject is not defined.');
      }
    },

    //****************************************************************************
    // outputSchema ()
    // Dump the localstorage, sessionStorage & database.
    // Based on "Abusing HTML 5 Structured Client-side Storage" by Alberto Trivero
    // (http://trivero.secdiscover.com/html5whitepaper.pdf)
    //****************************************************************************
    outputSchema: function () {
      var indices = [],
          json = {},
          ls,
          ss,
          tables = [],
          that = this,
          triggers = [],
          views = [],

          // gets localStorage and sessionStorage data
          getStorage = function (s) {
            var dbSN = that.shortName.length !== 0 ? that.shortName.toLowerCase() + '_' : '',
              i,
              storage = {isEmpty: true};
            for (i in s) {
              if (s.hasOwnProperty(i)) {
                if (i.substr(0, dbSN.length).toLowerCase() === dbSN) {
                  storage[i.substr(dbSN.length, i.length)] = s.getItem(i);
                  storage.isEmpty = false;
                }
              }
            }
            return storage;
          },

          // saves the database schema to schema
          outputJSON_Schema = function (json) {
            that.schema = json;
            that.schemaReady = true;
          };

      that.schemaReady = false;
      json.generationTimeStamp = new Date();
      json.userAgent = navigator.userAgent;

      // get sessionStorage and localStorage
      ls = getStorage(localStorage);
      ss = getStorage(sessionStorage);
      if (ls.isEmpty === false || ss.isEmpty === false) {
        json.storage = {};
        if (ls.isEmpty === false) {
          delete ls.isEmpty;
          json.storage.local = ls;
        }
        if (ss.isEmpty === false) {
          delete ss.isEmpty;
          json.storage.session = ss;
        }
      }
      // start pulling the schema if the database is open
      if ('openDatabase' in window) {
        if (that.maxSize !== 0 && that.db.version !== '') {
          json.database = {
            shortName: that.shortName,
            version: that.version,
            longName: that.longName,
            maxSize: that.maxSize
          };
          that.db.transaction(
            function (t) {
              t.executeSql(
                'SELECT sql FROM sqlite_master WHERE name!="__WebKitDatabaseInfoTable__" AND name NOT LIKE "sqlite_%" ORDER BY 1 DESC;',
                [],
                function (t, r) {
                  var i, sql, table = {},
                      dumpTable = function (t, table) {
                        // get all data from the selected table
                        t.executeSql(
                          'SELECT * FROM ' + table.name + ' ORDER BY 1 DESC;',
                          [],
                          function (t, r) {
                            var a, b, record = [],
                              records = [];
                            if (r.rows.length !== 0) {
                              for (a = r.rows.length - 1; a >= 0; --a) {
                                record = {};
                                for (b in r.rows.item(a)) {
                                  if (r.rows.item(a).hasOwnProperty(b)) {
                                    record[b] = r.rows.item(a)[b];
                                  }
                                }
                                records.push(record);
                              }
                              table.records = records;
                            }
                          },
                          that._errorHandler);
                      },
                      getColumns = function (sql) {
                        // extract columns from the sql
                        var columns = {},
                          i, temp = [];
                        for (i in sql) {
                          if (sql.hasOwnProperty(i)) {
                            temp = sql[i].match(/(\w+)\s+(.+)/);
                            columns[temp[1]] = temp[2];
                          }
                        }
                        return columns;
                      };

                    for (i = r.rows.length - 1; i >= 0; --i) {
                      sql = r.rows.item(i).sql.replace(/\s{2,}/g, ' ') + ';';
                      sql = sql.match(regexParseSQL);
                      sql[0] = r.rows.item(i).sql.replace(/\s{2,}/g, ' ') + ';';
                      if (typeof (sql[4]) !== 'undefined') {
                        if (sql[4].match(regexTableConstraints) !== null) {
                          sql[5] = sql[4].match(regexTableConstraints)[1];
                          sql[4] = sql[4].replace(sql[4].match(regexTableConstraints)[0], '');
                        }
                        sql[4] = sql[4].split(/,/);
                      }
                      switch (sql[2].toLowerCase()) {
                      case 'index':
                        indices.push({
                          name: sql[3],
                          sql: sql[0]
                        });
                        break;
                      case 'table':
                        table = {
                          name: sql[3],
                          sql: sql[0],
                          columns: ''
                        };
                        if (typeof (sql[5]) !== 'undefined' && typeof (sql[5]) !== 'null') {
                          table.tableConstraint = sql[5];
                        }
                        table.columns = getColumns(sql[4]);
                        dumpTable(t, table);
                        tables.push(table);
                        break;
                      case 'trigger':
                        triggers.push({
                          name: sql[3],
                          sql: sql[0]
                        });
                        break;
                      case 'view':
                        views.push({
                          name: sql[3],
                          sql: sql[0]
                        });
                        break;
                      }
                    }
                },
                that._errorHandler
              );
            },
            that._errorHandler,
            function () {
              if (tables.length !== 0) {
                json.database.tables = tables;
              }
              if (indices.length !== 0) {
                json.database.indices = indices;
              }
              if (triggers.length !== 0) {
                json.database.triggers = triggers;
              }
              if (views.length !== 0) {
                json.database.views = views;
              }
              outputJSON_Schema(json);
            }
          );
        } else {
          outputJSON_Schema(json);
        }
      } else {
        outputJSON_Schema(json);
      }
    }
  };
  window.DBi = DBi;
})();
/*

Database openDatabase(
  DOMString name,
  DOMString version,
  DOMString displayName,
  unsigned long estimatedSize,
  function (Database database) { // optional DatabaseCallback creationCallback
  }
);

database.transaction || database.readTransaction(
  function (SQLTransaction transaction) { // SQLTransactionCallback callback
  },
  function (SQLError error) { // optional SQLTransactionErrorCallback errorCallback
  },
  function () { // optional SQLVoidCallback successCallback
  }
);

database.changeVersion(
  DOMString oldVersion,
  DOMString newVersion,
  function (SQLTransaction transaction) { // optional SQLTransactionCallback callback
  },
  function (SQLError error) { // optional SQLTransactionErrorCallback errorCallback
  },
  function () { // optional SQLVoidCallback successCallback
  }
);

transaction.executeSql(
  DOMString sqlStatement,
  optional ObjectArray arguments,
  function (SQLTransaction transaction, SQLResultSet resultSet) { // optional SQLStatementCallback callback
  },
  function (SQLTransaction transaction, SQLError error) { // optional SQLStatementErrorCallback errorCallback
  }
);

*/