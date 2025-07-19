// 📁 bot.js
const { Client, GatewayIntentBits } = require('discord.js');
const util = require('minecraft-server-util');
const { startFalixServer } = require('./startServer');
const { DISCORD_TOKEN, MC_HOST, MC_PORT } = require('./config');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`✅ Bot Discord đã đăng nhập với tên: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!start') {
    await message.reply('🟡 Đang kiểm tra trạng thái server và gửi lệnh bật nếu cần...');
    const result = await startFalixServer();
    if (result.success) {
      await message.reply(result.message);
    } else {
      await message.reply(`❌ Lỗi khi bật server: ${result.message}`);
    }
  }

  if (message.content === '!status') {
    await message.reply('📡 Đang kiểm tra trạng thái server...');
    try {
      const status = await util.status(MC_HOST, MC_PORT);
      await message.reply(`🟢 Server ONLINE! Người chơi: ${status.players.online}/${status.players.max}`);
    } catch (err) {
      await message.reply('🔴 Server OFFLINE hoặc không phản hồi.');
    }
  }
});

client.login(DISCORD_TOKEN);
