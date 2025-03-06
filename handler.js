'use strict';
const TelegramBot = require('node-telegram-bot-api');
const { chromium } = require('playwright');
const playwright = require('playwright-aws-lambda');
const chromium_aws = require('@sparticuz/chromium');
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
    let context = null;
    let page = null;

    try {
        console.log('Launching browser...');

        // Check if running in AWS Lambda or locally
        const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

        if (isLambda) {
            // AWS Lambda configuration
            console.log('Running in AWS Lambda environment');
            browser = await playwright.launchChromium({
                args: [...chromium_aws.args, '--no-sandbox', '--disable-setuid-sandbox'],
                executablePath: await chromium_aws.executablePath(),
                headless: chromium_aws.headless === 'true',
                timeout: 30000,
            });
        } else {
            // Local configuration
            console.log('Running in local environment');
            browser = await chromium.launch({
                headless: true,
                timeout: 30000,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }

        // More detailed logging of browser status
        console.log('Browser launched successfully. Browser version:',
            await browser.version());

        console.log('Creating browser context...');
        context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            viewport: { width: 1280, height: 720 },
            javaScriptEnabled: true,
            bypassCSP: true
        });

        console.log('Creating new page...');
        page = await context.newPage();

        console.log(`Navigating to ${url}...`);
        const MAX_RETRIES = 3;
        let retryCount = 0;
        let navigationSuccessful = false;

        while (!navigationSuccessful && retryCount < MAX_RETRIES) {
            try {
                console.log(`Navigation attempt ${retryCount + 1}/${MAX_RETRIES} to ${url}...`);
                await page.goto(url, {
                    waitUntil: 'networkidle',
                    timeout: 30000
                });
                console.log(await page.content());
                navigationSuccessful = true;
                console.log('Navigation successful!');
            } catch (navigationError) {
                retryCount++;
                console.error(`Navigation attempt ${retryCount} failed:`, navigationError.message);

                if (retryCount >= MAX_RETRIES) {
                    throw navigationError;
                }

                await new Promise(r => setTimeout(r, 1000));
            }
        }

        console.log('Navigation complete, searching for target...');
        const result = await searchForTarget(page, searchWord);
        return handleSearchResults(result, searchWord, url);
    } catch (error) {
        try {
            console.error('Detailed error information:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
                browserState: browser ? 'initialized' : 'not initialized',
                contextState: context ? 'initialized' : 'not initialized',
                pageState: page ? 'initialized' : 'not initialized'
            });
            await bot.sendMessage(chatId, `Error checking for tickets: ${error.message}`);
        } catch (telegramError) {
            console.error('Error sending Telegram message:', telegramError);
        }
        return {
            statusCode: 500,
            body: JSON.stringify('An error occurred while processing the request: ' + error.message)
        };
    } finally {
        // More robust resource cleanup
        console.log('Cleaning up resources...');
        try {
            if (page) {
                await page.close().catch(e => console.error('Error closing page:', e));
            }
            if (context) {
                await context.close().catch(e => console.error('Error closing context:', e));
            }
            if (browser) {
                await browser.close().catch(e => console.error('Error closing browser:', e));
            }
        } catch (cleanupError) {
            console.error('Error during cleanup:', cleanupError);
        }
    }
};

// Helper function to search for the target item
async function searchForTarget(page, searchWord) {
    console.log(await page.content());
    const lis = await page.$$('ul.events-list li.events-item');
    let targetLi = null;

    console.log('Searching for target...');
    console.log(lis.length);
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
