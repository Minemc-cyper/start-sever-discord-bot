// 📁 startServer.js
require('dotenv').config();
const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function startFalixServer(discordChannel = null) {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--start-maximized'
      ],
      defaultViewport: null,
    });

    const page = await browser.newPage();

    // Kiểm tra IP
    await page.goto('https://api.ipify.org?format=text');
    const currentIP = await page.evaluate(() => document.body.innerText);
    console.log(`🌍 Puppeteer IP hiện tại là: ${currentIP}`);

    // Đọc cookie từ biến môi trường
    const cookieRaw = process.env.FALIX_COOKIE_JSON;
    if (!cookieRaw) throw new Error('Thiếu biến môi trường FALIX_COOKIE_JSON');

    const cookies = JSON.parse(cookieRaw);
    await page.setCookie(...cookies);

    await page.goto('https://client.falixnodes.net/server/console', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // 🛡️ Tự động xử lý popup đánh giá nếu tồn tại
    const closedPopup = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      const cancelBtn = buttons.find(b => b.innerText.trim().toLowerCase() === 'cancel');
      if (cancelBtn) {
        cancelBtn.click();
        return true;
      }
      return false;
    });

    if (closedPopup) {
      console.log('✅ Popup đã bấm Cancel. Chờ biến mất...');
      await new Promise(resolve => setTimeout(resolve, 800));
      await page.waitForFunction(() => {
        const popupText = Array.from(document.querySelectorAll('*'))
          .some(el => el.textContent?.includes('Enjoying Falix?'));
        return !popupText;
      }, { timeout: 7000 }).catch(() => {
        console.warn('⚠️ Không chắc popup đã biến mất hoàn toàn.');
      });
    }

    await page.screenshot({ path: 'falix_debug.png' });

    const buttons = await page.$$('button');
    console.log(`🔍 Tìm thấy ${buttons.length} nút:`);

    for (const btn of buttons) {
      const text = await (await btn.getProperty('innerText')).jsonValue();
      const clean = text?.trim().toLowerCase();
      console.log('🔘 Nút:', clean);

      if (clean === 'stop') {
        await browser.close();
        if (discordChannel) await discordChannel.send({ content: '🟢 Server đã đang chạy sẵn.', files: ['falix_debug.png'] });
        return { success: true, message: '🟢 Server đã đang chạy sẵn rồi.' };
      }

      if (clean === 'start') {
        const isDisabled = await page.evaluate(button => button.disabled, btn);
        if (isDisabled) {
          await browser.close();
          if (discordChannel) await discordChannel.send({ content: '🚫 Nút Start bị vô hiệu hoá. Có thể cần kích hoạt thủ công.', files: ['falix_debug.png'] });
          return { success: false, message: '🚫 Nút Start bị vô hiệu hoá. Có thể cần kích hoạt lần đầu.' };
        }

        await btn.click();
        await browser.close();
        if (discordChannel) await discordChannel.send({ content: '✅ Đã gửi lệnh bật server!', files: ['falix_debug.png'] });
        return { success: true, message: '✅ Đã gửi lệnh bật server!' };
      }
    }

    await browser.close();
    if (discordChannel) await discordChannel.send({ content: '❌ Không tìm thấy nút Start hay Stop. Giao diện có thể đã thay đổi.', files: ['falix_debug.png'] });
    return {
      success: false,
      message: '❌ Không tìm thấy nút Start hay Stop. Giao diện có thể đã thay đổi.'
    };
  } catch (err) {
    if (discordChannel && fs.existsSync('falix_debug.png')) {
      await discordChannel.send({ content: `❌ Lỗi khi bật server: ${err.message}`, files: ['falix_debug.png'] });
    }
    return {
      success: false,
      message: err.message || 'Lỗi không xác định khi truy cập Falix'
    };
  }
}

module.exports = { startFalixServer };
