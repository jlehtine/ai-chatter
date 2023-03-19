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

To build AI Chatter, you will need Node.js (tested with major version 18).

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

## Configuration

### Sensitive properties

The following script properties must be set in the
[Google Apps Script console](https://script.google.com/). Open your script,
click cogwheel, open _Project settings_ and the script properties can be set at
the end of the page. These properties can not be set over chat interface for
security reasons.

- `OPENAI_API_KEY`  
  The mandatory OpenAI API key which must be kept secret.

- `ADMINS`  
  An optional list of user identifiers that are granted administrative
  permissions. Admin users can use
  [administrative commands](#administrative-commands) over a chat interface in a
  one-to-one chat with the app. If multiple admin users are specified then the
  identifiers must be separated by commas or spaces. The user identifiers are of
  the form `user/<number-sequence>` and the easiest way to find yours is to send
  the command `/show` to the app. If you are not an administrator it will
  display an error message along with your user identifier.

### Runtime properties

The following script properties can be set either in Google Apps Script console
as described in the previous section or an admin user can `/show` and `/set`
them over the chat interface in a one-to-one chat with the app.

- `CHAT_APP_NAME`  
  default is `<chat app name>`  
  Chat app name used in the help text and introductory texts returned by the
  app. Set this to the actual name of your chat app as configured in Google
  Cloud for better user experience.

- `INTRODUCTION`  
  Overrides the default chat app introduction text shown to the user when the
  chat app is added to a new chat. Any occurrences of `<chat app name>` are
  replaced by the value of property `CHAT_APP_NAME`, if set.

- `INTRODUCTION_PROMPT`  
  Overrides the default prompt sent to the chat completion API for obtaining
  self-introduction from ChatGPT when the chat app is added to a new chat. Set
  this property to `none` to disable the feature.

- `HISTORY_MINUTES`  
  must be a numeric JSON value, default is `60`  
  Specifies how long the chat history is preserved, in minutes. Any chat
  messages that are older are purged and not used as part of the chat completion
  history for new chat messages. In other words, chat completion forgets any
  older messages exchanged with the user in the current chat. Also the last
  image command is remembered for the same duration, for command `/again`.

- `MODERATION_URL`  
  default is `https://api.openai.com/v1/moderations`  
  URL of the OpenAI moderation API.

- `CHAT_COMPLETION_URL`  
  default is: `https://api.openai.com/v1/chat/completions`  
  URL of the OpenAI chat completion API.

- `CHAT_COMPLETION_MODEL`  
  default is `gpt-3.5-turbo`  
  OpenAI chat completion model to use.

- `CHAT_COMPLETION_INIT`  
  default is an empty array `[]`  
  This property can be used to specify a chat completion initialization
  sequence. It is a sequence of messages that is always added to chat completion
  requests before actual stored chat history. In other words, it can be used to
  specify permanent instructions for the chat completion model before any user
  input. The value must be a JSON array containing objects compatible with the
  chat completion API. Instead of setting this property directly, it is easier
  to just use `/init` command to set the initialization prompt.

- `CHAT_COMPLETION_SHOW_TOKENS`  
  `true` or `false`, default is `false`  
  OpenAI chat completion API uses tokens for pricing. This property specifies
  whether to show the number of tokens used as part of the response returned to
  the user. The total cost is also shown if `CHAT_COMPLETION_TOKEN_PRICE` has
  been set.

- `CHAT_COMPLETION_TOKEN_PRICE`  
  must be a numeric JSON value (e.g. `0.000002`), default is unset  
  Chat completion price per token in US dollars. If specified then the total
  cost is shown along with the token usage if `CHAT_COMPLETION_SHOW_TOKENS` has
  been set to `true`.

- `IMAGE_GENERATION_URL`  
  default is `https://api.openai.com/v1/images/generations`  
  URL of the OpenAI image generation API.

- `LOG_GOOGLE_CHAT` (`true` or `false`, default is `false`)  
  Whether to log requests received from and responses returned to Google Chat.

- `LOG_MODERATION` (`true` or `false`, default is `false`)  
  Whether to log requests sent to and responses received from OpenAI moderation
  API.

- `LOG_CHAT_COMPLETION` (`true` or `false`, default is `false`)  
  Whether to log requests sent to and responses received from OpenAI chat
  completion API.

- `LOG_IMAGE` (`true` or `false`, default is `false`)  
  Whether to log requests sent to and responses received from OpenAI image API.

- `

## Usage

TODO

### User commands

### Administrative commands
