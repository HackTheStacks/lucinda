'use strict';

const async = require('async');
const request = require('request');
const cheerio = require('cheerio');

/**
 * GET /login
 * Login page.
 */
exports.getLogin = (req, res) => {
    var obj = req.flash();
    console.log("session:");
    console.log(obj.session);
    if(obj.session != null){
        res.header('X-ArchivesSpace-Session', obj.session);
    }
    console.log(req.header('X-ArchivesSpace-Session'));
    res.render('expedition/login', {
        title: 'Expedition Login!',
        obj: obj,
        header: obj.session,
        error: obj.error
    });
};

/**
 * POST /login
 * Execute a login.
 */
exports.postLogin = (req, res) => {

    console.log('params:');
    console.log(req.body);
    var username = req.body.username;
    var password = req.body.password;
    var options = {
        method: 'POST',
        url: 'http://data.library.amnh.org:8089/users/' + username + '/login',
        headers:
        {
            'postman-token': '11988eff-1229-b962-53c8-51ea5948d236',
            'cache-control': 'no-cache',
            'content-type': 'multipart/form-data; boundary=---011000010111000001101001'
        },
        formData: { password: password }
    };

    request(options, function (error, response, body) {
        if (error) throw new Error(error);

        console.log('body');
        var bodyJSON = JSON.parse(body);
        console.log(bodyJSON.session);
        req.flash('session', bodyJSON.session);
        // console.log('response');
        // console.log(response);

        req.flash('test', 'yay!');
        req.flash('error', bodyJSON.error);
        res.redirect('login');

    });
};

/**
 * POST /
 * Create an expedition.
 */
exports.postCreateExpedition = (req, res) => {

    res.send({'success':true});
};

exports.mockSearch = (req, res) => {
  var query = req.param('q', '');
  if (!query) {
    res.send(JSON.stringify([]));
    return;
  }

  res.send(JSON.stringify([
    { text: query + 'foo', id: 'amnhc_00' },
    { text: query + 'bar', id: 'amnhc_01' },
    { text: query + 'baz', id: 'amnhc_02' },
    { text: query + 'flux', id: 'amnhc_03' }
  ]));
}