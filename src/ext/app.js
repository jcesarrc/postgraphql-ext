var express = require('express')
var bodyParser = require('body-parser')
var pg = require('./postgresql');

var http = require('http');
var fs = require('fs');

var varStack = [];

var primitives = {
  join_o: function(args){
    return join_v(args);
  },
  prodscalar_o: function(args){
    return prodscalar_v(args);
  },
  select_o: function(args){
    return select_v(args);
  },
  prod_inner_o: function(args){
    return prod_inner_v(args);
  }
};

var app = express()
var REMOTE_HOST = '173.255.219.36';
var REMOTE_PORT = '4200';

app.use(bodyParser.json())

app.post('/create-table', function (req, res) {
  request = req.body;
  res.send(createTable(request));
});
app.post('/create-relationship', function (req, res) {
  request = req.body;
  res.send(createRelationship(request));
});
app.post('/create-function', function (req, res) {
  request = req.body;
  res.send(createFunction(request));
});
app.post('/drop-table', function (req, res) {
  request = req.body;
  res.send(dropTable(request));
});

app.post('/json2gql', function (req, res) {
  request = req.body;
  res.send(createGQLQuery(request));
});

app.post('/json2query', function (req, res) {
  request = req.body;
  res.send(json2query(request));
});

app.post('/json2mutation', function (req, res) {
  request = req.body;
  res.send(json2mutation(request));
});

app.post('/function', function (req, res) {
  request = req.body;
  res.send(metaFunction(request));
});

if (!Array.prototype.joinWith) {
    +function () {
        Array.prototype.joinWith = function(that, by, select, omit) {
            var together = [], length = 0;
            if (select) select.map(function(x){select[x] = 1;});
            function fields(it) {
                var f = {}, k;
                for (k in it) {
                    if (!select) { f[k] = 1; continue; }
                    if (omit ? !select[k] : select[k]) f[k] = 1;
                }
                return f;
            }
            function add(it) {
                var pkey = '.'+it[by], pobj = {};
                if (!together[pkey]) together[pkey] = pobj,
                    together[length++] = pobj;
                pobj = together[pkey];
                for (var k in fields(it))
                    pobj[k] = it[k];
            }
            this.map(add);
            that.map(add);

            var output = [];
            for (var key in together) {
                output.push(together[key]);
            }
            return output;
        }
    }();
}

function prodscalar(list, field, scalar, result_field){

  var cpList = [];
  var output = [];
  for (var key in list) {
      if(list[key].id==1 || list[key].id==2 || list[key].id==3){
          var row = list[key];
          row[result_field] = list[key][field] * scalar;
          cpList.push(row);
      }
  }
  return cpList;
}

function prod_inner(myDocument, field1, field2, result_field){

  var cpList = [];
  var output = [];
  for (var key in myDocument) {
      if(myDocument[key].id==1 || myDocument[key].id==2 || myDocument[key].id==3 || myDocument[key].id==4 || myDocument[key].id==5 || myDocument[key].id==6){
          var row = myDocument[key];
          row[result_field] = myDocument[key][field1] * myDocument[key][field2];
          cpList.push(row);
      }
  }
  return cpList;
}



function select(attributes, myDocument){
  var theDocument = JSON.parse(JSON.stringify(myDocument));;
  theDocument.forEach(function(currentItem, index, arr){
    Object.keys(currentItem).forEach(function(currentKey, idx, a){
      if(!isInArray(currentKey, attributes)){
        delete currentItem[currentKey];
      }
    });
  });
  return theDocument;
}

function sumscalar(list, field, scalar, result_field){
  var cpList = [];
  var output = [];
  for (var key in list) {
      if(list[key].id==1 || list[key].id==2 || list[key].id==3){
          var row = list[key];
          row[result_field] = list[key][field] * scalar;
          cpList.push(row);
      }
  }
  return cpList;
}

function isInArray(value, array) {
  return array.indexOf(value) > -1;
}

function sum(list){
  var total = 0;
  for(var i in list) { total += list[i]; }
  return total;
}

function contar(list){
  return list.size();
}

function join(a, b, a_field, b_field){
  var all = a.joinWith(b, 'id');
  return all;
}

function join_v(args){
  return join(args[0], args[1], args[2], args[3]);
}

function prodscalar_v(args){
  return prodscalar(args[0], args[1], args[2], args[3]);
}

function prod_inner_v(args){
  return prod_inner(args[0], args[1], args[2], args[3]);
}

function select_v(args){
  return select(args[0], args[1]);
}

