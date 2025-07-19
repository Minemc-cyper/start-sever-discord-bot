require('dotenv').config();

module.exports = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  MC_HOST: process.env.MC_HOST,
  MC_PORT: parseInt(process.env.MC_PORT),
  COOKIE_PATH: './falix-cookies.json'
};
