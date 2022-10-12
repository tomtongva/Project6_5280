const twilio = require('twilio');
const { MessagingResponse } = require('twilio').twiml; // respond to text message
const { TaskQueueRealTimeStatisticsPage } = require('twilio/lib/rest/taskrouter/v1/workspace/taskQueue/taskQueueRealTimeStatistics');
const cookieParser = require('cookie-parser');
const cookie = require('cookie');



const jwt = require("jsonwebtoken");
const headerTokenKey = "x-jwt-token";

//In a production system, these would be stored somewhere safe, like a vault or secrets manager
const secrets = {
    ADMIN_USERNAME : 'admin',
    ADMIN_PASSWORD : 'password', 
    JWT_SECRET : 'Group3KeyForJWT'
}

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const port = 80;
var testParticipants = require('./participants.json');
app.use(bodyParser.json())



const { MongoClient, Timestamp } = require("mongodb");
const uri ="mongodb+srv://group35280:uncc2022@cluster0.rts9eht.mongodb.net/test";
const mongoClient = new MongoClient(uri);


const accountSid = 'AC06e57af70a21df8ddbd50147d53dc6b0'; // Your Account SID from www.twilio.com/console
const authToken = '7148510de1995ea197ebc2ef68fa06df'; // Your Auth Token from www.twilio.com/console

const twilioClient = new twilio(accountSid, authToken);

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended:false}));
app.use(cookieParser());
app.use(express.static('public'))

// *********************************** START TWILIO ***********************************
async function getRemainingSymptoms(req) {
    let symptoms = await getAllSymptomsFromDB();
    let completedSymptoms = await getCompletedSymptoms(req.body.From);
    if (completedSymptoms != null) {
      for (const symptom of completedSymptoms) {
        removeValueFromArray(symptoms, symptom);
      }
    }

    return [symptoms, completedSymptoms];
}

function determineSurveyQuestions(symptoms) {
    let question = "Please indicate your symptom ";
    let cnt = 0;
    for (const symptom of symptoms) {
      question = question + "(" + cnt++ + ")" + symptom + ", ";
    }
    question = question.substring(0, question.lastIndexOf(","));
    --cnt;

    return[question, cnt];
}

async function maxSurveyReached(twiml, req, res, responseText) {
    let completedSymptoms = await getCompletedSymptoms(req.body.From); // get the array of completed symptom surveys from db
    if (completedSymptoms.length >= 3) {
        console.log("final respones to user because 3 or more surveys");
        await endSurvey(req.body.From, "completed 3 symptoms");
        twiml.message(responseText);
        console.log(responseText);
        responseText = "Thank you and see you soon";
        twiml.message(responseText);
        console.log(responseText);
        res.type('text/xml').send(twiml.toString());
        return [true, completedSymptoms];
    }

    return [false, completedSymptoms];
}

async function sypmtomOptionZero(existingSurvey, req) {
    console.log("user sent " + existingSurvey.progress[1] + " " + (existingSurvey.progress[1] == "symptom None"));
    if (existingSurvey.progress[1] == "symptom None") {
        let responseText = "Thank you and we will check with you later";
        let question = null;
        await endSurvey(req.body.From, existingSurvey.progress[1]);

        console.log("returning " + responseText);
        return [responseText, question];
    }

    return [null, null];
}

function respondToInvalidSeverityLevel(severityArray, reqText, res, twiml) {
    if (Number.isFinite(Number(reqText)) && (Number(reqText) >= 0) && (Number(reqText) < severityArray.length)) {
        return false;
    } else {
        twiml.message("Please enter severity level between 0 and " + (severityArray.length -1 ));
        res.type('text/xml').send(twiml.toString());
        return true;
    }
}