function createTable(request) {
  var sql = "CREATE TABLE " + request.type + "(";
  var attrs = request.attributes;
  for (var i = 0, len = attrs.length; i < len; i++) {
    var attr = attrs[i];
    sql += attr.name;
    sql += " ";
    if(attr.type=="TIMESTAMP") sql += " TIMESTAMP DEFAULT NOW()";
    else sql += attr.type;
    if(attr.pk!=null && attr.pk) sql += " PRIMARY KEY";
    if(attr.notnull) sql += " NOT NULL";
    if(i+1 < len) sql += ", ";
  }
  sql += ")";
  pg.exec_sql(sql);
  for (var i = 0, len = attrs.length; i < len; i++) {
    var attr = attrs[i];
    functionsForAll(request.type, attr.name, attr.type);
  }
  return sql;
}

function createRelationship(request) {
  var from = request.from;
  var to = request.to;
  var sql = "";
  if(request.cardinality=="ONE_TO_MANY"){
    to = request.from;
    from = request.to;
    var new_column = "id_" + to;
    var sql_alter = "ALTER TABLE " + from + " ADD COLUMN " + new_column + " INT NULL";
    pg.exec_sql(sql_alter);
    sql += "ALTER TABLE " + from;
    sql += " ADD CONSTRAINT " + from + "_" + to + "_fk";
    sql += " FOREIGN KEY (" + new_column + ") REFERENCES " + to + " (id)";
    pg.exec_sql(sql);
    return sql;
  }
}

function createFunction(request){

  var sql = "CREATE FUNCTION " + request.name + "(";
  var params = request.params;
  for (var i = 0, len = params.length; i < len; i++) {
    sql += params[i].name + " " + params[i].type;
  }
  sql += ") RETURNS";

  var retorno = request.returns;
  if(retorno.isSet) sql += " SETOF";
  sql += " " + retorno.type;
  sql += " as $$ ";

  sql += request.implementation.command;

  sql += " $$ language sql stable;";
  pg.exec_sql(sql);
  return sql;
}

function createContainsFunction(table, attr, type){

  var sql = "CREATE FUNCTION search" + capitalizeFirstLetter(table) + "By"
  + capitalizeFirstLetter(attr) + "(arg TEXT) RETURNS";
  sql += " SETOF";
  sql += " " + table;
  sql += " as $$ ";
  sql += "SELECT * FROM " + table + " WHERE " + attr + " ILIKE ('%'|| arg ||'%')";
  sql += " $$ language sql stable;";
  pg.exec_sql(sql);
  console.log(sql);
  return sql;
}

function createGreaterThanFunction(table, attr, type){
  var sql = "CREATE FUNCTION search" + capitalizeFirstLetter(table) + "By"
  + capitalizeFirstLetter(attr) + "GreaterThan(arg INT) RETURNS";
  sql += " SETOF";
  sql += " " + table;
  sql += " as $$ ";
  sql += "SELECT * FROM " + table + " WHERE " + attr + " >= arg";
  sql += " $$ language sql stable;";
  pg.exec_sql(sql);
  console.log(sql);
  return sql;
}

function createLesserThanFunction(table, attr, type){
  var sql = "CREATE FUNCTION search" + capitalizeFirstLetter(table) + "By"
  + capitalizeFirstLetter(attr) + "LesserThan(arg INT) RETURNS";
  sql += " SETOF";
  sql += " " + table;
  sql += " as $$ ";
  sql += "SELECT * FROM " + table + " WHERE " + attr + " <= arg";
  sql += " $$ language sql stable;";
  pg.exec_sql(sql);
  console.log(sql);
  return sql;
}

function createBetweenFunction(table, attr, type){
  var sql = "CREATE FUNCTION search" + capitalizeFirstLetter(table) + "By"
  + capitalizeFirstLetter(attr) + "Between(arg1 INT, arg2 INT) RETURNS";
  sql += " SETOF";
  sql += " " + table;
  sql += " as $$ ";
  sql += "SELECT * FROM " + table + " WHERE " + attr + " BETWEEN arg1 AND arg2";
  sql += " $$ language sql stable;";
  pg.exec_sql(sql);
  console.log(sql);
  return sql;
}

function dropTable(request) {
  var sql = "DROP TABLE " + request.name;
  pg.exec_sql(sql);
  return sql;
}

function functionsForAll(table, attr, type){
  if(type.startsWith("VARCHAR")){
    createContainsFunction(table, attr, type);
  }else if(type.startsWith("INT")){
    createLesserThanFunction(table, attr, type);
    createGreaterThanFunction(table, attr, type);
    createBetweenFunction(table, attr, type);
  }
}

function capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}


function parseAndQueryEntitiesFromJSON(obj){
  var entities = [];
  var result = Object.keys(obj).map(function (k) {
    if(isEntity(k))
      entities.push(k);
  });
  return entities;
}

