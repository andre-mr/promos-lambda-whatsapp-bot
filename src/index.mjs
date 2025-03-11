import { updateGroupsAndLinks } from "./database.mjs";

export const handler = async (event) => {
  try {
    // API Key verification
    let providedApiKey = "";
    const expectedApiKey = process.env.API_KEY;

    if (event.credentials) {
      providedApiKey = event.credentials.apiKey;
    } else {
      providedApiKey = event.headers?.["x-api-key"] || event.headers?.["X-Api-Key"];
    }

    if (!expectedApiKey) {
      console.warn("API_KEY environment variable is not set");
    }

    if (!providedApiKey || providedApiKey !== expectedApiKey) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Unauthorized: Invalid or missing API key",
        }),
      };
    }

    if (!event.body) {
      throw new Error("Missing request body");
    }

    const payload = JSON.parse(event.body);
    const result = await updateGroupsAndLinks(payload, event);

    const groupsSuccess = result.groups && !result.groups.$metadata?.error;
    const linksSuccess = result.inviteLinks && !result.inviteLinks.$metadata?.error;

    let message;
    let statusCode = 200;

    if (groupsSuccess && linksSuccess) {
      message = "Groups and invite links updated successfully";
    } else if (groupsSuccess) {
      message = "Groups updated successfully, but invite links update failed";
      statusCode = 207;
      console.log(message);
    } else if (linksSuccess) {
      message = "Invite links updated successfully, but groups update failed";
      statusCode = 207;
      console.log(message);
    } else {
      message = "Failed to update groups and invite links";
      statusCode = 500;
      console.error(message);
    }

    return {
      statusCode,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        details: {
          groupsSuccess,
          linksSuccess,
        },
      }),
    };
  } catch (error) {
    return {
      statusCode: error.statusCode || 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Error processing request",
        error: error.message,
      }),
    };
  }
};
