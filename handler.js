'use strict';
const TelegramBot = require('node-telegram-bot-api');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const winston = require('winston');
require('dotenv').config();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

logger.info('Starting the application');

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const idAbonado = process.env.ID_ABONADO;
const pinAbonado = process.env.PIN_ABONADO;
const dni = process.env.DNI;

const searchBetisWeb = async () => {
  logger.info('Starting the searchBetisWeb function');
  let content;
  const browser = await puppeteer.launch({
    headless: chromium.headless,
    slowMo: 50,
    executablePath: await chromium.executablePath(),
    ignoreHTTPSErrors: true,
    defaultViewport: chromium.defaultViewport,
    args: [...chromium.args, '--hide-scrollbars', '--disable-web-security']
  });

  logger.info('Browser launched');

  const page = await browser.newPage();

  await page.goto("https://abonados.realbetisbalompie.es/index.php/es-es/");

  logger.info('Page loaded');

  // type username in #id-abonado
  await page.type('#id-abonado', idAbonado);
  // type password in #pin-password
  await page.type('#pin-abonado', pinAbonado);

  await page.click('#login-abonado-rbb input[type="submit"]');

  logger.info('Login submitted, let\'s wait for 3 seconds (max) or until the page loads');

  // wait for 3 seconds or until the page loads
  await new Promise(r => setTimeout(r, 3000));

  logger.info('3 seconds (max) passed, let\'s fill the input #dni with a value');

  content = await page.content();
  logger.info(`content: ${content}`);

  // fill the input #dni with a value
  await page.type('#dni', dni);

  // click on the button #validar
  await page.click('#validar');

  logger.info('Validar button clicked, let\'s wait for 3 seconds (max) or until the page loads');

  
  // wait for 3 seconds or until the page loads
  await new Promise(r => setTimeout(r, 3000));
  
  content = await page.content();
  logger.info(`content: ${content}`);

  // click on the link a[href="/index.php/es-es/soliciutd-banderas"]
  await page.click('a[href="/index.php/es-es/solicitud-banderas"]');

  logger.info('Solicitud banderas link clicked, let\'s wait for 3 seconds (max) or until the page loads');

  // wait for 3 seconds or until the page loads
  await new Promise(r => setTimeout(r, 3000));

  content = await page.content();
  logger.info(`content: ${content}`);

  // find the text "No se ha encontrado ningun evento activo"
  const text = await page.evaluate(() => document.querySelector('body').innerText);

  const isEventActive = !text.includes('No se ha encontrado ningun evento activo');
  const isZagrebFound = text.includes('Zagreb');

  logger.info(`isEventActive: ${isEventActive}`);
  logger.info(`isZagrebFound: ${isZagrebFound}`);

  await browser.close();

  logger.info('Browser closed');

  return { isEventActive, isZagrebFound };
}

module.exports.check = async (event) => {
  try {
    logger.info('Starting the check function');

    if (!botToken) {
      throw new Error('Missing Telegram bot token')
    }

    if (!chatId) {
      throw new Error('Missing Telegram chat ID')
    }

    const bot = new TelegramBot(botToken);

    const { isEventActive, isZagrebFound } = await searchBetisWeb();

    logger.info(`check:isEventActive: ${isEventActive}`);
    logger.info(`check:isZagrebFound: ${isZagrebFound}`);


    let message = '';
    if (isEventActive || isZagrebFound) {
      message = `Check the website, there is an event active or Zagreb was found: ${JSON.stringify({ isEventActive, isZagrebFound })}`;
      logger.info(message);

      // Send a message through Telegram
      bot.sendMessage(chatId, message);

      return {
        statusCode: 200,
        body: `${message} => Telegram message sent`,
      };
    } else {
      message = `:( There is no event active and Zagreb was not found: ${JSON.stringify({ isEventActive, isZagrebFound })}`;
      logger.info(message);
      bot.sendMessage(chatId, message);

      return {
        statusCode: 200,
        body: message,
      };
    }
  } catch (error) {
    logger.error('Error making the request:', error);

    return {
      statusCode: 500,
      body: `An error occurred while processing the request ${error.message}`
    };
  }
};

