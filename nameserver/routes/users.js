var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var md5 = require('md5');

var connection = mysql.createConnection({
	host : 'localhost',
	user : 'user01',
	password: '1234',
	database: 'test'
});

router.post('/', function (req, res, next) {
	if(!req.body.id){
				res.send('<script type="text/javascript">alert("input id");location.replace("/users/register");</script>');
	} else if(!req.body.username){
				res.send('<script type="text/javascript">alert("input username");location.replace("/users/register");</script>');
	} else if(!req.body.password){
				res.send('<script type="text/javascript">alert("input password");location.replace("/users/register");</script>');
	} else {
		req.body.password = md5(req.param('password'));
	
		connection.query('select * from users where id = ?', req.body.id, function (error, results) {
			if (error) {
				console.log(error.message);
			} else {
				if (results.length > 0) {
					res.send('<script type="text/javascript">alert("이미 존재하는 아이디");location.replace("/users/register");</script>');
				} else {
					connection.query('insert into users set ?', req.body, function (error) {
						if (error) {
							console.log(error.message);
						} else {	
							res.send('<script type="text/javascript">alert("회원가입 성공");location.replace("/");</script>');
						}
					})
				}
			}
		});
	}
	
});


router.get('/register', function (req, res, next) {
	res.render('register', { title: 'Express' });
});


// 로그인 체크
router.post('/login', function(req, res, next) {
	connection.query('select * from users where id = ? and password = ?', 
		[req.param('id'), md5(req.param('password'))], function( error, results, fields) {
		
			if (results.length > 0) {
			 	sess = req.session;
    				sess.username = req.param('id');
			//	res.render('success', {title: 'Express', alert2: '로그인 성공'});
				res.redirect('/');
			} else {
				res.send('<script type="text/javascript">alert("로그인 실패");location.replace("/");</script>');
			}
	});
});


module.exports = router;
