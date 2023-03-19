# AI Chatter

AI Chatter is a proof-of-concept project for creating a simple Google Chat app
which uses the [OpenAI](https://openai.com/) chat completion API and image
generation API and runs on Google Apps Script without any additional cloud
services.

## Limitations

This implementation is not suitable for heavy use because it relies on Google
Apps Script properties for storing chat history data. The script properties are
not designed for storing such quickly changing information but they made it
possible to implement the chat history without using any additional services.

## Build

To build AI Chatter, you will need Node.js.

First install the required Node modules once with NPM.

```shell
npm install
```

Then build the application. This will produce `appsscript/AIChatter.js` which is
suitable for the Google Apps Script environment.

```shell
npm run build
```

## Deploy

### Required service accounts

To deploy the chat app you will need accounts for the following third party
services.

- Google Cloud ([sign up here](https://cloud.google.com/))
- OpenAI API ([sign up here](https://platform.openai.com/))

### Chat app configuration

First read Google Chat guide
[Google Apps Script Chat app quickstart](https://developers.google.com/chat/quickstart/apps-script-app)
and follow its instructions to setup the environment for an Apps Script based
chat app like AI Chatter.

1. Open [Google Cloud console](https://console.cloud.google.com/) and create a
   new project for the chat app.

2. Enable Google Chat API for the project:  
   _APIs & Services > search for "Google Chat API" > Enable API_

3. Set up OAuth consent screen for an internal chat app:  
   _APIs & Services > OAuth consent screen_  
   (no need to specify scopes for internal testing)

4. Open _Project settings_ using the three-dot button and copy _Project number_
   for later use.

5. Go to [Google Apps Script](https://script.google.com/), create a new project
   and give it some name.

6. Open _Project settings_ and check _Show appsscript.json_.

7. Copy and paste compiled application code from `appsscript/AIChatter.js` to
   Apps Script project editor into `Code.gs` (or similar).

8. Copy and paste `appsscript/appsscript.json` content to Apps Script editor
   into `appsscript.json` (or just add the property `chat: {}`).

9. Open _Project settings_ using the cogwheel button and set _Google Cloud
   Project (GCP) project number_ to the value copied from Google Cloud project.

10. Open [OpenAI console](https://platform.openai.com/) and from the user menu
    select _View API keys_. Click _Create new secret key_ and copy it securely.

11. Switch back to Google Apps Script project, select _Project settings_ and at
    the end of the page add a new _Script property_ with name `OPENAI_API_KEY`
    and value being the just created OpenAPI API key. Finally, save the script
    properties.

The chat app project is now configured.

### Test deployment

The next step is to publish a test version of the chat app for ourselves to try.

1. In your Apps Script project, select _Deploy > New deployment_ and click the
   cogwheel next to type selection. Select _Extension_. Give the deployment some
   name and publish. Then open _Deploy > Test deployments_, copy the shown _Head
   deployment id_ and click _Done_.

2. Go back to Google Cloud console, search for "Google Chat API" and open it.
   Then click _Manage_ and open tab _Configuration_. Fill in your application
   name, avatar URL and description. Under _Functionality_ select _Receive 1:1
   messages_ and _Join spaces and group conversations_. For _Connection
   settings_ select _Apps Script project_ and paste the _Head deployment id_
   from the previous step. Finally under _Visibility_ make the app available to
   yourself. You may wish to enable logs. Finally click _Save_, reload the page
   and you should see App status _LIVE_.

Now we can verify that the chat app is visible.

1. Open Google Chat using the same account as you used for the Apps Script
   project and as the test user.

2. Create a new chat using the plus button, select _Search for apps_ and then
   search for your chat app by name. It should be visible in the list. Select
   the app and start a new 1:1 chat.

3. Send a message to the chat app. You should get a prompt to setup the chat app
   which should take you to the app consent screen and ask for a permission to
   use network connectivity (to connect to OpenAI API). Choose to consent.

4. Start chatting with the chat app and try `/help` for further help on
   commands.

If you get an error saying that only trusted applications are allowed in your
Google Workspaces domain then you have to specifically allow the chat app
(requires admin rights for your Google Workspace).

1. Take note of the error message shown, it includes your application identifier
   of the format `<cryptic-long-id>.apps.googleusercontent.com`. Copy it.

2. Open [Google Admin Console](https://admin.google.com/) and from the left
   panel open _Security > Access rights and data management > Application
   interface controls_ and from there _Define third party application access
   rights_. Search your chat app using the application identifier from the
   previous step as the search string and make it trusted.
