// 📁 startServer.js
const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { COOKIE_PATH } = require('./config');

// Kích hoạt plugin ẩn danh để giảm bị Cloudflare chặn
puppeteer.use(StealthPlugin());

async function startFalixServer() {
  try {
    const browser = await puppeteer.launch({
      headless: false, // Để có thể hiện cửa sổ (nếu cần vượt CAPTCHA bằng tay)
      args: ['--start-maximized',],
      defaultViewport: null,
      userDataDir: './user-session' // Giữ session/cookie login đã xác thực CAPTCHA
    });

    const page = await browser.newPage();

    // Kiểm tra IP hiện tại của Puppeteer (qua proxy nếu có)
    await page.goto('https://api.ipify.org?format=text');
    const currentIP = await page.evaluate(() => document.body.innerText);
    console.log(`🌍 Puppeteer IP hiện tại là: ${currentIP}`);


    // Tải cookie từ file nếu có
    if (fs.existsSync(COOKIE_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, 'utf8'));
      await page.setCookie(...cookies);
    }

    // Truy cập trang điều khiển Falix
    await page.goto('https://client.falixnodes.net/server/console', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Chụp màn hình để kiểm tra nếu lỗi
    await page.screenshot({ path: 'falix_debug.png', fullPage: true });

    // Đợi một chút để nội dung động render
    await new Promise(resolve => setTimeout(resolve, 5000));

    const buttons = await page.$$('button');
    console.log(`🔍 Tìm thấy ${buttons.length} nút:`);

    for (const btn of buttons) {
      const text = await (await btn.getProperty('innerText')).jsonValue();
      console.log('🔘 Nút:', text?.trim());

      const clean = text?.trim().toLowerCase();
      if (clean === 'stop') {
        await browser.close();
        return { success: true, message: '🟢 Server đã đang chạy sẵn rồi.' };
      }
      if (clean === 'start') {
        await btn.click();
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
