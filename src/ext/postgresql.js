var pg = require("pg");

var conString = "pg://postgres:toorroot@ranchosoft.com:5432/test";

var client = new pg.Client(conString);
client.connect();

this.exec_sql = function(sql){
  client.query(sql);
}
