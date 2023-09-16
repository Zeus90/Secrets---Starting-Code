//jshint esversion:6
import 'dotenv/config';
import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import session from 'express-session';
import passport from 'passport';
import passportLocalMongoose from 'passport-local-mongoose';
import GoogleStrategy from 'passport-google-oauth20';
import findOrCreate from "mongoose-findorcreate";

const app = express();
const port = 3000;



app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));


//setting up the session
app.use(session({
    secret: 'this is a secret string',
    resave: false,
    saveUninitialized: false
}));

//initialize
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://127.0.0.1:27017/userDb");

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    googleId: String,
    secret: String
});

//plugin
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = mongoose.model("User", userSchema);

//strategy
passport.use(User.createStrategy());

//ser en deser //local
// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());
//all env
passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, {
        id: user.id
      });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });


//google strategy
passport.use(new GoogleStrategy.Strategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", (req, res) => {
    res.render("home.ejs");
});

app.get("/login", (req, res) => {
    res.render("login.ejs");
});

app.get("/register", (req, res)=>{
    res.render("register.ejs");
});


//make the call to google
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] })
);

//handle the response from google
app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect to main page.
    res.redirect("/secrets");
  });

app.get("/secrets", (req, res) =>{
    
    User.find({"secret": {$ne: null}}).then((foundSecrets) => {
        res.render("secrets.ejs", {allSecrets: foundSecrets});
    }).catch((err)=>{
        console.log(err);
    })
});

app.get("/submit", (req, res) =>{
    //check if loggedin
    if (req.isAuthenticated()) {
        res.render("submit.ejs");
    } else {
        res.redirect("/login");
    }
});

app.post("/submit", (req, res) => {
    //submitted text
    const secret = req.body.secret;
    User.findById(req.user.id).then((user) =>{
        if (user) {
            user.secret = secret;
            user.save();
            res.redirect("/secrets");
        } else {
            console.log("notFound");
        }
    }).catch((err)=>{
        console.log(err);
    });
});

app.get("/logout", (req, res) => {
    req.logOut((err)=>{
        if (err) {
            return next(err);
        }
        res.redirect("/");
    })
})

app.post("/register", (req, res) => {
    User.register({username: req.body.username}, req.body.password, (err, user) => {
        // console.log(user);
        if (err) {
            res.redirect("/register");
        } else {
            // console.log("hello from passport");
            passport.authenticate('local') (req, res, ()=> {
                res.redirect("/secrets");
            });
        }
    });
});


app.post("/login", (req, res) => {
    
    const user = new User ({
        username: req.body.username,
        password: req.body.password
    });

    req.logIn(user, (err)=>{
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req,res, ()=>{
                res.redirect("/secrets");
            });
        }
    });
});





app.listen((port), () =>{
    console.log(`app is running on port ${port}`);
});