app.post('/sms', async (req, res) => { // respond to text message
    const twiml = new MessagingResponse();
  
    let reqText = req.body.Body.toLowerCase();
    console.log("text from user " + reqText);

    try {
        let existingSurvey = await findExistingSurvey(req.body.From, reqText);

        console.log("existing survey exists? " + existingSurvey);

        if (existingSurvey == null && reqText == 'start') // send this welcome response only once during study
            twiml.message('Welcome to the study');

        if (existingSurvey != null && existingSurvey.progress != null && existingSurvey.progress[0] == 'END') { // survey already ended through symptom option 0 or max number of symptoms
            twiml.message('Please wait for the next survey');
            res.type('text/xml').send(twiml.toString());
            return;
        }

        if (existingSurvey == null && reqText !== 'start') {
            twiml.message('The Robots are coming! Head for the hills! ' + req.body.Body + ' ' + req.body.From);
            res.type('text/xml').send(twiml.toString());
            return;
        }
        
        let allSymptomsAndCompletedSymptoms = await getRemainingSymptoms(req);
        let symptoms = allSymptomsAndCompletedSymptoms[0];
        let completedSymptoms = allSymptomsAndCompletedSymptoms[1];

        let questionsAndSymptomCount = determineSurveyQuestions(symptoms);
        let question = questionsAndSymptomCount[0];
        let cnt = questionsAndSymptomCount[1];
        console.log("remaining question " + question + " " + cnt);

        if (existingSurvey == null) { // user sent START, so insert phone number into DB
            let result = await updateSurvey(req.body.From, reqText);

            twiml.message(question);
        } else if (Number.isFinite(Number(reqText)) && (Number(reqText) >= 0) && (Number(reqText) <= cnt)) {  // check symptom number bounderies           
            let lastProgress = existingSurvey.progress[existingSurvey.progress.length - 1];
            let responseText = null;
            if (lastProgress.includes("symptom")) { // make sure this is a severity number by checking "progress" from db
                let severityArray = await getSeverity(); // get severity levels from db
                lastProgress = lastProgress.replace("symptom", "");
                responseText = severityArray[Number(reqText)] + lastProgress;

                if (respondToInvalidSeverityLevel(severityArray, reqText, res, twiml) == true) {
                    console.log("user sent incorrect severity level");
                    return;
                }

                console.log("respond with " + responseText);

                console.log("update user's survey with completed symptom " + lastProgress);
                await updateCompletedSurvey(req.body.From, lastProgress);
        
                let maxSurveyResult = await maxSurveyReached(twiml, req, res, responseText);
                let maxSurvey = maxSurveyResult[0];
                completedSymptoms = maxSurveyResult[1];
                
                if (maxSurvey === true) {
                    return;
                } else { // send another survey question again since they haven't answer up to 3 questions
                    console.log("completed symptom survey " + completedSymptoms);
                    console.log("all symptoms " + symptoms);
                    for (const symptom of completedSymptoms) {
                        removeValueFromArray(symptoms, symptom);
                    }
                    questionsAndSymptomCount = determineSurveyQuestions(symptoms);
                    question = questionsAndSymptomCount[0];
                    cnt = questionsAndSymptomCount[1];                    
                }
            } else if (existingSurvey.progress[1] != null) { // user continued symptom survey
                console.log ("compare symptom" + existingSurvey.progress[1] + "-" + (existingSurvey.progress[1] == "symptom None"));
                
                if (completedSymptoms != null) {
                    for (const symptom of completedSymptoms) {
                        removeValueFromArray(symptoms, symptom);
                    }
                }
                await updateSurvey(req.body.From, "symptom " + symptoms[Number(reqText)]); // user sent in symptom number, so insert into DB
                existingSurvey = await findExistingSurvey(req.body.From, reqText);

                console.log("section 1 existing progress " + existingSurvey.progress[1]);
                let sypmtomOptionZeroResult = await sypmtomOptionZero(existingSurvey, req);
                responseText = sypmtomOptionZeroResult[0];
                console.log("section 1 responseText for symptom 0 " + responseText);
                if (responseText != null) {
                    question = null;
                } else {
                    responseText = "On a scale from 0 (none) to 4 (severe), how would you rate your " + existingSurvey.progress[1].replace("symptom ", "") +
                            " in the last 24 hours?";
                    question = null;
                }
            } else {
                await updateSurvey(req.body.From, "symptom " + symptoms[Number(reqText)]); // user sent in symptom number, so insert into DB
                existingSurvey = await findExistingSurvey(req.body.From, reqText);

                console.log("section 2 existing progress " + existingSurvey.progress[1]);
                let sypmtomOptionZeroResult = await sypmtomOptionZero(existingSurvey, req);
                responseText = sypmtomOptionZeroResult[0];
                console.log("section 2 responseText for symptom 0 " + responseText);
                if (responseText != null) {
                    question = null;
                } else {
                    responseText = "On a scale from 0 (none) to 4 (severe), how would you rate your " + existingSurvey.progress[1].replace("symptom ", "") +
                            " in the last 24 hours?";
                    question = null;
                }
            }

            twiml.message(responseText);
            if (question != null) twiml.message(question);

        } else { // the number sent from user falls out of the range of symptoms
            if (existingSurvey != null && existingSurvey.progress != null) {
                let lastProgress = existingSurvey.progress[existingSurvey.progress.length - 1];
                let responseText = null;
                if (lastProgress.includes("symptom")) {
                    let severityArray = await getSeverity();
                    lastProgress = lastProgress.replace("symptom", "");
                    responseText = severityArray[Number(reqText)] + lastProgress;

                    if (respondToInvalidSeverityLevel(severityArray, reqText, res, twiml) == true) {
                        console.log("user sent incorrect severity level");
                        return;
                    }

                    console.log("respond with " + responseText);

                    console.log("update user's survey with completed symptom " + lastProgress);
                    await updateCompletedSurvey(req.body.From, lastProgress);

                    let maxSurveyResult = await maxSurveyReached(twiml, req, res, responseText);
                    let maxSurvey = maxSurveyResult[0];
                    completedSymptoms = maxSurveyResult[1];
                    if (maxSurvey === true) {
                        return;
                    }
                }
            }

            twiml.message("Please enter a number from 0 to " + cnt);
        }
    } catch (exception) {
        console.log(exception);
        twiml.message('Survey unavailable at this time');
        return;
    }


    res.type('text/xml').send(twiml.toString());
});

