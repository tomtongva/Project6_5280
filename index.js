const twilio = require('twilio');
const { MessagingResponse } = require('twilio').twiml; // respond to text message
const { TaskQueueRealTimeStatisticsPage } = require('twilio/lib/rest/taskrouter/v1/workspace/taskQueue/taskQueueRealTimeStatistics');

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const port = 80;

const { MongoClient } = require("mongodb");
const uri ="mongodb+srv://group35280:uncc2022@cluster0.rts9eht.mongodb.net/test";
const mongoClient = new MongoClient(uri);


const accountSid = 'AC06e57af70a21df8ddbd50147d53dc6b0'; // Your Account SID from www.twilio.com/console
const authToken = '7148510de1995ea197ebc2ef68fa06df'; // Your Auth Token from www.twilio.com/console

const twilioClient = new twilio(accountSid, authToken);

app.use(bodyParser.urlencoded({extended:false}));

// *********************************** START TWILIO ***********************************
app.post('/sms', async (req, res) => { // respond to text message
    const twiml = new MessagingResponse();
  
    let reqText = req.body.Body.toLowerCase();
    console.log("text from user " + reqText);

    if (reqText == "start")
        twiml.message('Welcome to the study');

    try {
        let existingSurvey = await findExistingSurvey(req.body.From, reqText);

        console.log("existing survey exists? " + existingSurvey);

        
        if (existingSurvey == null && reqText !== 'start') {
            twiml.message('The Robots are coming! Head for the hills! ' + req.body.Body + ' ' + req.body.From);
            res.type('text/xml').send(twiml.toString());
            return;
        }
        
        let symptoms = await getSymptoms();
        if (existingSurvey == null) {
            let result = await updateSurvey(req.body.From, reqText);

            let completedSymptoms = await getCompletedSymptoms(req.body.From);
            if (completedSymptoms != null) {
                for (const symptom of completedSymptoms) {
                    removeValueFromArray(symptoms, symptom);
                }
            }

            let question = "Please indicate your symptom ";
            let cnt = 0;
            for (const symptom of symptoms) {
                question = question + "(" + cnt++ + ")" + symptom + ", ";
            }
            question = question.substring(0, question.lastIndexOf(','));

            twiml.message(question);
        } else if (Number.isFinite(Number(reqText))) {            
            let lastProgress = existingSurvey.progress[existingSurvey.progress.length - 1];
            let responseText = "On a scale from 0 (none) to 4 (severe), how would you rate your " + existingSurvey.progress[1] +
                            " in the last 24 hours?";

            let question = null;
            if (lastProgress.includes("symptom")) {
                let severityArray = await getSeverity();
                lastProgress = lastProgress.replace("symptom", "");
                responseText = severityArray[Number(reqText)] + lastProgress;
                console.log("respond with " + responseText);

                let symptom = lastProgress;
                console.log("update user's survey with completed symptom " + symptom);
                await updateCompletedSurvey(req.body.From, symptom);

                let completedSymptoms = await getCompletedSymptoms(req.body.From);
                if (completedSymptoms.length >= 3) {
                    await deleteSurvey(req.body.From);
                    twiml.message("Thank you and see you soon");
                } else {
                    console.log("completed symptom survey " + completedSymptoms);
                    console.log("all symptoms " + symptoms);
                    for (const symptom of completedSymptoms) {
                        removeValueFromArray(symptoms, symptom);
                    }
        
                    question = "Please indicate your symptom ";
                    let cnt = 0;
                    for (const symptom of symptoms) {
                        question = question + "(" + cnt++ + ")" + symptom + ", ";
                    }
                    question = question.substring(0, question.lastIndexOf(','));
                    
                }
            }
            else {
                const symptoms = await getSymptoms();
                await updateSurvey(req.body.From, "symptom " + symptoms[Number(reqText)]); // user sent in symptom number, so insert into DB
            }

            twiml.message(responseText);
            if (question != null) twiml.message(question);

        } else {
            twiml.message("Please enter a number from 0 to 5");  
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
    if (indexOfValue !== -1) {
        array.splice(indexOfValue, 1);
    }
}

app.get('/', (req, res) => {
    testMsg();

    res.send("Hello world");
});

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
async function updateSurvey(phoneNumber, progress) {
    try {
      await mongoClient.connect();
      if (progress == "start") {
        const doc = {
            phoneNumber: phoneNumber,
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
                phoneNumber: phoneNumber,
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

async function getSymptoms() {
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