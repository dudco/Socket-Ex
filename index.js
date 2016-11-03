var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var bodyParser = require('body-parser');
var randomString = require('randomstring');
var mongoose = require('mongoose');
var ObjectID = require('mongodb').ObjectID;
mongoose.connect('mongodb://localhost/nw');

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
//app.engine('html', require('ejs').renderFile);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

var UserSchema = new mongoose.Schema({
  id : {type : String},
  name : {type : String},
  talk : [{
    id : {type : String},
    token : {type : String}
  }]
})

var ChatSchema = new mongoose.Schema({
  id : {type : String},
  des : {type : Array}
})
Users = mongoose.model('users', UserSchema);
Chats = mongoose.model('chats', ChatSchema);

var users = []; //현재 접속중인 유저 저장 배열
var usernum = 0; //현재 접속중인 유저 수
http.listen(3000,()=>{
  console.log('listening on *:3000');
});

app.get('/', (req,res)=>{
  res.render('login',{ });
});

//토큰생성이랄까..
app.post('/chat', (req,res)=>{
  var a = req.param('a');
  var b = req.param('b');
  console.log(a + "   "+ b);

  var token = randomString.generate(13);
  /*파괴!*/
  // for(user of users){
  //   //find A
  //   if(user.name == a){
  //     if(user.talk[b] != undefined){
  //         console.log("exist!");
  //         res.send(user.talk[b])
  //         return;
  //     }else{
  //       user.talk[b] = token
  //       console.log(user);
  //     }
  //   }
  //
  //   //find B
  //   if(user.name == b){
  //     if(user.talk[a] != undefined){
  //       console.log("exist!");
  //       res.send(user.talk[a])
  //       return;
  //     }else{
  //       user.talk[a] = token
  //       console.log(user);
  //     }
  //     res.send(user.talk[a])
  //     break;
  //   }
  // }
  Users.find({'name' : {$in:[a,b]}}, (err, users)=>{
    if(users[0] && users[1]){
      console.log("aaaaaaaaaa",users[0].talk);

      //이미 토큰이 있는지 찾기
      if(users[0].talk != null){
        console.log('-------------------------\nstart to find');
        for(talk of users[0].talk){
          console.log("talk ----> ", talk);
          if(talk.id == b){
            console.log("exitst!", talk.token);
            res.send(talk.token)
            return;
          }
        }
      }
      console.log('-------------------------\nnot exitst! start to update!');
      //없으면 업뎃
      Users.findOneAndUpdate({'name': a}, {$push : {talk : { id : b, token : token}}}, {new : true},
                    (err, result) => {
                      if(err) console.log("DB Err");
                      console.log(result);
                    });
      Users.findOneAndUpdate({'name': b}, {$push : {talk : { id : a, token : token}}}, {new : true},
                    (err, result,n) => {
                      if(err) console.log("DB Err");
                      //res.send보내주세요
                      for(talk of result.talk){
                        console.log("talk ----> ", talk);
                        if(talk.id == a){
                          console.log("Update : ", talk.token);
                          res.send(talk.token)
                          return;
                        }
                      }
                    });
    }else{
      console.log("User Not Found!");
    }
  });
});

app.post('/login', (req, res)=>{
  var _name = req.param('name')
  var _user = new Users({
    id : randomString.generate(13),
    name : _name,
  });

  Users.findOne({name : _name}, (err, result) => {
      if(err) {
        console.log("DB Find Err");
        throw err;
      }
      if(result){
        //유저 존재
        console.log("exist!!");
        res.render('index', {
          user : result,
        });
      }else{
        //유저 없음 -> 새로만듦
        console.log("new...");
        _user.save((err)=>{
          if(err){
            console.log("DB Save Err");
            throw err
          }else{
            console.log('Save user and result : '+result);
            res.render('index', {
              user : _user,
            });
          }
        });
      }
  });
});

io.on('connection', function(socket){
  addedUser = false; //같은 클라에서 두개 추가되는 좆같은 오류 해결 존~나 오래걸림 시-발련
  var room_id; //현재 접속중 룸 아이디 default = main(메인에서는 다같이있어요)

  //add User
  socket.on('addUser', (data) => {
    if(addedUser) return;

    addedUser = true;
    console.log('a user connection : ' + data.name + '(' + data.id + ')');
    socket.user_id = data.id; //유저 아이디
    socket.user_name = data.name; //유저 이름
    console.log(socket.user_id);

    Users.findOne({ id : socket.user_id }, (err, result) => {
      if(err){
        console.log("DB Find Err");
        throw err;
      }

      if(result){
        console.log(result);
        users.push(result);//유저 배열 업뎃
        usernum++;
        io.emit('user state', users);
      }else {
        console.log("no user!");
      }
    })
  });

  //disconnet event
  socket.on('disconnect',() =>{
    // console.log(users.indexOf({ name : socket.username }));
    if(addedUser){
      for(var i in users){
        if(users[i].id == socket.user_id){
          users.splice(i, 1);
          break;
        }
      }
      console.log('user disconnect : ' + socket.user_name);
      if(--usernum < 0)
        usernum = 0;
      console.log(users);
      //유저 스태이트 업뎃
      io.emit('user state', users)
    }
  });

  //message event
  socket.on('chat message',function(data){
    var chat = new Chats({
      id : room_id,
    })



    Chats.findOne({id : room_id}, (err, result) => {
      if(err){
        console.log("DB err");
        throw err;
      }
      if(result){
        result.des.push(data.user + " : "+data.msg);
        result.save((err) => {
          if(err){
            console.log("DB err");
            throw err;
          }
        });
      }else{
        chat.des.push(data.user + " : "+data.msg);
        chat.save((err) => {
          if(err){
            console.log("DB save err");
            throw err;
          }else{
            console.log("Saved Okay");
          }
        });
      }
    });
    socket.emit('my message', data.user + " : "+data.msg )
    socket.in(room_id).emit('chat message',{
      msg : data.msg,
      name : data.user
    })
    console.log('msg : ' + data.msg + '   username : ' + data.user);
  });

  //change room
  socket.on('change room', (data) => {
    console.log(data);
    if(room_id)
      socket.leave(room_id)
    socket.join(data);
    room_id = data;
    Chats.findOne({id : data}, (err,result)=>{
      if(err){
        console.log("DB err");
        throw err;
      }
      if(result){
        socket.emit('loading message', result);
      }
    })
    console.log("join! :",room_id);
  })
});
