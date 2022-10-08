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
app.post('/sms', (req, res) => { // respond to text message
    const twiml = new MessagingResponse();
  
    twiml.message('The Robots are coming! Head for the hills!' + req.body.Body);
  
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
async function createUser(
    email,
    password,
    firstName,
    lastName,
    gender,
    city,
    customerId
  ) {
    try {
      await client.connect();
      const doc = {
        email: email,
        password: password,
        firstName: firstName,
        lastName: lastName,
        gender: gender,
        city: city,
        customerId: customerId,
      };
      const result = await client.db("users").collection("user").insertOne(doc);
      if (result) {
        console.log("user created with id " + result.insertedId);
        return result.insertedId;
      }
    } finally {
      await client.close();
    }
  }
// *********************************** END MONGODB ***********************************

// *********************************** START ENDPOINT ***********************************
app.listen(process.env.PORT || port, () => {
    console.log(`Listening on port ${port}`);
    console.log(`${process.env.PORT}`);
});
// *********************************** END ENDPOINT ***********************************