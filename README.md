# Project 6: ITIS 5280
## UNC Charlotte | Advanced Mobile Application Development
### Members:
- Alex Miller
- Tom Va
- Jared Tamulynas

## WebHook
https://advancedmobileapp-sms.herokuapp.com/sms/

## Implementation
MongoDB <br>
	- surveys is the main collection <br />
	- severity is a document that stores the severity level/messages in an array <br />
	- symptoms is a document that stores the symptoms in an array <br />
	- survey is a document that stores each phone number that starts a survey <br />
		- phoneNumber: string for phone number <br />
		- progress: array to hold where the current survey is, i.e. START, symptom Dizziness <br />
		- completedSymptomSurvey: array to hold how many surveys were completed, i.e. Headache, Nausea, None <br />
App <br>
	The app uses the survey document to identify which survey belongs to which phone number. It uses the progress to distinguish if a survey has started. <br />
	It uses the completedSymptomSurvey to keep track of how many surveys have been completed. <br />
	When "start" is sent from a phone number, it is inserted into the DB. A response of the symptom questions are sent back to the phone number. <br />
	A local symptom array is created by comparing the DB's symptoms and completedSymptomSurvey arrays. <br />
	If the user sends back a valid number between this local array size then the user gets a response of the serverity level. <br />
	If the user sends back a valid severity level then the user gets a diagnosis response. <br />
	The user can end the survey by completing three survey symptom and severity questions or by sending 0 (zero). <br />

In this assignment your will create a server application that allows the sending of SMS messages to the user and to create a conversation with the user. The app should be based on the Twilio API (https://www.twilio.comLinks to an external site.). The requirements are as follows:

The user is able to enroll in the app by texting START to your study text number.
Your app should provide the required validation to ensure the user is not re-enrolled if already enrolled in the app. Send back some validation SMS to the user if they attempt to re-enroll.
Upon enrolling in the app for the first time, the user should be sent the message "Welcome to the study".
Step 1: After enrolling in the study the user should be sent the following message: "Please indicate your symptom (1)Headache, (2)Dizziness, (3)Nausea, (4)Fatigue, (5)Sadness, (0)None"
The user is only allowed to enter a number 0-5.
If the user enters an invalid message (not 0-5) then you should send the user a message "Please enter a number from 0 to 5".
If the user enters 0, then send them this message "Thank you and we will check with you later." and stop the messaging for this user.
Step 2: Assuming the user did not enter 0 in Step 1. After answering the symptom selection message the user should be asked to rank their symptom "On a scale from 0 (none) to 4 (severe), how would you rate your xxxx in the last 24 hours?", where "xxxx" is the symptom they selected in the first message.
The user is only allowed to enter a number 0-4. If the user sends a message not in this range you should send the user a message : "Please enter a number from 0 to 4"
Step 3: After answering the rating question the user should be sent a followup message based on the rating level they selected:
if 1 or 2 : then send "You have a mild xxxx" where xxxx is the symptom.
if 3 : then send "You have a moderate xxxx" where xxxx is the symptom.
if 4 : then send "You have a severe xxxx" where xxxx is the symptom.
if 0 : then send "You do not have a xxxx" where xxxx is the symptom.
After answering the rating question Step 1 should be repeated, the symptom question should be sent to the user 3 times. Make sure to remove the choices that were selected previously by the user. For example if the user picked Headache as a symptom, then the message should be : "Please indicate your symptom (1)Dizziness, (2)Nausea, (3)Fatigue, (4)Sadness, (0)None"
After the third time the following message should be sent to the user : "Thank you and see you soon"
You are required to use Twilio WebHooks and use a database to store the state of the user.
Example 1:

User Send: StarT
Twilio Send: Welcome to the study
Twilio Send: Please indicate your symptom (1)Headache, (2)Dizziness, (3)Nausea, (4)Fatigue, (5)Sadness, (0)None
User Send: 1
Twilio Send: On a scale from 0 (none) to 4 (severe), how would you rate your Headache in the last 24 hours?
User Send: 4
Twilio Send: You have a severe Headache
Twilio Send: Please indicate your symptom (1)Dizziness, (2)Nausea, (3)Fatigue, (4)Sadness, (0)None
User Send: 0
Twilio Send: Thank you and we will check with you later
 

Example 2:

User Send: StarT
Twilio Send: Welcome to the study
Twilio Send: Please indicate your symptom (1)Headache, (2)Dizziness, (3)Nausea, (4)Fatigue, (5)Sadness, (0)None
User Send: 1
Twilio Send: On a scale from 0 (none) to 4 (severe), how would you rate your Headache in the last 24 hours?
User Send: 4
Twilio Send: You have a severe Headache
Twilio Send: Please indicate your symptom (1)Dizziness, (2)Nausea, (3)Fatigue, (4)Sadness, (0)None
User Send: 3
Twilio Send: On a scale from 0 (none) to 4 (severe), how would you rate your Fatigue in the last 24 hours?
User Send: 2
Twilio Send: You have a mild Fatigue
Twilio Send: Please indicate your symptom (1)Dizziness, (2)Nausea, (3)Sadness, (0)None
User Send: 2
Twilio Send: On a scale from 0 (none) to 4 (severe), how would you rate your Nausea in the last 24 hours?
User Send: 3
Twilio Send: You have a moderate Nausea
Twilio Send: Thank you and see you soon
 

Admin Portal:

Only an admin user who can access the admin portal.
The portal should show a list of enrolled participants
Phone number, Date of enrolling, symptoms reported so far with ranking of each symptom.
You should be able to un-enroll/delete a previously enrolled user.
 

Submission should include:

Create a Github or Bitbucket repo for the assignment.
Push your code to the created repo. Should contain all your code. 
On the same repo create a wiki page describing your api design and implementation. The wiki page should describe the API routes, DB Schema and all the assumptions required to provide authentication. In addition describe any data that is stored on the device or on the server.
Include the Postman file in the repo.
If you used custom APIs you should demo your API using the Postman Chrome Plugin. The API should be demonstrated using Postman, you should create an api component in Postman for each of your created APIs.
Demo your API using a mobile app that uses your implemented api.
A 5 minute (max) screencast to demo your application.