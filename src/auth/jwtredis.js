var express     = require('express');
var app         = express();
var redis       = require('redis');
var bodyParser  = require('body-parser');
var morgan      = require('morgan');
var mongoose    = require('mongoose');

var config = require('./config');
var User   = require('./models/user');

var JWTRedisSession = require("jwt-redis-session");
var redisClient = redis.createClient({host:"138.197.51.117", port:"6379"});
var secret = config.secret;

app.use(JWTRedisSession({
	client: redisClient,
	secret: secret,
	keyspace: "sess:",
	maxAge: 3600,
	algorithm: "HS256",
	requestKey: "jwtSession",
	requestArg: "accessToken"
}));

// configuration =========
var port = process.env.PORT || 8080;
mongoose.connect(config.database);
app.set('superSecret', config.secret);

// use body parser to get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// use morgan to log requests to the console
app.use(morgan('dev'));

var apiRoutes = express.Router();

apiRoutes.post('/authenticate', function(req, res) {

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
        //var token = jwt.sign(user, app.get('superSecret'), { });
        req.jwtSession.user = user.toJSON();
    		// this will be attached to the JWT
    		var claims = {
    			iss: "Grapheno",
    			aud: "grapheno.io"
    		};
    		req.jwtSession.create(claims, function(error, token){
          res.json({
            success: true,
            message: 'Token delivered!',
            token: token
          });
    		});
      }
    }
  });
});

// route middleware to verify a token
apiRoutes.use(function(req, res, next) {


  var token = req.body.token || req.query.token || req.headers['x-access-token'];

  console.log("Request JWT session data: ",
		req.jwtSession.id,
		req.jwtSession.claims,
		req.jwtSession.jwt
	);

  console.log(req.jwtSession.toJSON());


  res.json(req.jwtSession.toJSON());

 /*
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
  */
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
