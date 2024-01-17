'use strict';
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

module.exports.check = async (event) => {
  const url = 'https://sparta.cz/en/tickets/tickets';

  const searchWord = 'betis';

  if (!botToken) {
    throw new Error('Missing Telegram bot token')
  }

  if (!chatId) {
    throw new Error('Missing Telegram chat ID')
  }

  try {
    const response = await axios.get(url);
    const bot = new TelegramBot(botToken);

    // Check if the word 'Antonio' is in the source code
    if (response.data.toLowerCase().includes(searchWord.toLowerCase())) {
      console.log(`The word "${searchWord.toLowerCase()}" was found in the page source code.`);

      // Send a message through Telegram
      bot.sendMessage(chatId, `The word "${searchWord.toLowerCase()}" was found on the website ${url}.`);

      return {
        statusCode: 200,
        body: `Word ${searchWord.toLocaleLowerCase()} found, Telegram message sent`,
      };
    } else {
      console.log(`The word "${searchWord.toLowerCase()}" was not found in the page source code.`);
      bot.sendMessage(chatId, `The word "${searchWord.toLowerCase()}" was not found in the page source code.`);

      return {
        statusCode: 200,
        body: `Word ${searchWord.toLocaleLowerCase()} not found`,
      };
    }
  } catch (error) {
    console.error('Error making the request:', error);

    return {
      statusCode: 500,
      body: JSON.stringify('An error occurred while processing the request')
    };
  }
};

