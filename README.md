# discord-account-creator

With this script you can create Discord accounts for get a tokens.

## Software requirements

- [NodeJS 16 or higher](https://nodejs.org/en/download/)

## Clone the bot and install dependencies

```
git clone -b dev git@github.com:onurcansevinc/discord-account-creator.git
cd discord-account-creator
npm install
```

# How to use

- Open the `index.js` and fill `captchakey`, `proxies_username`,  `proxies_password` variables.
- Import your proxies to `proxies.txt`, script will be convert them to `proxies.json` so don't delete/edit `proxies.json`
- Start the script with click `start.bat` at Windows or type `node index.js`
- Script will start the create accounts and will save account infos to `createdAccounts` folder. 

Variable  | What's it
------------- | -------------
captchakey  | your token from [2captcha.com](https://2captcha.com/ "2captcha.com")
proxies_username  | username for proxy authentication 
proxies_password | password for proxy authentication
