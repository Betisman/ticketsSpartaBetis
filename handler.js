'use strict';
const TelegramBot = require('node-telegram-bot-api');
const playwright = require('playwright-aws-lambda');
require('dotenv').config();

// Environment variables and constants
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const url = process.env.URL;
const searchWord = process.env.SEARCH_WORD || '13/03/2025';
const alertOnlyFound = process.env.ALERT_ONLY_FOUND === 'true';
const PENDING_BUTTON_TEXT = 'Brevemente aqui';

// Initialize bot once
let bot;

module.exports.check = async (event) => {
    // Validate required environment variables
    if (!botToken) {
        throw new Error('Missing Telegram bot token');
    }
    if (!chatId) {
        throw new Error('Missing Telegram chat ID');
    }
    if (!url) {
        throw new Error('Missing URL to check');
    }

    // Initialize bot once
    if (!bot) {
        bot = new TelegramBot(botToken);
    }

    let browser = null;

    try {
        browser = await playwright.launchChromium({
            headless: true
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        });
        const page = await context.newPage();

        // Navigate to the URL
        await page.goto(url, { waitUntil: 'networkidle' });

        // Search for the target list item
        const result = await searchForTarget(page, searchWord);

        // Send notifications and return response based on search results
        return handleSearchResults(result, searchWord, url);
    } catch (error) {
        console.error('Error during website check:', error);

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
        // Close the browser
        if (browser) {
            await browser.close();
        }
    }
};

// Helper function to search for the target item
async function searchForTarget(page, searchWord) {
    const lis = await page.$$('ul.events-list li.events-item');
    let targetLi = null;

    for (const li of lis) {
        const liText = await li.innerText();
        console.log(liText);
        if (liText.includes(searchWord)) {
            targetLi = li;
            break;
        }
    }

    if (!targetLi) {
        console.log(`The word "${searchWord}" was not found in the page.`);
        return { found: false };
    }

    console.log('*'.repeat(60));
    console.log(await targetLi.innerText());
    console.log('*'.repeat(60));

    const button = await targetLi.$('button');
    const buttonText = await button?.innerText() || 'No button found';

    return {
        found: true,
        buttonText,
        isPending: buttonText === PENDING_BUTTON_TEXT
    };
}

// Helper function to handle search results
function handleSearchResults(result, searchWord, url) {
    if (!result.found) {
        if (!alertOnlyFound) {
            bot.sendMessage(chatId, `The word "${searchWord}" was not found in the page.`);
        }
        return {
            statusCode: 200,
            body: `Word ${searchWord} not found`
        };
    }

    if (!result.isPending) {
        bot.sendMessage(
            chatId,
            `!!!!!!!!!!! The word "${searchWord}" was found on the website ${url}. Button text: "${result.buttonText}"`
        );
        return {
            statusCode: 200,
            body: `Word ${searchWord} found, Telegram message sent`
        };
    } else {
        console.log(`Found "${searchWord}" but button text is "${result.buttonText}"`);

        if (!alertOnlyFound) {
            bot.sendMessage(
                chatId,
                `The word "${searchWord}" was found, but the button text is still "${result.buttonText}".`
            );
        }

        return {
            statusCode: 200,
            body: `Word ${searchWord} found, but the button is not active yet`
        };
    }
}
