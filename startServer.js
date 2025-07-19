// 📁 startServer.js
const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { COOKIE_PATH } = require('./config');

puppeteer.use(StealthPlugin());

async function startFalixServer() {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--disable-setuid-sandbox',
        '--no-sandbox',
        '--start-maximized'
      ],
      defaultViewport: null,
      userDataDir: './user-session'
    });

    const page = await browser.newPage();

    // Kiểm tra IP
    await page.goto('https://api.ipify.org?format=text');
    const currentIP = await page.evaluate(() => document.body.innerText);
    console.log(`🌍 Puppeteer IP hiện tại là: ${currentIP}`);

    if (fs.existsSync(COOKIE_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, 'utf8'));
      await page.setCookie(...cookies);
    }

    await page.goto('https://client.falixnodes.net/server/console', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await page.waitForTimeout(7000);

    const buttons = await page.$$('button');
    console.log(`🔍 Tìm thấy ${buttons.length} nút:`);

    for (const btn of buttons) {
      const text = await (await btn.getProperty('innerText')).jsonValue();
      const clean = text?.trim().toLowerCase();
      console.log('🔘 Nút:', clean);

      if (clean === 'stop') {
        await browser.close();
        return { success: true, message: '🟢 Server đã đang chạy sẵn rồi.' };
      }

      if (clean === 'start') {
        const isDisabled = await page.evaluate(button => button.disabled, btn);
        if (isDisabled) {
          await browser.close();
          return { success: false, message: '🚫 Nút Start bị vô hiệu hoá. Có thể cần kích hoạt lần đầu.' };
        }

        await btn.click();
        await page.screenshot({ path: 'falix_debug.png' });
        await browser.close();
        return { success: true, message: '✅ Đã gửi lệnh bật server!' };
      }
    }

    await browser.close();
    return {
      success: false,
      message: '❌ Không tìm thấy nút Start hay Stop. Giao diện có thể đã thay đổi.'
    };
  } catch (err) {
    return {
      success: false,
      message: err.message || 'Lỗi không xác định khi truy cập Falix'
    };
  }
}

module.exports = { startFalixServer };
