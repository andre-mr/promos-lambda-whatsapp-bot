import { jest } from "@jest/globals";
import { handler } from "../src/handler.mjs";
import dotenv from "dotenv";
dotenv.config();

// Mock AWS SDK modules
jest.mock("@aws-sdk/client-dynamodb", () => {
  return {
    DynamoDBClient: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
  };
});

jest.mock("@aws-sdk/lib-dynamodb", () => {
  return {
    DynamoDBDocumentClient: {
      from: jest.fn().mockReturnValue({
        send: jest.fn().mockResolvedValue({ UnprocessedItems: {} }),
      }),
    },
    BatchWriteCommand: jest.fn().mockImplementation((params) => params),
  };
});

const credentials = {
  accessKeyId: process.env.AMAZON_ACCESS_KEY_ID,
  secretAccessKey: process.env.AMAZON_SECRET_ACCESS_KEY,
};

// Simplified events for testing - only including what the handler actually uses
const events = {
  basicRequest: {
    body: JSON.stringify({
      groups: [
        {
          SK: "111111111111111111@g.us",
          Name: "Test Group 1",
          TotalMembers: 200,
        },
        {
          SK: "222222222222222222@g.us",
          InviteCode: "xpto2xpto",
          Name: "Test Group 2",
          TotalMembers: 100,
        },
        {
          SK: "333333333333333333@g.us",
          InviteCode: "xpto3xpto",
          Name: "Test Group 3",
          TotalMembers: 500,
        },
        {
          SK: "444444444444444444@g.us",
          InviteCode: "xpto4xpto",
          Name: "Test Group 4",
          TotalMembers: 300,
        },
        {
          SK: "555555555555555555@g.us",
          InviteCode: "xpto5xpto",
          Name: "Test Group 5",
          TotalMembers: 400,
        },
      ],
      domain: "promos.com.br",
    }),
    credentials,
  },
  errorRequest: {
    body: "invalid-json",
    credentials,
  },
  invalidGroupsRequest: {
    body: JSON.stringify({
      groups: "not-an-array",
    }),
    credentials,
  },
  emptyBodyRequest: {
    credentials,
  },
};

describe("Lambda Handler Tests", () => {
  beforeEach(() => {
    // Setup environment variables required by the handler
    process.env.AMAZON_REGION = process.env.AMAZON_REGION;
    process.env.AMAZON_DYNAMODB_TABLE = process.env.AMAZON_DYNAMODB_TABLE;

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test("should successfully update groups", async () => {
    const response = await handler(events.basicRequest);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe("Groups and invite links updated successfully");
  });

  test("should handle invalid JSON in request body", async () => {
    const response = await handler(events.errorRequest);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toHaveProperty("error");
  });

  test("should handle invalid groups format", async () => {
    const response = await handler(events.invalidGroupsRequest);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toHaveProperty("error");
  });

  test("should handle missing body", async () => {
    const response = await handler(events.emptyBodyRequest);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).error).toBe("Missing request body");
  });

  test("should handle missing AMAZON_REGION", async () => {
    delete process.env.AMAZON_REGION;

    const response = await handler(events.basicRequest);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).error).toBe("AMAZON_REGION is required");
  });

  test("should handle missing AMAZON_DYNAMODB_TABLE", async () => {
    delete process.env.AMAZON_DYNAMODB_TABLE;

    const response = await handler(events.basicRequest);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).error).toBe("AMAZON_DYNAMODB_TABLE is required");
  });
});
