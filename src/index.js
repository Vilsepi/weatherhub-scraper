"use strict";

const puppeteer = require('puppeteer');
const fs = require('fs').promises;

const options = {
  width: 1024,
  height: 768
};

const getNewPage = async (browser) => {
  const page = await browser.newPage();
  page.setViewport({
    width: options.width,
    height: options.height,
    deviceScaleFactor: 1,
  });
  return page;
}

const loginOrUseExistingSession = async (page) => {
  const url = "https://www.wh-observer.de/devices";
  const filePath = "./secret-cookies.json";
  try {
    const cookiesString = await fs.readFile(filePath);
    const cookies = JSON.parse(cookiesString);

    if (cookies[0].name == ".ASPXAUTH" && cookies[1].name == "ARRAffinity") {
      console.log("Found existing cookies from storage, enabling them...");
      await page.setCookie(...cookies);
      console.log("Cookies set, loading device list");
      await page.goto(url);
      await page.waitFor('#devicelist');
      console.log("Successfully logged in using existing cookies.");
    }
    else {
      throw new Error('Ate a bad cookie.');;
    }
  } catch (error) {
    console.log("Could not find existing cookies from storage.");
    await page.goto(url);
    await page.waitFor('#Username');
    await page.type('#Username', process.env.WEATHERHUB_USERNAME);
    await page.type('#Password', process.env.WEATHERHUB_PASSWORD);
    await page.click('[type="submit"]');
    console.log("Filled login credentials, logging in...");
    await page.waitFor('#devicelist');
    console.log("Successfully logged in, storing cookies for later use.");
    const cookies = await page.cookies();
    await fs.writeFile(filePath, JSON.stringify(cookies, null, 2));
  }
}

const listTemps = async (page) => {
  const devices = await page.$$('.card');
  for(const device of devices){
    const site_name = await device.$eval('div.main > article > h4', el => el.innerText);
    const inside_temp = await device.$eval('div.sensor > h5.Temperature1', el => el.innerText);
    const outside_temp = await device.$eval('div.sensor > h5.Temperature2', el => el.innerText);

    console.log(site_name + ": sisällä: " + inside_temp + " ulkona: " + outside_temp);
  }
}

const main = async () => {
  if (!process.env.WEATHERHUB_USERNAME || !process.env.WEATHERHUB_PASSWORD) {
    console.error("Error: Credentials are not set as environment variables.");
    return;
  }

  const browser = await puppeteer.launch();
  const page = await getNewPage(browser);
  await loginOrUseExistingSession(page);
  await listTemps(page);

  await page.screenshot({path: 'test.png'});
  await browser.close();
}

try {
  main();
} catch (e) {
  console.error(e);
}
