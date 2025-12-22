// scripts/test-offline-simple.js
const puppeteer = require('puppeteer');
const fs = require('fs');

async function simpleOfflineTest() {
  console.log('🔧 Starting simple offline test...\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    // 1. Go to the offline test page
    console.log('1. Navigating to offline test page...');
    await page.goto('http://localhost:3000/dashboard/offline-test');
    
    // Wait and check what's on the page
    await page.waitForTimeout(3000);
    
    // Get page content for debugging
    const pageText = await page.evaluate(() => document.body.textContent);
    console.log('📄 Page text (first 500 chars):', pageText.substring(0, 500));
    
    // Check for common elements
    const hasOfflineText = pageText.includes('Offline') || pageText.includes('offline');
    const hasOnlineText = pageText.includes('Online') || pageText.includes('online');
    
    console.log(`\n2. Page analysis:`);
    console.log(`   - Has "Offline" text: ${hasOfflineText}`);
    console.log(`   - Has "Online" text: ${hasOnlineText}`);
    
    // Take screenshot
    await page.screenshot({ path: 'page-screenshot.png' });
    console.log('   - Screenshot saved: page-screenshot.png');
    
    // 3. Test offline mode
    console.log('\n3. Testing offline mode...');
    await page.setOfflineMode(true);
    await page.waitForTimeout(2000);
    
    // Reload to test offline loading
    console.log('   - Reloading page while offline...');
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 5000 });
      console.log('   ✅ Page reloaded while offline');
    } catch (e) {
      console.log('   ⚠️  Page reload failed (expected when offline)');
    }
    
    // 4. Test form submission offline
    console.log('\n4. Testing form submission...');
    
    // Look for any form
    const formInfo = await page.evaluate(() => {
      const forms = document.querySelectorAll('form');
      const inputs = document.querySelectorAll('input');
      const buttons = document.querySelectorAll('button');
      
      return {
        formCount: forms.length,
        inputCount: inputs.length,
        buttonCount: buttons.length,
        inputTypes: Array.from(inputs).map(i => i.type || i.placeholder || 'input'),
        buttonTexts: Array.from(buttons).map(b => b.textContent?.trim() || 'button')
      };
    });
    
    console.log(`   - Forms: ${formInfo.formCount}`);
    console.log(`   - Inputs: ${formInfo.inputCount}`, formInfo.inputTypes);
    console.log(`   - Buttons: ${formInfo.buttonCount}`, formInfo.buttonTexts);
    
    // Try to fill and submit if we have a form
    if (formInfo.formCount > 0) {
      console.log('   - Attempting to submit form...');
      
      // Fill first input
      if (formInfo.inputCount > 0) {
        await page.type('input:first-of-type', 'Test User');
      }
      
      // Fill second input if exists
      if (formInfo.inputCount > 1) {
        await page.type('input:nth-of-type(2)', 'test@example.com');
      }
      
      // Click first submit button
      const submitButtons = formInfo.buttonTexts
        .map((text, i) => ({ text, index: i }))
        .filter(({ text }) => 
          text.toLowerCase().includes('save') || 
          text.toLowerCase().includes('submit') ||
          text === 'button'
        );
      
      if (submitButtons.length > 0) {
        await page.evaluate((index) => {
          document.querySelectorAll('button')[index].click();
        }, submitButtons[0].index);
        
        await page.waitForTimeout(2000);
        console.log('   ✅ Form submitted (check for "Saved locally" message)');
      }
    }
    
    // 5. Go back online
    console.log('\n5. Testing online restoration...');
    await page.setOfflineMode(false);
    await page.waitForTimeout(3000);
    
    console.log('\n🎉 Test complete!');
    console.log('\n📋 What to check manually:');
    console.log('1. Open Chrome DevTools (F12)');
    console.log('2. Go to Network tab');
    console.log('3. Set to "Offline" in throttling dropdown');
    console.log('4. Go to: http://localhost:3000/dashboard/offline-test');
    console.log('5. Try submitting the form');
    console.log('6. Set back to "Online"');
    console.log('7. Watch for auto-sync');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Save error details
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: await page.url()
    };
    
    fs.writeFileSync('test-error.json', JSON.stringify(errorDetails, null, 2));
    console.log('📄 Error details saved: test-error.json');
    
  } finally {
    console.log('\n⚠️  Browser kept open for manual testing.');
    console.log('   Close it when done, or run with headless: true to auto-close.');
  }
}

// Quick server check
const http = require('http');

function quickServerCheck() {
  return new Promise((resolve) => {
    const req = http.request('http://localhost:3000', { method: 'HEAD' }, (res) => {
      resolve(true);
    });
    
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

async function main() {
  console.log('🔍 Checking server...');
  const isRunning = await quickServerCheck();
  
  if (!isRunning) {
    console.error('\n❌ Server not running!');
    console.error('Please start your Next.js app first:');
    console.error('  npm run dev\n');
    console.error('Then open: http://localhost:3000/dashboard/offline-test');
    console.error('And test manually with these steps:');
    console.error('1. Chrome DevTools → Network → Offline');
    console.error('2. Submit the form');
    console.error('3. Network → Online');
    console.error('4. Watch for auto-sync\n');
    process.exit(1);
  }
  
  console.log('✅ Server is running\n');
  await simpleOfflineTest();
}

main().catch(console.error);