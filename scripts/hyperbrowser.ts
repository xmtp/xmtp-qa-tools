// import { Hyperbrowser } from "@hyperbrowser/sdk";
// import { connect } from "puppeteer-core";

// const client = new Hyperbrowser({
//   apiKey: process.env.HYPERBROWSER_API_KEY as string,
// });

// const main = async () => {
//   const location = process.argv[2];
//   if (!location) {
//     console.error("Please provide a location as a command line argument");
//     process.exit(1);
//   }

//   console.log("Starting session");
//   const session = await client.sessions.create();
//   console.log("Session created:", session.id);

//   try {
//     const browser = await connect({ browserWSEndpoint: session.wsEndpoint });

//     const [page] = await browser.pages();

//     await page.goto("https://openweathermap.org/city", {
//       waitUntil: "load",
//       timeout: 20_000,
//     });
//     await page.waitForSelector(".search-container", {
//       visible: true,
//       timeout: 10_000,
//     });
//     await page.type(".search-container input", location);
//     await page.click(".search button");
//     await page.waitForSelector(".search-dropdown-menu", {
//       visible: true,
//       timeout: 10_000,
//     });

//     const [response] = await Promise.all([
//       page.waitForNavigation(),
//       page.click(".search-dropdown-menu li:first-child"),
//     ]);

//     await page.waitForSelector(".current-container", {
//       visible: true,
//       timeout: 10_000,
//     });
//     const locationName = await page.$eval(
//       ".current-container h2",
//       (el) => el.textContent,
//     );
//     const currentTemp = await page.$eval(
//       ".current-container .current-temp",
//       (el) => el.textContent,
//     );
//     const description = await page.$eval(
//       ".current-container .bold",
//       (el) => el.textContent,
//     );

//     const windInfo = await page.$eval(".weather-items .wind-line", (el) =>
//       el.textContent.trim(),
//     );
//     const pressureInfo = await page.$eval(
//       ".weather-items li:nth-child(2)",
//       (el) => el.textContent.trim(),
//     );
//     const humidityInfo = await page.$eval(
//       ".weather-items li:nth-child(3)",
//       (el) => el.textContent.trim()?.split(":")[1],
//     );
//     const dewpoint = await page.$eval(
//       ".weather-items li:nth-child(4)",
//       (el) => el.textContent.trim()?.split(":")[1],
//     );
//     const visibility = await page.$eval(
//       ".weather-items li:nth-child(5)",
//       (el) => el.textContent.trim()?.split(":")[1],
//     );

//     console.log("\nWeather Information:");
//     console.log("------------------");
//     console.log(`Location: ${locationName}`);
//     console.log(`Temperature: ${currentTemp}`);
//     console.log(`Conditions: ${description}`);
//     console.log(`Wind: ${windInfo}`);
//     console.log(`Pressure: ${pressureInfo}`);
//     console.log(`Humidity: ${humidityInfo}`);
//     console.log(`Dew Point: ${dewpoint}`);
//     console.log(`Visibility: ${visibility}`);
//     console.log("------------------\n");

//     await page.screenshot({ path: "screenshot.png" });
//     process.exit(0);
//     await page.close();
//     await browser.close();
//   } catch (error) {
//     console.error(`Encountered an error: ${error}`);
//   } finally {
//     await client.sessions.stop(session.id);
//     console.log("Session stopped:", session.id);
//   }
// };

//main().catch(console.error);
