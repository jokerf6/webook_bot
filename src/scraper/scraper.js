import puppeteer, { executablePath } from "puppeteer";
import { findColorPixel } from "./util.js";
import { sendMessage, sendPhoto } from "../bot/bot.js";
import fs from "fs";
import { getPaletteFromURL } from "color-thief-node";
import sharp from "sharp";
import { getEventKey } from "../rest/event-key.js";

const browserOptions = {
  headless: false,
  // executablePath: "/usr/bin/chromium-browser",
  // args: [
  //   "--no-sandbox",
  //   "--headless",
  //   "--disable-gpu",
  //   "--disable-dev-shm-usage",
  // ],
};

export async function loginAndCheckSuccess(email, password) {
  let browser, page;

  try {
    browser = await puppeteer.launch(browserOptions);
    page = await browser.newPage();

    await page.goto("https://webook.com/en/login");
    await page.waitForSelector("button.bg-primary", { timeout: 10000 });

    await page.click("button.bg-primary");

    await page.waitForSelector('input[name="email"]');

    await page.type('input[name="email"]', email);
    await page.type('input[name="password"]', password);
    await page.click("#email-login-button");

    try {
      await page.waitForNavigation({ timeout: 5000 });
      return true;
    } catch (err) {
      return false;
    }
  } catch (error) {
    console.error("Error during login:", error);
    return false;
  } finally {
    if (browser) await browser.close();
  }
}

