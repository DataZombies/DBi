# DataZombie's DBi v0.1
(pronounced Debi)

__DBi handles all the work of creating an iOS or Safari WebSQL database and manages local/session storages.__

DBi creates, tables, indices, triggers & views and populates the tables all from a single JSON file that's outputted from DBi.

[Google Group](https://groups.google.com/group/datazombies-dbi)

If you find that DBi has been a benefit to you project please donate to the cause via PayPal (http://tinyurl.com/2fpmx27). Any amount is appreciated.

## Step 1 - Include the Script Tag in Your HTML5 Markup

``` html
<script src="./DBi.js"></script>
```

## Step 2 - Define the Database Schema
All DBi JSON schema files has one required object, database, one optional object, storage, and two optional properties, generationTimeStamp and userAgent. generationTimeStamp and userAgent are generated during schema output.

``` js
{"generationTimeStamp":"",
 "userAgent":"",
 "storage": {},
 "database": {}
}
```

The database object is subdivided into five required attributes that define the database: shortName, version, longName, maxSize. The only required array is tables. The optional arrays define the database's indices, triggers, views and upgrades. Upgrades will be implemented in a future release.

``` js
  "database":
    {"shortName":"",
     "version":"",
     "longName":"",
     "maxSize":"",
     "tables":[],
     "indices":[],
     "triggers":[],
     "views":[],
     "upgrades":[]
  }
```

The minimum you need to get started is the required database information. All other development and modifications can be done in the web browser's database interface (Safari Web Inspector) and outputted for implementation. More on output later.

The minimum JSON schema would look like this:

``` js
  {"database":
    {"shortName":"dbCT",
     "version":"1.0",
     "longName":"Chess Tournament Database",
     "maxSize":"1048576"}}
```
Database informtion with one table:

``` js
  {"database":
    {"shortName":"dbCT",
     "version":"1.0",
     "longName":"Chess Tournament Database",
     "maxSize":"1048576"},
     "tables":[
        {"name":"Games",
         "sql":"CREATE TABLE Games (id INTEGER PRIMARY KEY AUTOINCREMENT,gamename TEXT,weight REAL DEFAULT .10 CHECK (weight<=1));"},
        {"name":"Players",
         "columns":
            {"id":"INTEGER PRIMARY KEY AUTOINCREMENT",
             "fname":"TEXT NOT NULL",
             "lname":"TEXT NOT NULL"},
         "records":[
            {"id":1, "fname":"Bobby", "lname":"Fisher"},
            {"id":2, "fname":"Bart", "lname":"Simpsen"},
            {"id":3, "fname":"Garry", "lname":"Kasparov"}]}]
```

You can see that tables can be created by either putting the DDL in the sql attribute (the Games table) or define each column (the Players table). See the schema files in this repo for more examples.

## Step 3 - Creating the Database
In your JavaScript code initialize your database variable.

``` js
dbWebApp = new DBi({
  debug: true,
  jsonAsynchronous: false,
  reset: false,
  schemaFile: './schema_1stRun/schema.json'
});
```

__debug__: verbose and helpful messages sent to the console. _Optional. Default false_

__jsonAsynchronous__: load the JSON schema file asynchronously. _Optional. Default false_

__reset__: delete all storages and dump all database objects; a fresh start. _Optional. Default false_

__schemaFile__: The path to the JSON schema file.

__schemaObject__: A JSON object.

The database initlization must have a __schemaFile__ or a __schemaObject__.

From here you can use all the transaction and executeSQL for your development.

### Step 3a - Outputting the Database Schema
In the console type...

``` js
dbWebApp.outputSchema();
```

Your database schema will be stored in dbWebApp.schema. See index.html for functions that output the schema to the browser window.


DBi is provided with the MIT license. Please submit an issue if you find any bugs that need to be squished or features you would like to see. Feel free to fork this repo. Please submit pull requests for any fixes, enhancements or new features.

### Change Log
2011-11-24 v0.2 Add the ability to pass a JSON object to DBi instead of a JSON file URL; improved index.html's JSON output function;

2011-11-02 v0.1 Initial (alpha-betaish) release.