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

const emailAbonado = process.env.EMAIL_ABONADO;
const passwordAbonado = process.env.PASSWORD_ABONADO;

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

  logger.info(`idAbonado: ${idAbonado}`);
  logger.info(`pinAbonado: ${pinAbonado}`);
  logger.info(`dni: ${dni}`);

  const page = await browser.newPage();

  await page.goto('https://socios.realbetisbalompie.es/socios');
  await page.waitForNavigation();

  logger.info('Page socios loaded');

  // click the button with the link containing sso.realbetisbalompie.es
  await page.click('a[href="https://sso.realbetisbalompie.es/"]');

  logger.info('Button sso.realbetisbalompie.es clicked');

  await page.waitForNavigation();
  logger.info('Page sso.realbetisbalompie.es loaded');

  // click the button with content having (password or contraseña)
  await page.click('button:has-text("contraseña")');
  logger.info('Button password clicked');

  // wait for 3 seconds or until the page loads
  await new Promise(r => setTimeout(r, 3000));

  await page.waitForNavigation();
  logger.info('Page password loaded');

  // type email in #formBasicText
  await page.type('#formBasicText', emailAbonado);
  // type password in #formBasicPassword
  await page.type('#formBasicPassword', passwordAbonado);

  // click the button of type submit with class btnLogin
  await page.click('.btnLogin');

  logger.info('Login submitted, let\'s wait for 3 seconds (max) or until the page loads');

  // wait for 3 seconds or until the page loads
  await new Promise(r => setTimeout(r, 3000));

  logger.info('3 seconds (max) passed, let\'s fill the input #dni with a value');

  content = await page.content();
  logger.info(`content: ${content}`);

  // click the button of type submit with class btnLogin
  await page.click('.btnLogin');

  content = await page.content();
  logger.info(`content: ${content}`);

  // click the link with href containing inscripciones
  await page.click('a[href="/socios/area-privada/inscripciones"]');

  content = await page.content();
  logger.info(`content: ${content}`);

  logger.info('Solicitud inscripciones link clicked, let\'s wait for 3 seconds (max) or until the page loads');

  // wait for 3 seconds or until the page loads
  await new Promise(r => setTimeout(r, 3000));

  content = await page.content();
  logger.info(`content: ${content}`);

  // find the text "No se ha encontrado ningun evento activo"
  const text = await page.evaluate(() => document.querySelector('body').innerText);

  const isEventActive = !text.includes('No se ha encontrado ningun evento activo');
  // find the text "Gent" or "Gente"
  const isGentFound = text.includes('Gent') || text.includes('Gante');

  logger.info(`isEventActive: ${isEventActive}`);
  logger.info(`isGentFound: ${isGentFound}`);

  await browser.close();

  logger.info('Browser closed');

  return { isEventActive, isGentFound };
}

module.exports.check = async (event) => {
  try {
    const date = new Date();
    logger.info(`Starting the check function ${date.toISOString()}`);

    if (!botToken) {
      throw new Error('Missing Telegram bot token')
    }

    if (!chatId) {
      throw new Error('Missing Telegram chat ID')
    }

    logger.info(`botToken: ${botToken}`);
    logger.info(`chatId: ${chatId}`);

    const bot = new TelegramBot(botToken);

    const { isEventActive, isGentFound } = await searchBetisWeb();

    logger.info(`check:isEventActive: ${isEventActive}`);
    logger.info(`check:isGentFound: ${isGentFound}`);


    let message = '';
    let sentMessage = '';
    if (isEventActive || isGentFound) {
      message = `${date.toISOString()}: Check the website, there is an event active or Zagreb was found: ${JSON.stringify({ isEventActive, isGentFound })}`;
      logger.info(message);

      // Send a message through Telegram
      sentMessage = await bot.sendMessage(chatId, message);

      logger.info(`sentMessage: ${JSON.stringify(sentMessage)}`);
      
      return {
        statusCode: 200,
        body: `${message} => Telegram message sent`,
      };
    } else {
      message = `${date.toISOString()}: :( There is no event active and Zagreb was not found: ${JSON.stringify({ isEventActive, isGentFound })}`;
      logger.info(message);
      sentMessage = await bot.sendMessage(chatId, message);
      logger.info(`sentMessage: ${JSON.stringify(sentMessage)}`);
      
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

