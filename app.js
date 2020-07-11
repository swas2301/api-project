const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const request = require("request");
const sgMail = require('@sendgrid/mail');
const mongoose = require("mongoose");
const multer = require("multer");
const GridFsStorage = require("multer-gridfs-storage");
const path = require("path");
const crypto = require('crypto');
const Grid = require('gridfs-stream');
const GridStore= require('mongoose-gridstore');
const fs = require('fs');

const SENDGRID_API_KEY = 'your api key';
sgMail.setApiKey(SENDGRID_API_KEY);

const app = express();
app.set('view engine', 'ejs');


var key = Math.floor(1000 + Math.random() * 9000);
var key2 = key.toString();
console.log(key2);
app.use(bodyParser.urlencoded({extended: true}));

app.use(express.static("public"));

mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser: true, useUnifiedTopology: true});
const conn = mongoose.createConnection("mongodb://localhost:27017/mongouploads", {useNewUrlParser: true, useUnifiedTopology: true});
let gfs;
conn.once('open', () => {
  // Init stream
  gfs = new mongoose.mongo.GridFSBucket(conn.db, {
   bucketName: "uploads"
 });

});

const storage = new GridFsStorage({
  url: "mongodb://localhost:27017/mongouploads",
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString('hex') + path.extname(file.originalname);
        console.log(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: 'uploads'
        };
        resolve(fileInfo);
      });
    });
  }

});
const upload = multer({ storage });


const userSchema = {
  email: String,
  password: String

};

const User = new mongoose.model("User", userSchema);

app.get("/", function(req, res){

    res.render("login");
});

app.get("/signup", function(req, res){
  res.render("signup");
});

app.get("/forgot-password", function(req, res){
  res.render("forgot-password");
});


app.get("/api/media", function(req, res){

  if(!gfs) {
    console.log("some error occured, check connection to db");
    res.send("some error occured, check connection to db");
    process.exit(0);
  }
  gfs.find().toArray((err, files) => {
    // check if files
    if (!files || files.length === 0) {
      return res.render("media", {
        files: false
      });
    } else {
      const f = files
        .map(file => {
          if (
            file.contentType === "video/mp4"

          ) {
            //console.log(file);
            file.isvideo = true;
          } else {
            file.isvideo = false;
          }
          return file;
        })
        .sort((a, b) => {
          return (
            new Date(b["uploadDate"]).getTime() -
            new Date(a["uploadDate"]).getTime()
          );
        });

      return res.render("media", {
        files: f
      });
    }
  });
});

app.get('/files', (req, res) => {
  gfs.find().toArray((err, files) => {
    // Check if files
    if (!files || files.length === 0) {
      return res.status(404).json({
        err: 'No files exist'
      });
    }

    // Files exist
    return res.json(files);
  });
});

app.get('/video/:filename', (req, res) => {
  gfs.find({ filename: req.params.filename }).toArray((err, files) => {

    // Check if file
    if (!files[0] || files.length === 0) {
      return res.status(404).json({
        err: 'No file exists'
      });
    }


    if (files[0].contentType === "video/mp4") {
      console.log(files[0].filename);



      var readstream = gfs.createReadStream(req.params.filename);
      readstream.on('error', function (err) {
  console.log('An error occurred!', err);
  throw err;
});
      readstream.pipe(res);
    }
    else {
      res.status(404).json({
        err: 'Not an video'
      });
    }
  });

});

app.get("/api/media/upload", function(req, res){
  res.render("upload");
});



app.post("/login", function(req, res){
  username = req.body.username;
  const password = req.body.password;

  User.findOne({email: username}, function(err, foundUser){
    if(err) {
      console.log(err);
    } else {
      if(foundUser) {
        if(foundUser.password === password) {
          res.redirect("/api/media/upload");
        } else {
          res.render("failed");
        }
      } else{
        res.render("failed");
      }
    }
  });
});

app.post("/signup", function(req, res){
  const newUser = new User({
    email: req.body.username,
    password: req.body.password
  });
newUser.save(function(err){
  if(err) {
    console.log(err);
  }
  else {
    res.render("login");
  }
});
});

app.post("/forgot-password", function(req, res){

    var email = req.body.username;

    const msg = {
      to: email,
      from: 'swastikak231@gmail.com',
      subject: 'Password reset code',
      text: "Your password reset code is "+key2

    }

    sgMail.send(msg);
res.render("set-password");
  });

app.post("/set-password", function(req, res){

var email = req.body.username;
  const code = req.body.code;
  const newpassword = req.body.newpassword;

  User.findOne({email: email}, function(err, foundUser){
    if(err) {
      console.log(err);
    } else {
      if(foundUser) {
        User.updateOne({email: email}, {$set: {password: newpassword}}, function (err, docs) {
    if (err){
        console.log(err);
    }
    else{
        console.log("Updated Docs : ", docs);
    }});
        res.render("login");
      } else{
        res.render("failed");
      }
    }
  });
});

app.post("/api/media/upload",upload.single('file'),(req, res) => {

res.redirect("/api/media");

});



app.listen(3000, function() {
  console.log("Server started on port 3000");
});