function isEntity(e){
  return true;
  var gqlquery = "{__type(name: \"" + e + "\" ){name}}";
  var obj = executeQuery(e);
  var result = Object.keys(obj).map(function (k) {
    if(k=="name" && obj[k]!=null){
      return true;
    }
  });
  return false;
}

function createGQLQuery(obj) {
  var result = Object.keys(obj).map(function (k) {
    var query = "" + k;
    var element = obj[k];
    if (element) {
      if (element.aliasFor) {
        query = k + ":" + element.aliasFor;
      }
      if (element.fragment) {
        query = "fragment " + k + " on " + element.fragment;
      }
      if (element.args) {
        var args = Object.keys(element.args).map(function (argKey) {
          var argVar = "",
              processed = false;
          if (element.processArgs) {
            if (element.processArgs[argKey]) {
              argVar = element.processArgs[argKey](element.args[argKey]);
              processed = true;
            }
          }
          if (!processed) {
            if (typeof(element.args[argKey]) === "object") {
              argVar = JSON.stringify(element.args[argKey]).replace(/\"([^(\")"]+)\":/g, "$1:");
            } else if(typeof(element.args[argKey]) !== "number" && isBigNumber(element.args[argKey])){
              str = element.args[argKey].replace(/"/g,"");
              argVar = str;
            } else if(typeof(element.args[argKey]) === "number"){
              argVar = element.args[argKey];
            } else {
              argVar = "\"" + element.args[argKey] + "\"";
            }
          }
          return argKey + ":" + argVar;
        }).join();
        query = query + "(" + args + ")";
      }
      if (element.fields) {
        var fields = createGQLQuery(element.fields);
        query = "" + query + fields;
      }
    }
    return "" + query;
  }).join();
  return "{" + result + "}";
}


function isBigNumber(number){
  console.log(number);
  var format = /^\d+$/;
  return number.match(format);
}

function json2query(request){
  var sujeto = request._author;
  delete request._author;
  var data = createGQLQuery(request);
  var entities = parseAndQueryEntitiesFromJSON(request);
  console.log("-----------------------------------");
  console.log("Entidades encontradas en el request");
  console.log(entities);
  if(acl(sujeto,entities,"QUERY"))
    executeQuery(data);
    //return "Success!! Operation allowed";
  else return "Operation denied over the requested resource";
}

function executeQuery(data){
  var httpOptions = {
  host: REMOTE_HOST,
  port: REMOTE_PORT,
  path: '/query',
  method: 'POST',
  headers: {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': data.length
  }};
  console.log(httpOptions);
  var msg = '';
  var req = http.request(httpOptions, function(res) {

    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      msg += chunk;
    });
    res.on('end', function() {
      console.log(JSON.parse(msg));
    });
  });

  req.write(data);
  req.end();

  return msg;
}

function executeMutation(data){
  var httpOptions = {
  host: REMOTE_HOST,
  port: REMOTE_PORT,
  path: '/insertorupdate',
  method: 'POST',
  headers: {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': data.length
  }};

  var msg = '';
  var req = http.request(httpOptions, function(res) {

    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      msg += chunk;
    });
    res.on('end', function() {
      console.log(JSON.parse(msg));
    });
  });

  req.write(data);
  req.end();

  return msg;
}

function json2mutation(myjson){
  var entities = [ myjson.Subject ];
  var sujeto = myjson._author;
  var data = JSON.stringify(myjson);
  console.log(entities);
  if(acl(sujeto,entities,"CREATE")){
    //return "Success!! Allowed operation";
    executeMutation(data);
  }else{
    return "Error: access not granted to modify resource";
  }
}

function acl(sujeto, resources, action){
  console.log("----------------------------------");
  console.log("Subject: " + sujeto);
  console.log("Resources: " + resources);
  console.log("Action: " + action);
  var allow = false;
  var acl = JSON.parse(fs.readFileSync('acl.json', 'utf8'));
  if(acl.resources){
    acl.resources.forEach(function(currentValue, index, array){
      console.log(currentValue.name);
      if(resources.indexOf(currentValue.name) > -1){
        currentValue.subjects.forEach(function(subject, indx, arry){
          if(subject.name == sujeto){
            console.log(subject.actions.indexOf(action));
            if(subject.actions.indexOf(action) > -1){
              allow = true;
            }
          }
        });
      }
    });
  }
  return allow;
}


function metaFunction(fnName, params){
  if(fnName.length > 0){
    var str = fnName.toLowerCase()+"_o";
    return primitives[str](params);
  }

  /*
  var newfnName = fnName.toLowerCase()+"_v";
  console.log(this);
  [newfnName](params);
  */
}

function queryVariableInStack(varName){
  for(var i in varStack){
    if(varStack[i].name == varName){
      return varStack[i].content;
    }
  }
}