function removeValueFromArray(array, value) {
    var indexOfValue = array.indexOf(value);
    console.log("remove " + value + "?" + (value !== "symptom None"));
    if ((indexOfValue !== -1) && (value !== "symptom None")) {
        array.splice(indexOfValue, 1);
    }
}

const jwtValidateUserMiddleware = (req, res, next) => {
  
    let token = req.cookies[headerTokenKey];
    if(token === undefined) {
        res.status(401).redirect('/');
    }
    
    if (token) {
      try {
        let decoded = jwt.verify(token, secrets.JWT_SECRET);
        req.decodedToken = decoded;
        next();
      } catch (err) {
        res.redirect('/');
      }
    } else {
    //   res.status(401).send({ error: "Token is required" });
    }
  };

  const jwtValidateNotLoggedIn = (req, res, next) => {
  
    let token = req.cookies[headerTokenKey];
    if(token === undefined) {
        next()
    }
    
    if (token) {
      try {
        let decoded = jwt.verify(token, secrets.JWT_SECRET);
        req.decodedToken = decoded;
        res.redirect('participants');
      } catch (err) {
        next();
      }
    } else {
    //   res.status(401).send({ error: "Token is required" });
    }
  };

app.get('/', jwtValidateNotLoggedIn, (req, res) => {

    res.render('login');
});

app.post('/login', async (req, res) => {


    if(req.body.username == secrets.ADMIN_USERNAME && req.body.password == secrets.ADMIN_PASSWORD) {
        let token = jwt.sign(
            {
              username: req.body.username,
              exp: Math.floor(Date.now() / 1000) + 3600
            },
            secrets.JWT_SECRET
          );
        
        const serialized = cookie.serialize(headerTokenKey, token, {
            secure: true,
            httpOnly: true
          });
        res.setHeader('Set-Cookie', serialized)
        return res.redirect('participants');
    } else {
        return res.status(401).send();
    }
});

app.post('/logout', (req, res) => {
    res.clearCookie(headerTokenKey)
    return res.redirect('/');
});

app.get('/setcookie', (req, res) => {
    res.cookie(`Cookie token name`,`encrypted cookie string Value`);
    res.send('Cookie have been saved successfully');
});

app.get('/participants', jwtValidateUserMiddleware, async (req, res) => {
    // let participants = testParticipants;

    let participants = await getParticipants();

    
    res.render('participants', {participants});
});

async function getParticipants() {
    var participants = [];
    try {
        await mongoClient.connect();
        var participantSurveys = await mongoClient
          .db("surveys")
          .collection("survey")
          .find({})
        await participantSurveys.forEach(survey => {
            let participant =     {
                _id : survey._id,
                phoneNumber : survey.phoneNumber,
                symptoms : [],
                dateEnrolled : new Date(Timestamp(survey.surveyStarted).getHighBits() * 1000)
            }
            if(survey.progress[0] == 'END') {
                participant.completionStatus = true;
            } else {
                participant.completionStatus = false;
            }
            survey.completedSymptomSurvey.forEach((completedSymptom, index) => {
                if(
                    completedSymptom == 'Sadness' ||
                    completedSymptom == 'Headache' ||
                    completedSymptom == 'Dizziness' ||
                    completedSymptom == 'Nausea' ||
                    completedSymptom == 'Fatigue'
                ){
                    let symptom = {
                        symptom : completedSymptom,
                        severity : null
                    }
                    console.log()
                    if(survey.severity && survey.severity[index]) {
                        symptom.severity = survey.severity[index]
                    }
                    participant.symptoms.push(symptom)
                }
            });
            participants.push(participant)
        })

      } finally {
        return participants;

        await mongoClient.close();
      }
}

// Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded());

// Parse JSON bodies (as sent by API clients)
app.use(express.json());

// app.post("/", (req, res) => {
//     console.log(req.body.userName + " " + req.body.password);
//     if (req.body != null && req.body.userName == "admin" && req.body.password=="password") 
//         res.send(findCurrentSurveys());
//     else
//         res.send(generateLoginPage());
// });

