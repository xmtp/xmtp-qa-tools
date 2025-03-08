import axios from "axios";

const RAILWAY_SERVICE_ID = process.env.RAILWAY_SERVICE_ID;
const RAILWAY_API_TOKEN = process.env.RAILWAY_API_TOKEN;
const RAILWAY_PROJECT_ID = process.env.RAILWAY_PROJECT_ID;
const RAILWAY_ENVIRONMENT_ID = process.env.RAILWAY_ENVIRONMENT_ID;

export async function getLatestDeployment() {
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

export async function redeployDeployment(deploymentId: string) {
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
