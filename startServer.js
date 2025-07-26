// 📁 startServer.js
require('dotenv').config();
const fs = require('fs');
const util = require('minecraft-server-util');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

// Minecraft server config
const MC_HOST = process.env.MC_HOST;
const MC_PORT = parseInt(process.env.MC_PORT, 10);

// Proxy config
const PROXY_HOST = "166.0.152.222";
const PROXY_PORT = "24226";
const PROXY_USER = 'duyne';
const PROXY_PASS = 'dcom2008';
const PROXY = `http://${PROXY_HOST}:${PROXY_PORT}`;

const PING_RETRY = 3;
const PING_DELAY = 10000; // 10s
const FIRST_WAIT = 30000; // 30s

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function startFalixServer(discordChannel = null) {
  let browser;
  const debugBefore = `falix_debug_${Date.now()}.png`;
  const debugAfter  = `falix_after_click_${Date.now()}.png`;

  try {
    // ====== LAUNCH PUPPETEER ======
    browser = await puppeteer.launch({
      headless: process.env.HEADLESS === 'false' ? false : 'new',
      args: [
        `--proxy-server=${PROXY}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1366,768'
      ],
      defaultViewport: null
    });

    const page = await browser.newPage();

    // Proxy login
    await page.authenticate({ username: PROXY_USER, password: PROXY_PASS });

    // Check IP
    try {
      await page.goto('https://api.ipify.org?format=text', { waitUntil: 'domcontentloaded', timeout: 20000 });
      console.log('🌍 IP hiện tại:', await page.evaluate(() => document.body.innerText.trim()));
    } catch (e) {
      console.warn('⚠️ Không kiểm tra được IP:', e.message);
    }

    // Set cookies
    const cookieRaw = process.env.FALIX_COOKIE_JSON;
    if (!cookieRaw) throw new Error('Thiếu biến môi trường FALIX_COOKIE_JSON');
    await page.setCookie(...JSON.parse(cookieRaw));

    // Vào console
    await page.goto('https://client.falixnodes.net/server/console', {
      waitUntil: 'networkidle2',
      timeout: 90000
    });

    // Privacy popup
    await dismissPrivacyPopup(page);
    await safeScreenshot(page, 'debug_privacy.png'); // debug sau khi click

    // Popup quảng cáo
    await dismissPopup(page);

    // Screenshot
    await safeScreenshot(page, debugBefore);

    // Check nút Stop
    const uiShowsRunning = await page.evaluate(() => {
      return [...document.querySelectorAll('button')]
        .some(b => b.innerText.trim().toLowerCase() === 'stop');
    });
    if (uiShowsRunning && await pingOnce()) {
      await browser.close();
      const msg = '🟢 Server đang chạy sẵn (ping OK).';
      if (discordChannel) await discordChannel.send({ content: msg, files: [debugBefore] });
      return { success: true, message: msg };
    }

    // Click Start
    const clicked = await page.evaluate(() => {
      const startBtn = [...document.querySelectorAll('button')]
        .find(b => b.innerText.trim().toLowerCase() === 'start');
      if (!startBtn || startBtn.disabled) return false;
      startBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      startBtn.click();
      return true;
    });

    if (!clicked) {
      await browser.close();
      const msg = '❌ Không tìm thấy nút Start hoặc nút bị disable.';
      if (discordChannel) await discordChannel.send({ content: msg, files: [debugBefore] });
      return { success: false, message: msg };
    }

    await sleep(2000);
    await safeScreenshot(page, debugAfter);
    await browser.close();

    if (discordChannel)
      await discordChannel.send({ content: '✅ Đã click Start, chờ 30s rồi ping...', files: [debugAfter] });

    await sleep(FIRST_WAIT);
    return await pingServerWithRetry(discordChannel, PING_RETRY, PING_DELAY);

  } catch (err) {
    console.error('❌ Lỗi:', err);
    return { success: false, message: err.message || 'Lỗi không xác định' };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ====== POPUP PRIVACY ======
async function dismissPrivacyPopup(page) {
  try {
    const frames = page.frames();
    let found = false;
    for (const frame of frames) {
      const clicked = await frame.evaluate(() => {
        const btn = [...document.querySelectorAll('button')]
          .find(b => b.innerText.toLowerCase().includes('accept'));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      }).catch(() => false);
      if (clicked) {
        console.log('✅ Đã click nút Accept trong privacy popup.');
        found = true;
        break;
      }
    }
    if (!found) console.log('❌ Không tìm thấy nút Accept trong popup.');
    await sleep(1000);
  } catch (e) {
    console.warn('⚠️ Lỗi khi xử lý privacy popup:', e.message);
  }
}

// ====== POPUP ADS ======
async function dismissPopup(page) {
  try {
    const clicked = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')]
        .find(b => b.innerText.trim().toLowerCase() === 'cancel');
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (clicked) {
      console.log('✅ Đã đóng popup "Enjoying Falix?".');
      await sleep(1000);
    }
  } catch (e) {
    console.warn('⚠️ Không xử lý popup ads:', e.message);
  }
}

// ====== TIỆN ÍCH ======
async function safeScreenshot(page, file) {
  try {
    await page.screenshot({ path: file, fullPage: true });
    console.log(`📸 Đã chụp ${file}`);
  } catch (e) {
    console.warn('⚠️ Không thể chụp màn hình:', e.message);
  }
}

async function pingOnce() {
  try {
    await util.status(MC_HOST, MC_PORT, { timeout: 8000 });
    return true;
  } catch { return false; }
}

async function pingServerWithRetry(discordChannel, tries, delayMs) {
  for (let i = 1; i <= tries; i++) {
    try {
      console.log(`🔍 Ping lần ${i}/${tries}...`);
      const status = await util.status(MC_HOST, MC_PORT, { timeout: 10000 });
      const msg = `🟢 Server đã khởi động! Người chơi: ${status.players.online}/${status.players.max}`;
      if (discordChannel) await discordChannel.send(msg);
      return { success: true, message: msg };
    } catch (err) {
      console.warn(`❌ Ping thất bại lần ${i}:`, err.message);
      if (i < tries) await sleep(delayMs);
    }
  }
  const failMsg = '🔴 Server chưa khởi động sau 30-50s (ping fail).';
  if (discordChannel) await discordChannel.send(failMsg);
  return { success: false, message: failMsg };
}

module.exports = { startFalixServer };
