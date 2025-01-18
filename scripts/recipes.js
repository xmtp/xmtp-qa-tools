import { execSync } from "child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs";
import { select } from "@clack/prompts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add a flag to prevent multiple executions
let isRunning = false;

const recipesDir = path.resolve(__dirname, "../recipes");
const recipes = fs.readdirSync(recipesDir).filter((file) => {
  return (
    fs.statSync(path.join(recipesDir, file)).isDirectory() &&
    file !== "replit" &&
    file !== "railway"
  );
});

async function runSelectedRecipe() {
  // Prevent multiple executions
  if (isRunning) {
    console.log("Development server is already running.");
    return;
  }

  // Get template from command line argument if provided
  const directRecipe = process.argv[2];

  let selectedRecipe;
  if (directRecipe && recipes.includes(directRecipe)) {
    selectedRecipe = directRecipe;
  } else {
    selectedRecipe = await select({
      message: "Select a recipe to run:",
      options: recipes.map((recipe) => ({
        value: recipe,
        label: recipe,
      })),
    });
  }

  if (typeof selectedRecipe === "symbol" || !selectedRecipe) {
    console.log("No recipe selected. Exiting.");
    return;
  }

  const recipePath = path.resolve(__dirname, `../recipes/${selectedRecipe}`);

  try {
    isRunning = true;
    console.log(`Running recipe for ${selectedRecipe}...`);
    execSync(`cd ${recipePath} && yarn dev`, {
      stdio: "inherit",
    });
  } catch (error) {
    console.error(`Error running recipe for ${selectedRecipe}:`, error);
  } finally {
    isRunning = false;
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${__filename}`) {
  runSelectedRecipe();
}
