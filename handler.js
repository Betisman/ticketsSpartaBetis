'use strict';
const TelegramBot = require('node-telegram-bot-api');
const { chromium } = require('playwright');
require('dotenv').config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const alertOnlyFound = process.env.ALERT_ONLY_FOUND === 'true';

module.exports.check = async (event) => {
    const url = process.env.URL;
    const searchWord = '13/03/2025';

    if (!botToken) {
        throw new Error('Missing Telegram bot token')
    }

    if (!chatId) {
        throw new Error('Missing Telegram chat ID')
    }

    const bot = new TelegramBot(botToken);

    let browser = null;

    try {
        // Use Playwright instead of HTTPS
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        });
        const page = await context.newPage();

        // Navigate to the URL
        await page.goto(url, { waitUntil: 'networkidle' });

        // Get page content
        const content = await page.content();
        console.log(`content: ${content}`);

        const lis = await page.$$('ul.events-list li.events-item');
        let targetLi = null;
        for (const li of lis) {
            const liText = await li.innerText();
            console.log(liText);
            if (liText.includes(searchWord)) {
                targetLi = li;
            }
        }
        console.log('*'.repeat(60))
        console.log(await targetLi.innerText());
        console.log('*'.repeat(60))
        if (targetLi) {
            console.log(`The word "${searchWord.toLowerCase()}" was found in the page source code.`);
            const button = await targetLi.$('button');
            const buttonText = await button?.innerText();
            console.log(`The button text is "${buttonText}".`);
            if (buttonText !== 'Brevemente aqui') {
                console.log(`The button text is not "Brevemente aqui", it is "${buttonText}"`);

                bot.sendMessage(chatId, `!!!!!!!!!!! The word "${searchWord.toLowerCase()}" and the button text is "${buttonText}" was found on the website ${url}.`);

                return {
                    statusCode: 200,
                    body: `Word ${searchWord.toLocaleLowerCase()} found, Telegram message sent`,
                };
            } else {
                console.log(`The button text is "Brevemente aqui", it is "${buttonText}"`);

                if (!alertOnlyFound) {
                    bot.sendMessage(chatId, `The word "${searchWord.toLowerCase()}" was found in the page source code, but the button text is "${buttonText}".`);
                }

                return {
                    statusCode: 200,
                    body: `Word ${searchWord.toLocaleLowerCase()} not found, but the button text is "${buttonText}"`,
                };
            }
        } else {
            console.log(`The word "${searchWord.toLowerCase()}" was not found in the page source code.`);

            if (!alertOnlyFound) {
                bot.sendMessage(chatId, `The word "${searchWord.toLowerCase()}" was not found in the page source code.`);
            }

            return {
                statusCode: 200,
                body: `Word ${searchWord.toLocaleLowerCase()} not found`,
            };
        }
    } catch (error) {
        console.error('Error making the request:', error);

        const bot = new TelegramBot(botToken);

        // Handle errors with better messaging
        try {
            await bot.sendMessage(chatId, `Error checking for tickets: ${error.message}`);
        } catch (telegramError) {
            console.error('Error sending Telegram message:', telegramError);
        }

        return {
            statusCode: 500,
            body: JSON.stringify('An error occurred while processing the request: ' + error.message)
        };
    } finally {
        // Make sure to close the browser
        if (browser) {
            await browser.close();
        }
    }
};
