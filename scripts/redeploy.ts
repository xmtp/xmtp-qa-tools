import axios from "axios";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const RAILWAY_SERVICE_ID = process.env.RAILWAY_SERVICE_ID;
const RAILWAY_API_TOKEN = process.env.RAILWAY_API_TOKEN;
const RAILWAY_PROJECT_TOKEN = process.env.RAILWAY_PROJECT_TOKEN;
const RAILWAY_PROJECT_ID = process.env.RAILWAY_PROJECT_ID;
const RAILWAY_ENVIRONMENT_ID = process.env.RAILWAY_ENVIRONMENT_ID;

async function main() {
  // Get the latest deployment
  const latestDeployment = await getLatestDeployment();
  if (!latestDeployment) {
    console.error("Failed to get latest deployment");
    return false;
  }

  console.log("Latest deployment:", latestDeployment);

  // Redeploy the deployment
  const redeployResult = await redeployDeployment(latestDeployment.id);
  if (redeployResult === null) {
    console.error("Failed to redeploy deployment");
    return false;
  }

  console.log("Deployment redeploy initiated successfully!");
  return true;
}

void main();

async function testConnection() {
  console.log("Testing Railway API connection...");

  const testQuery = {
    query: `query { me { name email } }`,
  };

  const response = await axios.post(
    "https://backboard.railway.com/graphql/v2",
    testQuery,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RAILWAY_API_TOKEN}`,
      },
    },
  );

  console.log("Connection successful!");
  console.log("User info:", response.RAILWAY_PROJECT_TOKEN);
  return true;
}

async function getProjectInfo() {
  console.log("Getting project information using Project Access Token...");

  if (!RAILWAY_PROJECT_TOKEN) {
    console.error(
      "Error: RAILWAY_PROJECT_TOKEN is not set in your environment variables",
    );
    return null;
  }

  const projectQuery = {
    query: `query { projectToken { projectId environmentId } }`,
  };

  const response = await axios.post(
    "https://backboard.railway.app/graphql/v2",
    projectQuery,
    {
      headers: {
        "Content-Type": "application/json",
        "Project-Access-Token": RAILWAY_PROJECT_TOKEN,
      },
    },
  );

  console.log("Project info retrieved successfully!");
  console.log("Project info:", response.data);
  return response.data!.data!.projectToken;
}

async function getLatestDeployment() {
  console.log("Getting latest deployment...");

  // Use the exact query format provided but with proper authentication
  const getDeploymentQuery = {
    query: `
      query deployments {
        deployments(
          first: 1
          input: {
            projectId: "${RAILWAY_PROJECT_ID}"
            environmentId: "${RAILWAY_ENVIRONMENT_ID}"
            serviceId: "${RAILWAY_SERVICE_ID}"
          }
        ) {
          edges {
            node {
              id
              staticUrl
            }
          }
        }
      }
    `,
  };

  // Try with the API token instead of the project token
  const response = await axios.post(
    "https://backboard.railway.com/graphql/v2", // Use .com like in the successful testConnection
    getDeploymentQuery,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RAILWAY_API_TOKEN}`,
      },
    },
  );

  console.log("Response:", response.data);
  const deployment = response.data.data.deployments.edges[0]?.node;
  return deployment;
}

async function redeployDeployment(deploymentId: string) {
  console.log(`Redeploying deployment with ID: ${deploymentId}...`);

  if (!RAILWAY_API_TOKEN) {
    console.error(
      "Error: RAILWAY_API_TOKEN is not set in your environment variables",
    );
    return null;
  }

  const redeployMutation = {
    query: `
      mutation deploymentRedeploy {
        deploymentRedeploy(id: "${deploymentId}") {
          id
          status
          staticUrl
        }
      }
    `,
  };

  const response = await axios.post(
    "https://backboard.railway.com/graphql/v2",
    redeployMutation,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RAILWAY_API_TOKEN}`,
      },
    },
  );

  console.log("Deployment redeploy successful!");
  console.log("Response:", response.data);
  return response.data.data.deploymentRedeploy;
}
