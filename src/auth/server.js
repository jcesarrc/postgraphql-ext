var express     = require('express');
var app         = express();
var bodyParser  = require('body-parser');
var morgan      = require('morgan');
var mongoose    = require('mongoose');

var jwt    = require('jsonwebtoken');
var config = require('./config');
var User   = require('./models/user');


var redis = require("redis"),
    client = redis.createClient({host:"138.197.51.117", port:"8080"});

    client.on("error", function (err) {
      console.log("Error " + err);
    });

    client.set("foo_rand", "OK", redis.print);

    client.get("foo_rand", function (err, reply) {
        console.log(reply.toString());
    });

// configuration =========
var port = process.env.PORT || 8080;
mongoose.connect(config.database);
app.set('superSecret', config.secret);

// use body parser to get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// use morgan to log requests to the console
app.use(morgan('dev'));

// routes ================

/*
var JWTRedisSession = require("jwt-redis-session"),
	express = require("express"),
	redis = client;

var redisClient = client,
	secret = "generateSecretKeySomehow",
	app = express();

app.use(JWTRedisSession({
	client: redisClient,
	secret: secret,
	keyspace: "sess:",
	maxAge: 86400,
	algorithm: "HS256",
	requestKey: "jwtSession",
	requestArg: "jwtToken"
}));
*/
var apiRoutes = express.Router();

apiRoutes.post('/authenticate', function(req, res) {
  // find the user
  User.findOne({
    name: req.body.name
  }, function(err, user) {

    if (err) throw err;

    if (!user) {
      res.json({ success: false, message: 'Authentication failed. User not found.' });
    } else if (user) {

      if (user.password != req.body.password) {
        res.json({ success: false, message: 'Authentication failed. Wrong password.' });
      } else {
        var token = jwt.sign(user, app.get('superSecret'), { });
        res.json({
          success: true,
          message: 'Token delivered!',
          token: token
        });
      }
    }
  });
});

// route middleware to verify a token
apiRoutes.use(function(req, res, next) {


  var token = req.body.token || req.query.token || req.headers['x-access-token'];


  if (token) {
    jwt.verify(token, app.get('superSecret'), function(err, decoded) {
      if (err) {
        return res.json({ success: false, message: 'Failed to authenticate token.' });
      } else {
        // save to request for use in other routes
        req.decoded = decoded;
        next();
      }
    });

  } else {


    return res.status(403).send({
        success: false,
        message: 'No token provided.'
    });

  }
});

apiRoutes.get('/users', function(req, res) {
  User.find({}, function(err, users) {
    res.json(users);
  });
});

app.use('/api', apiRoutes);


// start the server ======
app.listen(port);
console.log('Server started at http://localhost:' + port);
