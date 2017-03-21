var express = require('express')
var bodyParser = require('body-parser')
var pg = require('./postgresql');

var app = express()

app.use(bodyParser.json())

app.post('/create-table', function (req, res) {
  request = req.body;
  res.send(createTable(request));
});
app.post('/create-relationship', function (req, res) {
  request = req.body;
  res.send(createRelationship(request));
});

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
  pg.create_table(sql);
  return sql;
}

function createRelationship(request) {
  var from = request.from;
  var to = request.to;
  var sql = "";
  if(request.cardinality=="ONE_TO_MANY"){
    to = request.from;
    from = request.to;
    sql += "ALTER TABLE " + from;
    sql += " ADD CONSTRAINT " + from + "_" + to + "_fk";
    sql += " FOREIGN KEY (id) REFERENCES " + from + " (id)";
    pg.create_relationship(sql);
    return sql;
  }
}

app.listen(3000, function () {
  console.log('Listening on port 3000')
});
