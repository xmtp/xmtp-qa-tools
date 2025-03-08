import axios from "axios";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const RAILWAY_TOKEN = process.env.RAILWAY_TOKEN;
const RAILWAY_SERVICE_ID = process.env.RAILWAY_SERVICE_ID;
console.log("RAILWAY_TEAM_TOKEN", RAILWAY_TOKEN ? "is set" : "is not set");
console.log("RAILWAY_SERVICE_ID", RAILWAY_SERVICE_ID ? "is set" : "is not set");

// Deploy to Railway using their updated API v2
async function deployToRailway() {
  if (!RAILWAY_TOKEN || !RAILWAY_SERVICE_ID) {
    console.error(
      "Error: RAILWAY_TEAM_TOKEN, RAILWAY_TEAM_ID, and RAILWAY_SERVICE_ID must be set in your environment variables",
    );
    process.exit(1);
  }

  console.log("Starting deployment to Railway for team Ephemera...");

  try {
    // This matches the current Railway API v2 with team token authentication
    const graphqlQuery = {
      query: `
        mutation {
          serviceDeploymentTrigger(
            serviceId: "${RAILWAY_SERVICE_ID}"
          ) {
            id
            status
          }
        }
      `,
    };

    const response = await axios.post(
      "https://backboard.railway.app/graphql/v2",
      graphqlQuery,
      {
        headers: {
          "Content-Type": "application/json",
          "Team-Access-Token": RAILWAY_TOKEN,
        },
      },
    );

    console.log("Deployment initiated successfully!");
    console.log("Response:", JSON.stringify(response.data, null, 2));
    return response.data as {
      data: {
        serviceDeploymentTrigger: {
          id: string;
          status: string;
        };
      };
    };
  } catch (error) {
    console.error("Deployment failed:", (error as Error).message);
  }
}

void deployToRailway();
