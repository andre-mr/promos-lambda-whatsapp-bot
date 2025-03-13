import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

let docClient = null;
let AMAZON_DYNAMODB_TABLE = null;

export const initializeClient = (event = {}) => {
  if (!process.env.AMAZON_REGION) {
    throw new Error("AMAZON_REGION is required");
  }

  if (!process.env.AMAZON_DYNAMODB_TABLE) {
    throw new Error("AMAZON_DYNAMODB_TABLE is required");
  }

  AMAZON_DYNAMODB_TABLE = process.env.AMAZON_DYNAMODB_TABLE;

  const config = {
    region: process.env.AMAZON_REGION,
  };

  // Only use credentials if provided in the event object (for testing)
  if (event.credentials) {
    config.credentials = {
      accessKeyId: event.credentials.accessKeyId,
      secretAccessKey: event.credentials.secretAccessKey,
    };
  }

  const client = new DynamoDBClient(config);
  docClient = DynamoDBDocumentClient.from(client);
};

export const updateGroupsAndLinks = async (payload, event = {}) => {
  initializeClient(event);

  if (!payload.groups || !Array.isArray(payload.groups) || payload.groups.length === 0) {
    throw new Error("Invalid groups data");
  }

  const domain = payload.domain || "DEFAULT";

  const groupsResult = await updateGroups(payload.groups);
  const linksResult = await updateInviteLinks(payload.groups, domain);

  return {
    groups: groupsResult,
    inviteLinks: linksResult,
  };
};

export const updateGroups = async (groups) => {
  const timestamp = new Date().toISOString();
  const items = groups
    .filter((group) => {
      return (
        group.SK &&
        typeof group.SK === "string" &&
        group.SK.trim() !== "" &&
        group.Name &&
        typeof group.Name === "string" &&
        group.Name.trim() !== "" &&
        typeof group.TotalMembers === "number" &&
        group.TotalMembers >= 0
      );
    })
    .map((group) => ({
      PK: "WHATSAPP#GROUP",
      SK: group.SK,
      Name: group.Name,
      InviteCode: group.InviteCode || "",
      TotalMembers: group.TotalMembers,
      Updated: group.Updated || timestamp,
    }));

  if (items.length === 0) {
    console.error("No valid groups to update");
    return null;
  }

  const batchItems = {
    RequestItems: {
      [AMAZON_DYNAMODB_TABLE]: items.map((item) => ({
        PutRequest: { Item: item },
      })),
    },
  };

  const result = await docClient.send(new BatchWriteCommand(batchItems));
  return result;
};

export const updateInviteLinks = async (groups, domain = "DEFAULT") => {
  const validGroups = groups.filter(
    (group) =>
      group.SK &&
      typeof group.SK === "string" &&
      group.SK.trim() !== "" &&
      group.InviteCode &&
      typeof group.InviteCode === "string" &&
      group.InviteCode.trim() !== "" &&
      typeof group.TotalMembers === "number"
  );

  if (validGroups.length === 0) {
    console.error("No valid groups with invite codes");
    return null;
  }

  const sortedGroups = validGroups.sort((a, b) => a.TotalMembers - b.TotalMembers);

  let selectedGroups;
  if (sortedGroups.length > 10) {
    selectedGroups = sortedGroups.slice(0, 10);
  } else if (sortedGroups.length > 2) {
    selectedGroups = sortedGroups.slice(0, 2);
  } else {
    selectedGroups = sortedGroups;
  }

  // Format invite codes as "groupid:groupname:code"
  const inviteCodes = selectedGroups.map((group) => `${group.SK}|${group.Name}|${group.InviteCode}`);

  const timestamp = new Date().toISOString();
  const item = {
    PK: "WHATSAPP#INVITELINKS",
    SK: domain.toUpperCase().split(".")[0],
    InviteCodes: inviteCodes,
    Updated: timestamp,
  };

  const params = {
    TableName: AMAZON_DYNAMODB_TABLE,
    Item: item,
  };

  const result = await docClient.send(new PutCommand(params));
  return result;
};