export async function scrape(matchId, team, email, password, photo, chatId) {
  let browser, page;

  try {
    browser = await puppeteer.launch(browserOptions);
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1200 });

    await page.goto(`https://webook.com/en/events/${matchId}/book`, {
      waitUntil: "networkidle2",
    });

    try {
      await page.waitForSelector("button.bg-primary", { timeout: 30000 }); // Increased timeout
      await page.click("button.bg-primary");
    } catch (err) {
      await page.screenshot({
        path: "error_screenshot.png",
        clip: {
          x: 29,
          y: 147,
          width: 759,
          height: 564,
        },
      }); // Take a screenshot for debugging
      throw new Error("Failed to find or click button.bg-primary");
    }

    await page.waitForSelector('input[name="email"]');
    await page.type('input[name="email"]', email);
    await page.type('input[name="password"]', password);
    await page.click("#email-login-button");

    await page.waitForSelector('button[name="favorite_team"]');
    const buttons = await page.$$('button[name="favorite_team"]');

    const buttonSelector = `button[name="favorite_team"]:nth-of-type(${
      team + 1
    })`;
    const targetButton = await page.$(buttonSelector);

    const ariaChecked = await targetButton.evaluate((button) =>
      button.getAttribute("aria-checked")
    );

    if (ariaChecked === "false") {
      await page.click(buttonSelector);
    }

    await page.click('input[name="team_terms"]');
    await page.click('button[type="submit"]');
    await page.waitForSelector("#booking-section-ref iframe", {
      timeout: 30000,
    }); // Increased timeout
    await new Promise((resolve) => setTimeout(resolve, 10000));

    await page.screenshot({
      path: "screenshot.png",
      clip: {
        x: 29,
        y: 147,
        width: 759,
        height: 564,
      },
    });
    getColorsFromImage("../../screenshot.png").then((colors) => {
      console.log("Extracted colors:", colors);
    });
    let ColorNow = "";
    const targetColor = [
      { name: "CAT3", color: "#c90a24" },
      { name: "CAT2", color: "#4176a5" },
      { name: "CAT1", color: "#4f1b64" },
      { name: "Premium", color: "#04965e" },
    ];
    let coordinates;
    for (let i = 0; i < targetColor.length; i += 1) {
      ColorNow = targetColor[i];
      coordinates = await findColorPixel(
        "screenshot.png",
        targetColor[i].color
      );
      if (coordinates) {
        console.log(ColorNow);
        break;
      }
    }

    if (coordinates) {
      await page.mouse.click(coordinates.x + 29 + 5, coordinates.y + 147 + 5);
    } else {
      await sendMessage(
        chatId,
        `There are no tickets available for booking in the blocks Cat1, Cat2, Cat3, and Premium`
      );
      return null;
    }
    await new Promise((resolve) => setTimeout(resolve, 10000));

    try {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await page.screenshot({
        path: "screenshot.png",
        clip: {
          x: 29,
          y: 147,
          width: 759,
          height: 564,
        },
      });

      await page.waitForSelector("#booking-section-ref iframe", {
        timeout: 30000,
      }); // Increased timeout
      const iframeElement = await page.$("#booking-section-ref iframe");
      const iframe = await iframeElement.contentFrame();

      await iframe.waitForSelector("body");
      await iframe.waitForSelector(
        "button.circleButton.plus.icon-plus.highlighted",
        { timeout: 30000 }
      ); // Increased timeout

      let numOfTickets = 0;
      for (let i = 0; i < 10; i += 1) {
        await iframe.click("button.circleButton.plus.icon-plus.highlighted");
        numOfTickets += 1;
        const isButtonDisabled = await iframe.evaluate(() => {
          const button = document.querySelector(
            "button.circleButton.plus.icon-plus.highlighted"
          );
          return button.disabled; // Or any condition that indicates the button cannot be clicked
        });

        // If the button is disabled, break out of the loop
        if (isButtonDisabled) {
          break;
        }
      }
      await iframe.waitForSelector("div.button .caption");
      await iframe.click("div.button .caption");
      await page.waitForSelector('input[type="checkbox"].bg-body');

      const checkboxes = await page.$$('input[type="checkbox"].bg-body');
      for (let i = 0; i < 2; i++) {
        await checkboxes[i].click();
      }

      await page.waitForSelector("#proceed-to-payment");
      await page.click("#proceed-to-payment");
      await page.waitForSelector(".pt_container"); // Replace with a specific selector from your page

      return {
        url: page.url(),
        block: ColorNow.name,
        photo,
        numOfTickets,
      };
    } catch (err) {
      await page.screenshot({
        path: "screenshot.png",
        clip: {
          x: 29,
          y: 147,
          width: 759,
          height: 564,
        },
      });
      console.log(ColorNow);
      coordinates = await findColorPixel("screenshot.png", ColorNow.color);

      if (coordinates) {
        await page.mouse.click(coordinates.x + 29, coordinates.y + 147);
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await page.screenshot({
        path: "screenshot.png",
        clip: {
          x: 29,
          y: 147,
          width: 759,
          height: 564,
        },
      });

      await page.waitForSelector("#booking-section-ref iframe", {
        timeout: 30000,
      }); // Increased timeout
      const iframeElement = await page.$("#booking-section-ref iframe");
      const iframe = await iframeElement.contentFrame();

      await iframe.waitForSelector("body");
      await iframe.waitForSelector(
        "button.circleButton.plus.icon-plus.highlighted"
      );

      let numOfTickets = 0;
      for (let i = 0; i < 10; i += 1) {
        await iframe.click("button.circleButton.plus.icon-plus.highlighted");
        numOfTickets += 1;
        const isButtonDisabled = await iframe.evaluate(() => {
          const button = document.querySelector(
            "button.circleButton.plus.icon-plus.highlighted"
          );
          return button.disabled; // Or any condition that indicates the button cannot be clicked
        });

        // If the button is disabled, break out of the loop
        if (isButtonDisabled) {
          break;
        }
      }
      await iframe.waitForSelector("div.button .caption");
      await iframe.click("div.button .caption");
      await page.waitForSelector('input[type="checkbox"].bg-body');

      const checkboxes = await page.$$('input[type="checkbox"].bg-body');
      for (let i = 0; i < 2; i++) {
        await checkboxes[i].click();
      }

      await page.waitForSelector("#proceed-to-payment");
      await page.click("#proceed-to-payment");
      await page.waitForSelector(".pt_container"); // Replace with a specific selector from your page

      return {
        url: page.url(),
        block: ColorNow.name,
        photo,
        numOfTickets,
      };
    }
  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    if (browser) await browser.close();
  }
}
export async function TeamsOfMatch(id) {
  let browser, page;

  try {
    browser = await puppeteer.launch(browserOptions);
    page = await browser.newPage();
    await page.goto(`https://webook.com/en/events/${id}/book`);
    await page.waitForSelector("button.bg-primary", { timeout: 30000 });
    await page.click("button.bg-primary");
    await page.waitForSelector('input[name="email"]');

    await page.type('input[name="email"]', process.env.EMAIL);
    await page.type('input[name="password"]', process.env.PASSWORD);
    await page.click("#email-login-button");

    await page.waitForSelector('button[name="favorite_team"]');
    const buttons = await page.$$('button[name="favorite_team"]');
    const teams = [];

    for (let i = 0; i < buttons.length; i++) {
      const buttonText = await buttons[i].evaluate((node) => node.innerText);
      teams.push({ id, idx: i, name: buttonText });
    }

    return teams;
  } catch (error) {
    console.error("Error in TeamsOfMatch:", error);
    return [];
  } finally {
    await browser.close();
  }
}

async function getColorsFromImage(imagePath) {
  try {
    // Ensure the image exists
    if (!fs.existsSync(imagePath)) {
      throw new Error("Image not found");
    }

    // Resize the image for faster processing (optional)
    const resizedImage = await sharp(imagePath)
      .resize(100) // Resize to 100px width while maintaining aspect ratio
      .toBuffer();

    // Use Color Thief to extract colors
    const palette = await getPaletteFromURL(resizedImage, 20); // Get a palette of 5 colors

    return palette.map((color) => `rgb(${color[0]}, ${color[1]}, ${color[2]})`);
  } catch (error) {
    console.error("Error extracting colors:", error);
  }
}

