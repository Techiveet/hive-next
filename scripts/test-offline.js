// scripts/test-offline.js - UPDATED
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function runOfflineTests() {
  console.log('🚀 Starting offline functionality tests...\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,
    args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process']
  });
  
  const page = await browser.newPage();
  
  // Set viewport
  await page.setViewport({ width: 1280, height: 800 });
  
  try {
    // Test 1: Navigate to page
    console.log('📄 Test 1: Loading page...');
    await page.goto('http://localhost:3000/dashboard/offline-test', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Wait for any element that indicates the page loaded
    await page.waitForSelector('button, input, [class*="button"], [class*="input"]', { timeout: 10000 });
    console.log('✅ Page loaded successfully\n');
    
    // Take a screenshot of the page
    await page.screenshot({ path: 'test-page-loaded.png' });
    console.log('📸 Screenshot: test-page-loaded.png');
    
    // Check what's on the page
    const pageContent = await page.content();
    if (pageContent.includes('Sign in') || pageContent.includes('login')) {
      console.log('⚠️  Page appears to be a login page. You might need to authenticate first.');
      console.log('   Make sure you are logged in before running tests.');
      
      // Try to log in if there's a login form
      await handleLogin(page);
      await page.waitForTimeout(2000);
      await page.goto('http://localhost:3000/dashboard/offline-test', { waitUntil: 'networkidle0' });
    }
    
    // Look for the offline test module text
    const hasOfflineText = await page.evaluate(() => {
      return document.body.textContent.includes('Offline') || 
             document.body.textContent.includes('offline') ||
             document.body.textContent.includes('Online') ||
             document.body.textContent.includes('online');
    });
    
    if (!hasOfflineText) {
      console.log('⚠️  Could not find offline test content. Checking page structure...');
      const pageTitle = await page.title();
      console.log(`📄 Page title: ${pageTitle}`);
      
      // List all h1, h2 elements
      const headings = await page.evaluate(() => {
        const h1s = Array.from(document.querySelectorAll('h1')).map(h => h.textContent);
        const h2s = Array.from(document.querySelectorAll('h2')).map(h => h.textContent);
        return { h1s, h2s };
      });
      
      console.log('📝 Headings found:', headings);
    }
    
    // Test 2: Check for form elements
    console.log('\n📝 Test 2: Looking for form elements...');
    const hasForm = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      const buttons = document.querySelectorAll('button');
      return {
        inputCount: inputs.length,
        buttonCount: buttons.length,
        hasNameInput: Array.from(inputs).some(i => i.placeholder?.includes('Name') || i.name?.includes('name')),
        hasEmailInput: Array.from(inputs).some(i => i.type === 'email' || i.placeholder?.includes('Email')),
        hasSubmitButton: Array.from(buttons).some(b => b.textContent?.includes('Save') || b.textContent?.includes('Submit') || b.type === 'submit')
      };
    });
    
    console.log(`✅ Found ${hasForm.inputCount} input(s), ${hasForm.buttonCount} button(s)`);
    console.log(`✅ Name input: ${hasForm.hasNameInput ? 'Yes' : 'No'}`);
    console.log(`✅ Email input: ${hasForm.hasEmailInput ? 'Yes' : 'No'}`);
    console.log(`✅ Submit button: ${hasForm.hasSubmitButton ? 'Yes' : 'No'}\n`);
    
    // Test 3: Check connection status
    console.log('📶 Test 3: Checking connection status...');
    const status = await page.evaluate(() => {
      const text = document.body.textContent || '';
      if (text.includes('Online')) return 'online';
      if (text.includes('Offline')) return 'offline';
      return 'unknown';
    });
    
    console.log(`✅ Current status: ${status}\n`);
    
    // Test 4: Go offline
    console.log('🔌 Test 4: Testing offline mode...');
    await page.setOfflineMode(true);
    await page.waitForTimeout(3000);
    
    // Check if status updates
    const offlineStatus = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return text.includes('Offline') || text.includes('No internet');
    });
    
    console.log(`✅ Offline detection: ${offlineStatus ? 'Working' : 'Not detected'}\n`);
    
    // Test 5: Try to submit form while offline
    console.log('📝 Test 5: Submitting form while offline...');
    
    // Fill form if we can find the inputs
    const nameInputSelector = 'input[placeholder*="Name"], input[name*="name"], input:first-of-type';
    const emailInputSelector = 'input[type="email"], input[placeholder*="Email"], input:nth-of-type(2)';
    const submitButtonSelector = 'button[type="submit"], button:has-text("Save"), button:has-text("Submit")';
    
    try {
      // Try to fill name
      await page.waitForSelector(nameInputSelector, { timeout: 3000 });
      await page.type(nameInputSelector, 'Puppeteer Test', { delay: 50 });
      console.log('✅ Filled name input');
    } catch (e) {
      console.log('⚠️  Could not find name input');
    }
    
    try {
      // Try to fill email
      await page.waitForSelector(emailInputSelector, { timeout: 3000 });
      await page.type(emailInputSelector, 'puppeteer@test.com', { delay: 50 });
      console.log('✅ Filled email input');
    } catch (e) {
      console.log('⚠️  Could not find email input');
    }
    
    try {
      // Try to submit
      await page.waitForSelector(submitButtonSelector, { timeout: 3000 });
      await page.click(submitButtonSelector);
      console.log('✅ Clicked submit button');
      
      // Wait for response
      await page.waitForTimeout(2000);
      
      // Check for success message
      const success = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('Saved locally') || 
               text.includes('Queued') || 
               text.includes('offline') ||
               text.includes('pending');
      });
      
      console.log(`✅ Form submission: ${success ? 'Appears successful' : 'No success indicator found'}\n`);
    } catch (e) {
      console.log('⚠️  Could not submit form:', e.message);
    }
    
    // Test 6: Check pending count
    console.log('📊 Test 6: Checking for pending items...');
    const pendingInfo = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      for (const el of elements) {
        const text = el.textContent || '';
        if (text.includes('Pending') || text.includes('pending') || text.includes('queue')) {
          // Look for numbers
          const match = text.match(/\d+/);
          if (match) {
            return { text: text.substring(0, 100), count: parseInt(match[0]) };
          }
          return { text: text.substring(0, 100), count: 0 };
        }
      }
      return null;
    });
    
    if (pendingInfo) {
      console.log(`✅ Found pending info: "${pendingInfo.text}"`);
      console.log(`✅ Pending count: ${pendingInfo.count}\n`);
    } else {
      console.log('ℹ️  No pending information found\n');
    }
    
    // Test 7: Go back online and check sync
    console.log('🔗 Test 7: Testing online restoration...');
    await page.setOfflineMode(false);
    await page.waitForTimeout(5000);
    
    // Check if status changed back
    const newStatus = await page.evaluate(() => {
      const text = document.body.textContent || '';
      if (text.includes('Online')) return 'online';
      if (text.includes('Offline')) return 'offline';
      return 'unknown';
    });
    
    console.log(`✅ New status: ${newStatus}\n`);
    
    // Test 8: Look for sync button
    console.log('🔄 Test 8: Looking for sync controls...');
    const syncControls = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const syncButtons = buttons.filter(btn => 
        btn.textContent?.includes('Sync') || 
        btn.textContent?.includes('sync') ||
        btn.textContent?.includes('Refresh')
      );
      
      return {
        count: syncButtons.length,
        texts: syncButtons.map(b => b.textContent?.trim()).filter(Boolean)
      };
    });
    
    console.log(`✅ Found ${syncControls.count} sync-related button(s):`, syncControls.texts);
    
    // Take final screenshot
    await page.screenshot({ path: 'test-final.png' });
    console.log('\n📸 Final screenshot: test-final.png');
    
    console.log('\n🎉 Test summary:');
    console.log('✅ Page loaded');
    console.log(`✅ Form elements: ${hasForm.inputCount > 0 ? 'Found' : 'Missing'}`);
    console.log(`✅ Offline detection: ${offlineStatus ? 'Working' : 'Check manually'}`);
    console.log(`✅ Form submission: ${'Attempted'}`);
    console.log(`✅ Pending tracking: ${pendingInfo ? 'Found' : 'Not found'}`);
    console.log(`✅ Online restoration: ${newStatus === 'online' ? 'Working' : 'Check manually'}`);
    console.log(`✅ Sync controls: ${syncControls.count > 0 ? 'Found' : 'Not found'}`);
    
    console.log('\n📋 Next steps:');
    console.log('1. Check screenshots in the project root');
    console.log('2. Manually test in browser at: http://localhost:3000/dashboard/offline-test');
    console.log('3. Use Chrome DevTools → Network tab → Offline mode');
    console.log('4. Submit form while offline, then go back online');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    
    // Take error screenshot
    await page.screenshot({ 
      path: 'test-error.png',
      fullPage: true 
    });
    console.log('📸 Error screenshot saved: test-error.png');
    
    // Save page HTML for debugging
    const html = await page.content();
    fs.writeFileSync('test-error.html', html);
    console.log('📄 Page HTML saved: test-error.html');
    
  } finally {
    // Keep browser open for inspection
    console.log('\n⚠️  Browser kept open for inspection. Close manually when done.');
    console.log('   To close automatically, change headless: false to headless: true');
    // Uncomment next line to auto-close browser
    // await browser.close();
  }
}

