const fs = require('fs');
const axios = require('axios');
const db = require('node-localdb');
const linkify = require('linkifyjs');
const sleep = require('sleep-promise');
const gmailnator = require('gmailnator');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');

const proxies = db('./proxies.json');
const usernames = fs.readFileSync('usernames.txt', 'utf8').toString().trim().split('\r\n');
const captchakey = ''; // token of 2captcha
const proxies_username = '';
const proxies_password = '';
let emailTried = 0;
setInterval(checkProxies, 60000);

puppeteer.use(StealthPlugin());
puppeteer.use(RecaptchaPlugin({
    provider: {
        id: '2captcha',
        token: captchakey,
    },
    visualFeedback: true,
    throwOnError: true
}));

start();
async function start(){
    console.log('Proxies will instert to database');
    //await insertProxies();
    createAccount();
}

async function createAccount() {
    console.log("======");
    let prox = await proxies.findOne({usable: true});
    let browser_config = {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-position=0,0',
            "--proxy-server=" + prox.proxy,
            '--window-size=1600,900',
        ],
        defaultViewport: null,
        ignoreHTTPSErrors: true,
        headless: false,
    }
    let browser = await puppeteer.launch(browser_config);
    console.log("Browser started with "+prox.proxy+ " proxy adress");
    try {
        let page = await browser.newPage();
        await page.authenticate({
            username: proxies_username,
            password: proxies_password
        });
        let accountInfos = await createAccinfos(browser, page);
        accountInfos.proxy = prox.proxy;
        fs.writeFileSync("./createdAccounts/" + accountInfos.username + ".json", JSON.stringify(accountInfos));
        console.log("Account writed to createdAccounts as "+accountInfos.username);
        browser.close();
        updateProxy(prox);
        await sleep(5000)
        createAccount();
    } catch (e) {
        console.log(e);
    }
}

async function createAccinfos(browser, page) {
    let username = usernames[Math.floor(Math.random() * usernames.length)];
    let password = await createRandomString(30);
    let email = await createEmail();
    console.log('Username: '+username+ '\nPassword: '+password+'\nE-mail: '+email);

    await fillDiscord(page, username, password, email);
    let client = page._client;
    let token;
    client.on('Network.webSocketFrameSent', ({
      requestId,
      timestamp,
      response
    }) => {
      try {
        const json = JSON.parse(response.payloadData);
        if (!token && json["d"]["token"]) {
          token = json["d"]["token"];
          console.log(`Token: ${token}`);
        };
      } catch (e) {
          console.log(e);
      };
    });
    await solveCaptcha(page);
    await sleep(5000);
    let link = await getMail(email, browser);
    await verifyMail(browser, link);
    console.log("Account verified");
    if (!token) {
        console.log("Token not found, trying to get it")
      await page.reload({
        waitUntil: ["networkidle0", "domcontentloaded"]
      });
    };
    let json = {};
    json.email = email;
    json.username = username;
    json.password = password;
    json.token = token;
    return json;
}

async function createRandomString(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

async function createEmail() {
    var promise = new Promise(function (resolve, reject) {
        gmailnator.generateEmail(function (err, email) {
            if (err) {
                console.log(err)
            } else {
                resolve(email);
            }
        });
    });
    return promise;
}

async function getMail(address, browser) {
    var promise = new Promise(function (resolve, reject) {
        gmailnator.checkEmails(address, async function (err, body) {
            if (err) {
                console.log(err);
            } else {
                console.log("You have " + body.emails.length + " email(s)");
                if (body.emails.length > 0) {
                    emailTried = 0;
                    console.log("checking most recent email...");
                    console.log(body.emails[1].link, body.emails)
                    axios(body.emails[1].link).then(function (response) {
                        let urls = linkify.find(response.data);
                        for (let i = 0; i < urls.length; i++) {
                            let link = urls[i].href;
                            if (link.indexOf('https://click.discord.com/ls/click?upn=') > -1) {
                                resolve(link);
                            }
                        }
                      }).catch(function (error) {
                          console.log('Error', error);
                      });
                } else {
                    emailTried++;
                    await sleep(10000);
                    if(emailTried >= 3){
                        browser.close();
                        await sleep(5000)
                        createAccount();
                    } else {
                        resolve(getMail(address, browser));
                    }
                }
            }
        });
    });
    return promise;
}

async function fillDiscord(DiscordPage, username, password, email) {
    await DiscordPage.bringToFront();
    await DiscordPage.goto('https://discord.com/register', {
      "waitUntil": "networkidle0",
      timeout: 70000
    });
    console.log("Creating account");
    await clickDate(DiscordPage, "Year", 17, 24);
    await clickDate(DiscordPage, "Day", 0, 28);
    await clickDate(DiscordPage, "Month", 0, 11);
  
    DiscordPage.waitForSelector('input[type*=checkbox]').then(() => {
      DiscordPage.$eval('input[type*=checkbox]', el => el.click());
    }).catch(e => {});
  
    await fillInput(DiscordPage, "username", username);
    await fillInput(DiscordPage, "password", password);
    await fillInput(DiscordPage, "email", email);
    await DiscordPage.$eval('button[type=submit]', (el) => el.click());
}

async function clickDate(page, name, min, max) {
    var i = await page.$('[class*=input' + name + "]");
    await i.click();
    var r = Math.floor(Math.random() * (max - min + 1)) + min;
    await page.waitForSelector('[class*=option]');
    await page.$eval("[class$=option]", function (e, r) {
      e.parentNode.childNodes[r].click()
    }, r);
    return r
}

async function fillInput(page, infoname, info) {
    const p = await page.$('input[name=' + infoname + ']');
    await p.focus();
    await page.keyboard.type(info);
}

async function solveCaptcha(DiscordPage) {
    try {
      await DiscordPage.waitForSelector('[src*=sitekey]');
      console.log("Captcha found");
      while (true) {
        try {
          await DiscordPage.solveRecaptchas();
          console.log("Captcha passed");
          return true;
        } catch (err) {
            console.log("Captcha - Error");
            sleep(3000);
        }
      }
    } catch (e) {
        console.log("Captcha not found");
    };
}

async function verifyMail(browser, link) {
    const page = await browser.newPage();
    await page.goto(link, {
      "waitUntil": "networkidle0",
      "timeout": 60000
    });
    solveCaptcha(page);
}

async function updateProxy(prox){
    proxies.update({_id: prox._id}, {proxy: prox.proxy, usable: false, _id: prox._id, time: +new Date / 1000});
    return;
}

function checkProxies(){
    proxies.find({}).then(function(proxi){
        proxi.forEach(proxy => {
            let now = +new Date / 1000;
            if((now - proxy.time) / 100 > 30){
                proxies.update({_id: proxy._id}, {proxy: proxy.proxy, usable: true, _id: proxy._id, time: +new Date / 1000});
            }
        });
    });
}

async function insertProxies(){
    proxies.remove({});
    let proxiler = fs.readFileSync('proxies.txt', 'utf8');
    proxiler.toString().trim().split('\r\n').forEach(item => {
        proxies.insert({proxy: item, usable: true, time: +new Date / 1000});
    });
    console.log('All proxies have been successfully added to the database');
    return;
}