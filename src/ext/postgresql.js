var pg = require("pg");

var conString = "pg://postgres:postgres@localhost:5432/test";

var client = new pg.Client(conString);
client.connect();

this.create_table = function(sql){
  client.query(sql);
}

this.create_relationship = function(sql){
  client.query(sql);
}
