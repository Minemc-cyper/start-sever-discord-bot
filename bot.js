require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits } = require('discord.js');
const util = require('minecraft-server-util');
const { startFalixServer } = require('./startServer');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const { DISCORD_TOKEN, MC_HOST, MC_PORT } = process.env;

client.once('ready', () => {
  console.log(`✅ Bot Discord đã đăng nhập với tên: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!start') {
    message.reply('🟡 Đang cố gắng bật server Falix...');
    const result = await startFalixServer(message.channel);

    if (result.success) {
      message.reply('✅ Đã gửi yêu cầu bật server!');
    } else {
      message.reply(`❌ Lỗi: ${result.message}`);
    }
  }

  if (message.content === '!status') {
    message.reply('📡 Đang kiểm tra trạng thái server...');

    try {
      const status = await util.status(MC_HOST, parseInt(MC_PORT));
      message.reply(`🟢 Server ONLINE! Người chơi: ${status.players.online}/${status.players.max}`);
    } catch (err) {
      message.reply('🔴 Server OFFLINE hoặc không phản hồi.');
    }
  }
});

client.login(DISCORD_TOKEN);