export async function getTickets(chatId, matchId, item) {
  let browser, page;

  try {
    browser = await puppeteer.launch(browserOptions);
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1200 });

    await page.goto(`https://webook.com/en/events/${matchId}/book`, {
      waitUntil: "networkidle2",
    });

    try {
      await page.waitForSelector("button.bg-primary", { timeout: 30000 }); // Increased timeout
      await page.click("button.bg-primary");
    } catch (err) {
      await page.screenshot({
        path: "error_screenshot.png",
        clip: {
          x: 29,
          y: 147,
          width: 759,
          height: 564,
        },
      }); // Take a screenshot for debugging
      throw new Error("Failed to find or click button.bg-primary");
    }

    await page.waitForSelector('input[name="email"]');
    await page.type('input[name="email"]', process.env.email);
    await page.type('input[name="password"]', process.env.password);
    await page.click("#email-login-button");
    try {
      await page.waitForSelector('button[name="favorite_team"]', {
        timeout: 30000,
      });
      console.log("ho");

      const buttonSelector = `button[name="favorite_team"]:nth-of-type(0)`;
      console.log(buttonSelector);
      if (buttonSelector) {
        const targetButton = await page.$(buttonSelector);
      }
      const ariaChecked = await targetButton.evaluate((button) =>
        button.getAttribute("aria-checked")
      );

      if (ariaChecked === "false") {
        await page.click(buttonSelector);
      }

      await page.click('input[name="team_terms"]');
      await page.click('button[type="submit"]');
      await page.waitForSelector("#booking-section-ref iframe", {
        timeout: 30000,
      }); // Increased timeout
      await new Promise((resolve) => setTimeout(resolve, 10000));

      await page.screenshot({
        path: "screenshot.png",
        clip: {
          x: 54,
          y: 186,
          width: 797,
          height: 804,
        },
      });
    } catch (err) {
      // await getColorsFromImage("./screenshot.png").then((colors) => {
      //   console.log("Extracted colors:", colors);
      // });
      console.log("fuck");
      await page.reload({ waitUntil: "networkidle0" });

      await new Promise((resolve) => setTimeout(resolve, 5000));
      await page.reload({ waitUntil: "networkidle0" });

      let screenshotTaken = false;
      let retryCount = 0;
      const maxRetries = 3;

      while (!screenshotTaken && retryCount < maxRetries) {
        try {
          await page.screenshot({
            path: "screenshot.png",
            clip: {
              x: 54,
              y: 186,
              width: 797,
              height: 804,
            },
          });
          screenshotTaken = true;
        } catch (error) {
          console.log(
            `Screenshot failed. Retrying... (${retryCount + 1}/${maxRetries})`
          );
          await page.reload({ waitUntil: "networkidle0" });
          await new Promise((resolve) => setTimeout(resolve, 5000));
          retryCount++;
        }
      }

      if (!screenshotTaken) {
        console.error("Failed to take screenshot after multiple attempts");
      }
      const data = await getEventKey(matchId);
      const match = await getColors(data.data.seats_io.event_key);
      const uniqueColors = Array.from(
        match.categories
          .reduce((acc, item) => {
            if (!acc.has(item.color)) {
              acc.set(item.color, item);
            }
            return acc;
          }, new Map())
          .values()
      );
      const MyColors = await GetColors(chatId, matchId);
      console.log(matchId);
      console.log(MyColors);
      let extractedColors = [];
      for (let i = 0; i < uniqueColors.length; i += 1) {
        console.log(uniqueColors[i].color);
        const exist = await findColorPixel(
          "./screenshot.png",
          uniqueColors[i].color
        );
        if (exist) extractedColors.push(uniqueColors[i].color);
      }
      console.log(extractedColors);
      const newColors = extractedColors.filter(
        (uniqueColor) =>
          !MyColors.some((myColor) => myColor.color === uniqueColor)
      );

      if (newColors.length > 0 && MyColors.length > 0) {
        const imageUrl = item.image31?.url || item.image11?.url;

        // You can add logic here to handle the new colors, such as sending a notification
        await sendPhoto(chatId, imageUrl, {
          caption: `New ticket categories available for ${item.title}. You can book it from here: https://webook.com/en/events/${item.ticketingUrlSlug}/book`,
        });

        // Update the colors in the database
        await DeleteColors(chatId, matchId);
        await InsertColors(chatId, matchId, uniqueColors);
      } else if (MyColors.length === 0) {
        await InsertColors(chatId, matchId, uniqueColors);
      }

      // if (currentColors.length === 0) {
      //   await InsertColors(chatId, matchId, ExtractedColors);
      // } else {
      //   const newColors = ExtractedColors.filter(
      //     (color) => !currentColors.includes(color)
      //   );
      //   if (newColors.length !== 0) {
      //     await sendPhoto(chatId, "./screenshot.png", {
      //       caption: `Tickets for ${item.title} are updated. You can boot it from here https://webook.com/en/events/${item.ticketingUrlSlug}/book`,
      //       // ...getTeamsInlineKeyboard(teams),
      //     });
      //   }
      //   await DeleteColors(chatId, matchId);
      //   await InsertColors(chatId, matchId, ExtractedColors);
      // }
    }
  } catch (err) {
    console.log(err);
  } finally {
    await browser.close();
  }
}

// { key: 8, label: "The Terrace", color: "#00FF00", accessible: false },
