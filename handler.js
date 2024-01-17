'use strict';
const TelegramBot = require('node-telegram-bot-api');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
require('dotenv').config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const idAbonado = process.env.ID_ABONADO;
const pinAbonado = process.env.PIN_ABONADO;
const dni = process.env.DNI;

const searchBetisWeb = async () => {
  const browser = await puppeteer.launch({
    headless: chromium.headless,
    slowMo: 100,
    executablePath: await chromium.executablePath(),
    ignoreHTTPSErrors: true,
    defaultViewport: chromium.defaultViewport,
    args:[...chromium.args, '--hide-scrollbars', '--disable-web-security']
  });
  const page = await browser.newPage();

  await page.goto("https://abonados.realbetisbalompie.es/index.php/es-es/");

  // type username in #id-abonado
  await page.type('#id-abonado', idAbonado);
  // type password in #pin-password
  await page.type('#pin-abonado', pinAbonado);

  await page.click('#login-abonado-rbb input[type="submit"]');

  // wait for 3 seconds or until the page loads
  await new Promise(r => setTimeout(r, 3000));

  // fill the input #dni with a value
  await page.type('#dni', dni);

  // click on the button #validar
  await page.click('#validar');

  // wait for 3 seconds or until the page loads
  await new Promise(r => setTimeout(r, 3000));

  // click on the link a[href="/index.php/es-es/soliciutd-banderas"]
  await page.click('a[href="/index.php/es-es/solicitud-banderas"]');

  // find the text "No se ha encontrado ningun evento activo"
  const text = await page.evaluate(() => document.querySelector('body').innerText);

  const isEventActive = !text.includes('No se ha encontrado ningun evento activo');
  const isZagrebFound = text.includes('Zagreb');

  await browser.close();

  return { isEventActive, isZagrebFound };
}

module.exports.check = async (event) => {
  if (!botToken) {
    throw new Error('Missing Telegram bot token')
  }

  if (!chatId) {
    throw new Error('Missing Telegram chat ID')
  }

  const bot = new TelegramBot(botToken);
  
  try {
    const { isEventActive, isZagrebFound } = await searchBetisWeb();

    let message = '';
    if (isEventActive || isZagrebFound) {
      message = `Check the website, there is an event active or Zagreb was found: ${JSON.stringify({ isEventActive, isZagrebFound })}`;
      console.log(message);

      // Send a message through Telegram
      bot.sendMessage(chatId, message);

      return {
        statusCode: 200,
        body: `${message} => Telegram message sent`,
      };
    } else {
      message = `:( There is no event active and Zagreb was not found: ${JSON.stringify({ isEventActive, isZagrebFound })}`;
      console.log(message);
      bot.sendMessage(chatId, message);

      return {
        statusCode: 200,
        body: message,
      };
    }
  } catch (error) {
    console.error('Error making the request:', error);

    return {
      statusCode: 500,
      body: `An error occurred while processing the request ${error.message}`
    };
  }
};