function testMsg() {
    twilioClient.messages
    .create({
        body: 'Hello from Node',
        to: '9809224519', // Text this number
        from: '+19259400731', // From a valid Twilio number
    })
    .then((message) => console.log(message.sid));

}
// *********************************** END TWILIO ***********************************

// *********************************** START MONGODB ***********************************
async function findCurrentSurveys() {
    try {
        console.log("connect to db");
        await mongoClient.connect();
        
        console.log("get surveys");
        let cursor = await mongoClient
            .db("surveys")
            .collection("symptoms")
            .find();;

        let retSurveys = "";
        cursor.forEach(function(err, item) {
            console.log(item);
            if(item == null) {
                mongoClient.close();
                return retSurveys;
            }
            retSurveys += item.phoneNumber;
        });
        
      } finally {
        await mongoClient.close();
      }
}

async function updateSurvey(phoneNumber, progress) {
    try {
      await mongoClient.connect();
      if (progress == "start") {
        const doc = {
            phoneNumber: phoneNumber,
            surveyStarted: new Timestamp(),
            progress: ['START']
        };
        const result = await mongoClient.db("surveys").collection("survey").insertOne(doc);
        if (result) {
            console.log("phone number inserted " + result.insertedId);
            return result;
        }
      } else {
        const result = await mongoClient.db("surveys").collection("survey").updateOne({
                phoneNumber: phoneNumber,
            }, {
                $push: {progress: progress}
            }
        );

        return result;
      }
      
    } finally {
      await mongoClient.close();
    }
}

async function updateCompletedSurvey(phoneNumber, symptomDescription) {
    symptomDescription = symptomDescription.trim();
    try {
        await mongoClient.connect();
        
        let result = await mongoClient.db("surveys").collection("survey").updateOne({
                phoneNumber: phoneNumber
            }, {
                $push: {completedSymptomSurvey: symptomDescription}
            }
        );

        await mongoClient.db("surveys").collection("survey").updateOne(
            { phoneNumber: phoneNumber},
            { $pull: { progress: { $in: [ "symptom " + symptomDescription ] } } }
        )

        return result;
        
      } finally {
        await mongoClient.close();
      }
}

async function endSurvey(phoneNumber, symptomDescription) {
    symptomDescription = symptomDescription.trim();
    try {
        await mongoClient.connect();
        
        let result = await mongoClient.db("surveys").collection("survey").updateOne({
                phoneNumber: phoneNumber
            }, {
                $push: {completedSymptomSurvey: symptomDescription}
            }
        );

        await mongoClient.db("surveys").collection("survey").updateOne(
            { phoneNumber: phoneNumber},
            { $set: { progress: [ "END" ] } }
        )

        return result;
        
      } finally {
        await mongoClient.close();
      }
}

async function getAllSymptomsFromDB() {
    try {
        console.log("getting all symptoms");
        await mongoClient.connect();
    
        var symptoms = await mongoClient
          .db("surveys")
          .collection("symptoms")
          .findOne({});

        return symptoms.symptoms;
      } finally {
        await mongoClient.close();
      }
}

async function getCompletedSymptoms(phoneNumber) {
    try {
        console.log("get user completed symptom surveys");
        await mongoClient.connect();
    
        var survey = await mongoClient
          .db("surveys")
          .collection("survey")
          .findOne({phoneNumber: phoneNumber});

        if (survey != null)
            return survey.completedSymptomSurvey;
      } finally {
        await mongoClient.close();
      }

      return;
}

async function findExistingSurvey(phoneNumber, reqText) {
    try {
        await mongoClient.connect();
    
        var survey = await mongoClient
          .db("surveys")
          .collection("survey")
          .findOne({phoneNumber: phoneNumber});

        return survey;
      } finally {
        await mongoClient.close();
      }
}

async function getSeverity() {
    try {
        await mongoClient.connect();
    
        var severity = await mongoClient
          .db("surveys")
          .collection("serverity")
          .findOne({});

        console.log("returning " + severity + " " + severity._id + " " + severity.severity);
        return severity.severity;
      } finally {
        await mongoClient.close();
      }
}

async function deleteSurvey(phoneNumber) {
    try {
        await mongoClient.connect();
    
        var survey = await mongoClient
          .db("surveys")
          .collection("survey")
          .deleteOne({phoneNumber: phoneNumber});

        return survey;
      } finally {
        await mongoClient.close();
      }
}

// *********************************** END MONGODB ***********************************

// *********************************** START ENDPOINT ***********************************
app.listen(process.env.PORT || port, () => {
    console.log(`Listening on port ${port}`);
    console.log(`${process.env.PORT}`);
});
// *********************************** END ENDPOINT ***********************************