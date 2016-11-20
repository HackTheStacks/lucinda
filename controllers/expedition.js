'use strict';

const async = require('async');
const request = require('request');
const cheerio = require('cheerio');
const xml = require('xml');
const moment = require('moment');
const Person = require('../models/Person');
const Expedition = require('../models/Expedition');

if (typeof localStorage === "undefined" || localStorage === null) {
  var LocalStorage = require('node-localstorage').LocalStorage;
  var localStorage = new LocalStorage('./scratch');
}

/**
 * GET /login
 * Login page.
 */
exports.getLogin = (req, res) => {
    var obj = req.flash();
    console.log("session:");
    console.log(obj.session);
    if (obj.session != null) {
        res.header('X-ArchivesSpace-Session', obj.session);
    }
    console.log(req.header('X-ArchivesSpace-Session'));
    res.render('expedition/login', {
        title: 'Expedition Login!',
        obj: obj,
        header: localStorage.getItem('session'),
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

    request(options, function(error, response, body) {
        if (error) throw new Error(error);

        console.log('body');
        var bodyJSON = JSON.parse(body);
        console.log(bodyJSON.session);
        req.flash('session', bodyJSON.session);
        localStorage.setItem('session', bodyJSON.session);

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

    var params = req.body;

    var title = params.title;
    var dates = params.dates;
    var creator = params.creator;
    var locale = params.locale;
    var notes = params.notes;
    var current_location = params.current_location;

    var expedition_num = 1;
    var person_num = 1;

    var expedition_xml = generateExpeditionXML(expedition_num,'test_event_description', title, dates, locale, notes, creator, 'Test field resource');
    var person_xml = generatePersonXML(person_num,'test_event_description', title, dates, locale, '', creator, 'Test field resource');

    var saveExpedition = new Expedition({
      xml: expedition_xml
    }).save();
    var savePerson = Person({
      xml: person_xml
    }).save();

    Promise.all([saveExpedition, savePerson]).then(() => {
      res.send({ 'expedition': expedition_xml, 'person': person_xml });
    });
};

exports.expeditionSearch = (req, res) => {
  var query = req.query['q'] || '';
  if (!query) {
    res.json([]);
    return;
  }

  var requestOptions = {
    url: 'http://10.20.40.218:3000/api/v1/expeditions',
    qs: { name: query }
  };

  request.get(requestOptions, (error, response, body) => {
    try {
      body = JSON.parse(body);
    } catch (e) {
      console.error('Exception parsing serach response', e);
      res.json([]);
    }
    res.json(body.map((item) => {
      item.text = item.name;
      delete item.name;
      return item;
    }));
  });
}

exports.mockSearch = (req, res) => {
  // keeping this around just in case
  var query = req.query['q'] || '';
  if (!query) {
    res.send(JSON.stringify([]));
    return;
  }

  res.json([
      { text: query + 'foo', id: 'amnhc_00' },
      { text: query + 'bar', id: 'amnhc_01' },
      { text: query + 'baz', id: 'amnhc_02' },
      { text: query + 'flux', id: 'amnhc_03' }
  ]);
}

exports.getAll = (req, res) => {
  var expeditions = Expedition.find();
  var people = Person.find();

  const getXml = function(el) {
    return el.xml;
  };

  Promise.all([expeditions, people]).then((results) => {
    res.json({
      expeditions: results[0].map(getXml),
      people: results[1].map(getXml)
    });
  });
}

var generateIdentity = function(name, entityType) {
    return { 'identity': [{ 'entityType': entityType }, { 'nameEntry': [{ 'part': name }] }] };
}

//     <description>
//       <existDates>
//         <date>[Date]</date>
//       </existDates>
//       <places>
//         <place>
//           <placeEntry>[Geographic Location]</placeEntry>
//         </place>
//       </places>
//       <biogHist>
//         <p>[Notes]</p>
//       </biogHist>
//     </description>

var generateDescription = function(date, location, notes, isExpedition) {
    var existDates = { 'existDates': [{ 'date': date }] };
    var places = { 'places': [{ 'place': [{ 'placeEntry': location }] }] };
    var biogHist = { 'biogHist': [{ 'p': (isExpedition ? notes : '')}] }
    if(isExpedition){
        return { 'description': [existDates, places, biogHist] };
    }
    return {'description': [biogHist]};
}

//     <relations>
//       <cpfRelation>
//         <relationEntry>[Creator Name]</relationEntry>
//       </cpfRelation>
//       <resourceRelation>
//         <relationEntry>[Title of Field Resource]</relationEntry>
//       </resourceRelation>
//     </relations>

var generateRelations = function(relationEntry, fieldResource) {
    var cpfRelation = { 'cpfRelation': [{ 'relationEntry': relationEntry }] };
    var resourceRelation = { 'resourceRelation': [{ 'relationEntry': fieldResource }] };
    return { 'relations': [cpfRelation, resourceRelation] };
}


var generateCpfDescription = function(name, entityType, date, location, notes, creator, fieldResource, isExpedition) {
    var identity = generateIdentity((isExpedition ? name : creator), entityType);
    var description = generateDescription(date, location, notes, isExpedition);
    var relations = generateRelations((isExpedition ? creator : name), fieldResource);
    return { 'cpfDescription': [identity, description, relations] };
}
//   <control>
//     <!-- record ids must be unique, can be generated sequentially from amnhc_6000001
//     data in brackets below come from the expedition tracker app -->
//     <recordId>amnhc_6000001</recordId>
//     <maintenanceStatus>new</maintenanceStatus>
//     <maintenanceAgency>
//       <agencyCode>OCLC-YAM</agencyCode>
//       <agencyName>American Museum of Natural History</agencyName>
//     </maintenanceAgency>
//     <languageDeclaration>
//       <language languageCode="eng">English</language>
//       <script scriptCode="Latn">Latin</script>
//     </languageDeclaration>
//     <maintenanceHistory>
//       <maintenanceEvent>
//         <eventType>created</eventType>
//         <eventDateTime standardDateTime="2016-11-20">20 November 2016</eventDateTime>
//         <agentType>machine</agentType>
//         <agent>[Expedition Tracker]</agent>
//         <eventDescription>[AMNH Hackathon demo.]</eventDescription>
//       </maintenanceEvent>
//     </maintenanceHistory>
//   </control>
var generateControl = function(category, num, event_description) {
    var recordId = generateRecordId(category, num);
    var maintenanceStatus = { 'maintenanceStatus': 'new' };
    var maintenanceAgency = { 'maintenanceAgency': [{ 'agencyCode': 'OCLC-YAM' }, { 'agencyName': 'American Museum of Natural History' }] };
    var languageDeclaration = {
        'languageDeclaration': [
            { 'language': [{ '_attr': { 'languageCode': 'eng' } }, 'English'] },
            { 'script': [{ '_attr': { 'scriptCode': 'Latn' } }, 'Latin'] }
        ]
    };
    var maintenanceEvent = generateMaintenanceEvent(event_description);
    var maintenanceHistory = { 'maintenanceHistory': [maintenanceEvent] }
    return {'control': [recordId, maintenanceStatus, maintenanceAgency, languageDeclaration, maintenanceHistory]};
}

//       <maintenanceEvent>
//         <eventType>created</eventType>
//         <eventDateTime standardDateTime="2016-11-20">20 November 2016</eventDateTime>
//         <agentType>machine</agentType>
//         <agent>[Expedition Tracker]</agent>
//         <eventDescription>[AMNH Hackathon demo.]</eventDescription>
//       </maintenanceEvent>
var generateMaintenanceEvent = function(description) {
    var now = moment();
    var standardDateTimeAttr = now.format("YYYY-MM-D");
    var eventDateTimeStr = now.format("DD MMMM YYYY");
    var eventType = { 'eventType': 'created' };
    var eventDateTime = { 'eventDateTime': [{ '_attr': { 'standardDateTime': standardDateTimeAttr } }, eventDateTimeStr] };
    var agentType = {'agentType':'machine'};
    var agent = {'agent': 'Expedition Tracker'};
    var eventDescription = {'eventDescription': description};
    return {'maintenanceEvent': [eventType, eventDateTime, agentType, agent, eventDescription]};
}

// <recordId>amnhc_6000001</recordId>

var createRecordIdString = function(category, num){
    return 'amnh' + category + '_' + num;
}

var generateRecordId = function(category, num) {
    return { 'recordId': createRecordIdString(category, num) };
}

var generateExpeditionXML = function(num, event_description, name, date, location, notes, creator, fieldResource) {

    var control = generateControl('c', num, event_description);
    var cpfDescription = generateCpfDescription(name, 'corporateBody', date, location, notes, creator, fieldResource, true);
    var eac_cpf = {'eac-cpf': [{'_attr': {
        'xmlns': 'urn:isbn:1-931666-33-4',
        'xmlns:xlink':'http://www.w3.org/1999/xlink', 
        'xmlns:xsi':'http://www.w3.org/2001/XMLSchema-instance',
        'xsi:schemaLocation': 'urn:isbn:1-931666-33-4 http://eac.staatsbibliothek-berlin.de/schema/cpf.xsd'
    }}, control, cpfDescription]};
    return xml(eac_cpf, true);
}

var generatePersonXML = function(num, event_description, name, date, location, notes, creator, fieldResource) {

    var control = generateControl('p', num, event_description);
    var cpfDescription = generateCpfDescription(name, 'person', date, location, notes, creator, fieldResource, false);
    var eac_cpf = {'eac-cpf': [{'_attr': {
        'xmlns': 'urn:isbn:1-931666-33-4',
        'xmlns:xlink':'http://www.w3.org/1999/xlink', 
        'xmlns:xsi':'http://www.w3.org/2001/XMLSchema-instance',
        'xsi:schemaLocation': 'urn:isbn:1-931666-33-4 http://eac.staatsbibliothek-berlin.de/schema/cpf.xsd'
    }}, control, cpfDescription]};
    return xml(eac_cpf, true);
}

/*


<eac-cpf xmlns="urn:isbn:1-931666-33-4" xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="urn:isbn:1-931666-33-4 http://eac.staatsbibliothek-berlin.de/schema/cpf.xsd">
  <control>
    <!-- record ids must be unique, can be generated sequentially from amnhc_6000001
    data in brackets below come from the expedition tracker app -->
    <recordId>amnhc_6000001</recordId>
    <maintenanceStatus>new</maintenanceStatus>
    <maintenanceAgency>
      <agencyCode>OCLC-YAM</agencyCode>
      <agencyName>American Museum of Natural History</agencyName>
    </maintenanceAgency>
    <languageDeclaration>
      <language languageCode="eng">English</language>
      <script scriptCode="Latn">Latin</script>
    </languageDeclaration>
    <maintenanceHistory>
      <maintenanceEvent>
        <eventType>created</eventType>
        <eventDateTime standardDateTime="2016-11-20">20 November 2016</eventDateTime>
        <agentType>machine</agentType>
        <agent>[Expedition Tracker]</agent>
        <eventDescription>[AMNH Hackathon demo.]</eventDescription>
      </maintenanceEvent>
    </maintenanceHistory>
  </control>
  <cpfDescription>
    <identity>
      <entityType>corporateBody</entityType>
      <nameEntry>
        <part>[Expedition Name]</part>
      </nameEntry>
    </identity>
    <description>
      <existDates>
        <date>[Date]</date>
      </existDates>
      <places>
        <place>
          <placeEntry>[Geographic Location]</placeEntry>
        </place>
      </places>
      <biogHist>
        <p>[Notes]</p>
      </biogHist>
    </description>
    <relations>
      <cpfRelation>
        <relationEntry>[Creator Name]</relationEntry>
      </cpfRelation>
      <resourceRelation>
        <relationEntry>[Title of Field Resource]</relationEntry>
      </resourceRelation>
    </relations>
  </cpfDescription>
</eac-cpf>

*/
