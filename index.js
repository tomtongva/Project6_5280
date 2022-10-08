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
  
    twiml.message('The Robots are coming! Head for the hills!' + req.body.Body + ' ' + req.body.From);
  
    try {
        await insertPhoneNumber(req.body.From);
        let symptoms = await getSymptoms();
        let question = "Please indicate your symptom ";
        let cnt = 0;
        for (const symptom of symptoms)
            question = question + "(" + cnt + ")" + symptom + ", ";
        question = question.substring(0, question.lastIndexOf(',' - 1));

        twiml.message(question);
    } catch (exception) {
        console.log(exception);
        twiml.message('Survey unavailable at this time');
        res.type('text/xml').send(twiml.toString());
        return;
      }


    res.type('text/xml').send(twiml.toString());
});

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
async function insertPhoneNumber(
    phoneNumber
  ) {
    try {
      await mongoClient.connect();
      const doc = {
        phoneNumber: phoneNumber
      };
      const result = await mongoClient.db("surveys").collection("survey").insertOne(doc);
      if (result) {
        console.log("phone number inserted " + result.insertedId);
        return result.insertedId;
      }
    } finally {
      await mongoClient.close();
    }
  }

async function getSymptoms() {
    try {
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
// *********************************** END MONGODB ***********************************

// *********************************** START ENDPOINT ***********************************
app.listen(process.env.PORT || port, () => {
    console.log(`Listening on port ${port}`);
    console.log(`${process.env.PORT}`);
});
// *********************************** END ENDPOINT ***********************************