function analyzeAttributes(attrs){
  for(var i in attrs){
    if (typeof attrs[i] === 'string' || attrs[i] instanceof String){
      if(attrs[i].startsWith('#')){
        attrs[i] = varStack[attrs[i].substring(1)];
      }
    }
  }
  return attrs;
}

function executeOperationStack(stack){
    for(var i in stack){
      var newAttrs = analyzeAttributes(stack[i].attributes);
      //console.log(varStack);
      varStack[stack[i].answer] = metaFunction(stack[i].name, newAttrs);
      //metaFunction(stack[i].name, analyzeAttributes(stack[i].attributes));
      /*
      if(stack[i].name == 'JOIN'){
        var newAttrs = analyzeAttributes(stack[i].attributes);
        varStack[stack[i].answer] = join_v(newAttrs);
      }
      if(stack[i].name == 'PRODSCALAR'){
        var newAttrs = analyzeAttributes(stack[i].attributes);
        varStack[stack[i].answer] = prodscalar_v(newAttrs);
      }
      if(stack[i].name == 'TOTALIZEBYATTR'){
        var newAttrs = analyzeAttributes(stack[i].attributes);
        varStack[stack[i].answer] = sumByAttr(newAttrs);
      }
      */
    }
}

app.listen(3000, function () {

/*
  var usuarios = [{ id: 1, name: 'Julio' },
              { id: 2, name: 'Hernan' }];

  var pedidos = [{ idpedido: 1, id: 1 },
              { idpedido: 2, id: 2 }];

  var items = [
    {iditem: 11, id: 1, nombre: 'Amazon Kindle', cost: 300 },
    {iditem: 22, id: 1, nombre: 'Macbook Pro', cost: 2900 },
    {iditem: 23, id: 1, nombre: 'Macbook Pro', cost: 2900 },
    {iditem: 34, id: 2, nombre: 'Maleta Nueva', cost: 100 },
    {iditem: 47, id: 2, nombre: 'Caja de lapices', cost: 10 },
    {iditem: 59, id: 2, nombre: 'Clips', cost: 8 }
];

  var operation_stack = [{
    name: 'JOIN',
    attributes: [ pedidos, items, 'id', 'idpedido' ],
    answer: 'pedidos_items'
  },{
    name: 'JOIN',
    attributes: [ usuarios, '#pedidos_items', 'id', 'idpedido' ],
    answer: 'all_merge'
  },{
    name: 'PRODSCALAR',
    attributes: [ '#all_merge', 'cost', 1.19, 'iva' ],
    answer: 'total'
  },{
    name: 'SELECT',
    attributes: [ ["iditem","nombre","iva"], '#total'],
    answer: 'final'
  }];

  executeOperationStack(operation_stack);

  console.log("Valor con IVA");
  console.log("---------------");
  console.log(varStack['total']);
  console.log(varStack['final']);

*/

/* ------------------------------------------- */


  var personas = [
            { id: 1, name: 'Julio' },
            { id: 2, name: 'Hernan' },
            { id: 3, name: 'Daniel' },
            { id: 4, name: 'Andres' },
            { id: 5, name: 'Moises' }
          ];

  var horas = [
            { id: 1, horas: 40 },
            { id: 2, horas: 80 },
            { id: 3, horas: 40 },
            { id: 4, horas: 90 },
            { id: 5, horas: 80 },
            { id: 6, horas: 50 }
          ];

  var nomina = [
        { id: 1, tipo: "ASESOR", costo_hora: 25000 },
        { id: 2, tipo: "DEVELOPER", costo_hora: 30000 },
        { id: 3, tipo: "ARQUITECTO", costo_hora: 50000 },
        { id: 4, tipo: "DEVELOPER", costo_hora: 30000 },
        { id: 5, tipo: "DEVELOPER", costo_hora: 30000 },
  ];


  var operation_stack = [{
    name: 'JOIN',
    attributes: [ personas, horas, 'id', 'id' ],
    answer: 'personas_horas'
  },{
    name: 'JOIN',
    attributes: [ '#personas_horas', nomina, 'id', 'id' ],
    answer: 'personas_horas_nomina'
  },
  { name: 'PROD_INNER',
    attributes: [ '#personas_horas_nomina', 'horas', 'costo_hora', 'subtotal'],
    answer: 'all'
  },{
    name: 'PRODSCALAR',
    attributes: [ '#all', 'subtotal', 1.10, 'salario_bruto' ],
    answer: 'bruto'
  },{
    name: 'SELECT',
    attributes: [ [ "name", "horas", "tipo", "subtotal", "salario_bruto" ], '#bruto' ],
    answer: 'total'
  }];

  //select_v(["iditem","nombre"], items);
  executeOperationStack(operation_stack);

  console.log("Totalizador");
  console.log("---------------");
  console.log(varStack['total']);

  console.log('Listening on port 3000')
});