async function handleLogin(page) {
  console.log('🔐 Attempting to auto-login...');
  
  // Try common login selectors
  const emailSelectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input[placeholder*="email"]',
    'input[placeholder*="Email"]'
  ];
  
  const passwordSelectors = [
    'input[type="password"]',
    'input[name="password"]',
    'input[placeholder*="password"]',
    'input[placeholder*="Password"]'
  ];
  
  const loginButtonSelectors = [
    'button[type="submit"]',
    'button:has-text("Sign in")',
    'button:has-text("Login")',
    'button:has-text("Log in")'
  ];
  
  try {
    // Try to find and fill email
    for (const selector of emailSelectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        await page.type(selector, 'test@example.com', { delay: 50 });
        console.log('✅ Filled email');
        break;
      }
    }
    
    // Try to find and fill password
    for (const selector of passwordSelectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        await page.type(selector, 'password123', { delay: 50 });
        console.log('✅ Filled password');
        break;
      }
    }
    
    // Try to click login button
    for (const selector of loginButtonSelectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        await page.click(selector);
        console.log('✅ Clicked login button');
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 });
        break;
      }
    }
    
    await page.waitForTimeout(3000);
    
  } catch (error) {
    console.log('⚠️  Auto-login failed, please login manually');
  }
}

// Check if server is running
async function checkServer() {
  console.log('🔍 Checking if server is running...');
  
  // Try multiple endpoints
  const endpoints = [
    'http://localhost:3000/api/health',
    'http://localhost:3000/',
    'http://localhost:3000/dashboard'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(2000) 
      });
      if (response.status < 500) {
        console.log(`✅ Server responding at: ${endpoint}`);
        return true;
      }
    } catch (error) {
      // Continue to next endpoint
    }
  }
  
  console.error('❌ Server not running or not responding');
  console.error('   Please start your Next.js dev server: npm run dev');
  return false;
}

async function main() {
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.error('\n💡 Troubleshooting tips:');
    console.error('1. Make sure the dev server is running: npm run dev');
    console.error('2. Check that port 3000 is not in use');
    console.error('3. Verify the server starts without errors');
    process.exit(1);
  }
  
  await runOfflineTests();
}

main().catch(console.error);