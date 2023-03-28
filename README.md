# AI Chatter

AI Chatter is a proof-of-concept project for creating a simple Google Chat app
which uses the [OpenAI](https://openai.com/) chat completion API and image
generation API and runs on [Google Apps Script](https://script.google.com/)
without any additional cloud services.

## Contents

- [Limitations](#limitations)
- [Security and privacy](#security-and-privacy)
- [Build](#build)
- [Deploy](#deploy)
- [Configuration](#configuration)
- [Usage](#usage)
- [Development](#development)

## Limitations

This implementation is not suitable for heavy use because it relies on Google
Apps Script properties for storing chat history data. The script properties are
not designed for storing such quickly changing information but they made it
possible to implement the chat history without using any additional services.

Definitely DO NOT deploy this implementation as an external public chat app
because the implementation does not have any safeguards for such usage.

## Security and privacy

Anyone having access to the deployed chat app can send chat completion and image
generation requests to OpenAI API using the configured API key. It is possible
to deploy the chat app only to specific Google users or user groups for test
use. The chat app has also been used for an organization wide internal
deployment in a small organization.

The implementation sends chat completion and image generation requests to OpenAI
API. The requests also include the numeric Google user identifier (e.g.
`users/<digits>`) of the user making the request. Additionally, the current chat
history including the timestamps and chat messages is stored as a script
property in Google Apps Script. Anyone participating the chat can view the
history using the `/history` command.

Textual content received from the user as input or received from the chat
completion API as output is sent to the OpenAI moderation API before being used.
If the content is flagged by the moderation API then the content will not be
used and an error is shown instead.

Ensure that proper terms of use and privacy policy are being applied if you make
the chat app accessible to others. Ensure you comply with the
[OpenAI terms of use](https://openai.com/policies/terms-of-use).

## Build

To build AI Chatter, you will need Node.js (developed with major version 18).

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
   Apps Script project editor into `Code.gs` (or similar) and rename it to
   `AIChatter.gs`.

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

This chat app is configured using script properties.

Please note that also chat histories and per-space language model instsructions
are stored as script properties. These properties have a property name with
prefix `_history` or `_instructions` and they are used as runtime data, not for
configuration.

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
  JSON string value, e.g. `"Something\nlike\nthis"`  
  Overrides the default chat app introduction text shown to the user when the
  chat app is added to a new chat. Any occurrences of `<chat app name>` are
  replaced by the value of property `CHAT_APP_NAME`, if set.

- `INTRODUCTION_PROMPT`  
  JSON string value, e.g. `"Something\nlike\nthis"`  
  Overrides the default prompt sent to the chat completion API for obtaining
  self-introduction from ChatGPT when the chat app is added to a new chat. Set
  this property to `none` to disable the feature.

- `HELP_TEXT`  
  JSON string value, e.g. `"Something\nlike\nthis"`  
  Overrides the default help text returned by the `/help` command. An occurrence
  of `<admin-commands>` is replaced by the standard admin commands help section
  if the user is an admin user.

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

- `IMAGE_PROMPT_TRANSLATION`  
  JSON string value, e.g. `"Something\nlike\nthis"`, default is unset  
  This property can be used to translate image requests using chat completion
  before they are sent to the image generation API. If set, the value must be a
  JSON string value and it must contain string `<image prompt>` which will be
  replaced by the original image prompt. This value is then sent to the chat
  completion API and its response is used as input to image generation API. A
  typical use case would be to translate image prompts to English for a better
  response.

- `LOG_GOOGLE_CHAT`  
  `true` or `false`, default is `false`  
  Whether to log requests received from and responses returned to Google Chat.

- `LOG_MODERATION`  
  `true` or `false`, default is `false`  
  Whether to log requests sent to and responses received from OpenAI moderation
  API.

- `LOG_CHAT_COMPLETION`  
  `true` or `false`, default is `false`  
  Whether to log requests sent to and responses received from OpenAI chat
  completion API.

- `LOG_IMAGE`  
  `true` or `false`, default is `false`  
  Whether to log requests sent to and responses received from OpenAI image API.

## Usage

To communicate with the deployed chat app, go to
[Google Chat](https://mail.google.com/chat/) and start a new chat with the app
by clicking the plus icon and then searching for apps by name.

The chat app can also be added to group chats and spaces. However, in that case
it will only receive the messages by explicitly mentioning the app using
`@<chat app name>`.

### User commands

The following user commands can be used by any user having access to the chat
app.

- `/help`  
  Show the help on commands.

- `/intro`  
  Replay the chat app introduction normally displayed when the chat app is
  invited to a new discussion.

- `/image [n=<number of images>] [<size, e.g. 512x512>] <prompt>`  
  Request an image or images to be generated based on the specified _prompt_.
  The command parameters may specify the number of images to be generated using
  notation `n=<number of images>`, e.g. `n=3`. Also the size of the generated
  image(s) can be specified using notation `512x512`. The specified size is
  rounded to one of the image sizes supported by the OpenAI API: 256x256,
  512x512 or 1024x1024. Also see the property `IMAGE_PROMPT_TRANSLATION` to
  translate or transform provided image prompts.

- `/again`  
  Repeat the previous chat completion request or image generation request. The
  generated responses have a lot of random variation so this is an easy way to
  get an alternative response. Also, if you experience timeout errors then this
  command can be used for repeating the timeouted request.

- `/instruct [<instructions>]`  
  Set or clear instructions given to the language model in this space. This can
  be used to control the language model behaviour. For example: _"Reply with
  binary ones and zeros only."_ The specified instructions will replace any
  existing instructions for this space. If no instructions are specified then
  any existing instructions are cleared.

- `/history [clear]`  
  Show or clear chat history which is the basis for chat completion responses.

### Administrative commands

The following administrative commands can be used by administrators specified
using the `ADMINS` property. These commands can only be used in a one-to-one
chat with the chat app.

- `/init [<initialization>]`  
  Set global chat initialization prompt which will be included at the start of
  each discussion but is not visible to the users. It can be used to instruct
  the language model to behave in a certain way. An example initialization might
  be: _"In this chat you are a polite research assistant helping scientists and
  providing them with scientific citations."_ This is a kind of "programming"
  for the language model. If this command is given without any initialization
  prompt then any existing initialization is cleared.

- `/show [<property...>]`  
  Show the values of visible configuration properties or values of the specified
  properties, if any are specified. This command does not show the properties
  storing the API key or chat histories.

- `/set <property> [<value>]`  
  Sets the specified configuration property to the specified value. This command
  refuses to set the sensitive properties `OPENAI_API_KEY` and `ADMINS` and
  properties storing chat history. If no value is specified then the property is
  cleared.

## Development

For development, it is recommended to use
[Clasp](https://github.com/google/clasp) (Command Line Apps Script Projects)
which makes it possible to do development locally and to sync changes to Google
Apps Script from the command line.

First go to
[Google Apps Script user settings](https://script.google.com/home/usersettings)
and enable Google Apps Script API if it is not enabled.

Now login to Google Apps Script with Clasp. Depending on your Google Workspace
security settings, you might first have to add Clasp as a trusted application.
The stored login token may expire periodically requiring a new login before
other actions are possible.

```shell
npx clasp login
```

Then clone the Apps Script project that you setup for the chat app into the
`appsscript` directory. This is done only once to initialize the development
environment. For this operation you will need the identifier of the script. Go
to [Google Apps Script](https://script.google.com/), open your chat app script,
click cogwheel on the left, open _Project settings_ and copy the script
identifier.

```shell
( cd appsscript && npx clasp clone <script id> )
```

Now you can compile a new version and push it to Google Apps Script using just
command line.

```shell
npm run build
npm run push
```

You can also use Clasp for other tasks such as publishing a new version of the
app. Execute any Clasp commands in the `appsscript` directory.
