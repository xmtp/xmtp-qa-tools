import axios from "axios";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const RAILWAY_SERVICE_ID = process.env.RAILWAY_SERVICE_ID;
const RAILWAY_API_TOKEN = process.env.RAILWAY_API_TOKEN;
console.log("RAILWAY_SERVICE_ID", RAILWAY_SERVICE_ID ? "is set" : "is not set");
console.log("RAILWAY_API_TOKEN", RAILWAY_API_TOKEN ? "is set" : "is not set");

// Deploy to Railway using their updated API
async function deployToRailway() {
  if (!RAILWAY_SERVICE_ID || !RAILWAY_API_TOKEN) {
    console.error(
      "Error: RAILWAY_SERVICE_ID and RAILWAY_API_TOKEN must be set in your environment variables",
    );
    process.exit(1);
  }

  console.log("Starting deployment to Railway...");

  try {
    // This matches the current Railway API (as of March 2025)
    // Based on https://docs.railway.com/guides/manage-deployments
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
      "https://backboard.railway.app/graphql",
      graphqlQuery,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RAILWAY_API_TOKEN}`,
        },
      },
    );

    console.log("Deployment initiated successfully!");
    console.log("Response:", JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error as Unkon) {
    console.error("Deployment failed:");
    if (error.response) {
      console.error(
        "Response data:",
        JSON.stringify(error.response.data, null, 2),
      );
      console.error("Response status:", error.response.status);
      console.error(
        "Response headers:",
        JSON.stringify(error.response.headers, null, 2),
      );
    } else if (error.request) {
      console.error("No response received:", error.request);
    } else {
      console.error("Error message:", error.message);
    }
    process.exit(1);
  }
}

// Execute the deployment
deployToRailway()
  .then(() => {
    console.log("Deployment process completed");
  })
  .catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
  });
