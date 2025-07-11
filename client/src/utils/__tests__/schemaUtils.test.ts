import {
  generateDefaultValue,
  formatFieldLabel,
  cacheToolOutputSchemas,
  getToolOutputValidator,
  validateToolOutput,
  hasOutputSchema,
} from "../schemaUtils";
import type { JsonSchemaType } from "../jsonUtils";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

describe("generateDefaultValue", () => {
  test("generates default string", () => {
    const parentSchema = { type: "object" as const, required: ["testProp"] };
    expect(
      generateDefaultValue({ type: "string" }, "testProp", parentSchema),
    ).toBe("");
  });

  test("generates default number", () => {
    const parentSchema = { type: "object" as const, required: ["testProp"] };
    expect(
      generateDefaultValue({ type: "number" }, "testProp", parentSchema),
    ).toBe(0);
  });

  test("generates default integer", () => {
    const parentSchema = { type: "object" as const, required: ["testProp"] };
    expect(
      generateDefaultValue({ type: "integer" }, "testProp", parentSchema),
    ).toBe(0);
  });

  test("generates default boolean", () => {
    const parentSchema = { type: "object" as const, required: ["testProp"] };
    expect(
      generateDefaultValue({ type: "boolean" }, "testProp", parentSchema),
    ).toBe(false);
  });

  test("generates default array", () => {
    expect(generateDefaultValue({ type: "array" })).toEqual([]);
  });

  test("generates default empty object", () => {
    expect(generateDefaultValue({ type: "object" })).toEqual({});
  });

  test("generates default null for unknown types", () => {
    // @ts-expect-error Testing with invalid type
    expect(generateDefaultValue({ type: "unknown" })).toBe(undefined);
  });

  test("generates empty array for non-required array", () => {
    expect(generateDefaultValue({ type: "array" })).toEqual([]);
  });

  test("generates empty object for non-required object", () => {
    expect(generateDefaultValue({ type: "object" })).toEqual({});
  });

  test("generates undefined for non-required primitive types", () => {
    expect(generateDefaultValue({ type: "string" })).toBe(undefined);
    expect(generateDefaultValue({ type: "number" })).toBe(undefined);
    expect(generateDefaultValue({ type: "boolean" })).toBe(undefined);
  });

  test("generates object with properties", () => {
    const schema: JsonSchemaType = {
      type: "object",
      required: ["name", "age", "isActive"],
      properties: {
        name: { type: "string" },
        age: { type: "number" },
        isActive: { type: "boolean" },
      },
    };
    expect(generateDefaultValue(schema)).toEqual({
      name: "",
      age: 0,
      isActive: false,
    });
  });

  test("handles nested objects", () => {
    const schema: JsonSchemaType = {
      type: "object",
      required: ["user"],
      properties: {
        user: {
          type: "object",
          required: ["name", "address"],
          properties: {
            name: { type: "string" },
            address: {
              type: "object",
              required: ["city"],
              properties: {
                city: { type: "string" },
              },
            },
          },
        },
      },
    };
    expect(generateDefaultValue(schema)).toEqual({
      user: {
        name: "",
        address: {
          city: "",
        },
      },
    });
  });

  test("uses schema default value when provided", () => {
    expect(generateDefaultValue({ type: "string", default: "test" })).toBe(
      "test",
    );
  });
});

describe("formatFieldLabel", () => {
  test("formats camelCase", () => {
    expect(formatFieldLabel("firstName")).toBe("First Name");
  });

  test("formats snake_case", () => {
    expect(formatFieldLabel("first_name")).toBe("First name");
  });

  test("formats single word", () => {
    expect(formatFieldLabel("name")).toBe("Name");
  });

  test("formats mixed case with underscores", () => {
    expect(formatFieldLabel("user_firstName")).toBe("User first Name");
  });

  test("handles empty string", () => {
    expect(formatFieldLabel("")).toBe("");
  });
});

describe("Output Schema Validation", () => {
  const mockTools: Tool[] = [
    {
      name: "weatherTool",
      description: "Get weather information",
      inputSchema: {
        type: "object",
        properties: {
          city: { type: "string" },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          temperature: { type: "number" },
          humidity: { type: "number" },
        },
        required: ["temperature", "humidity"],
      },
    },
    {
      name: "noOutputSchema",
      description: "Tool without output schema",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "complexOutputSchema",
      description: "Tool with complex output schema",
      inputSchema: {
        type: "object",
        properties: {},
      },
      outputSchema: {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string" },
              age: { type: "number" },
            },
            required: ["name"],
          },
          tags: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["user"],
      },
    },
  ];

  beforeEach(() => {
    // Clear cache before each test
    cacheToolOutputSchemas([]);
  });

  describe("cacheToolOutputSchemas", () => {
    test("caches validators for tools with output schemas", () => {
      cacheToolOutputSchemas(mockTools);

      expect(hasOutputSchema("weatherTool")).toBe(true);
      expect(hasOutputSchema("complexOutputSchema")).toBe(true);
      expect(hasOutputSchema("noOutputSchema")).toBe(false);
    });

    test("clears existing cache when called", () => {
      cacheToolOutputSchemas(mockTools);
      expect(hasOutputSchema("weatherTool")).toBe(true);

      cacheToolOutputSchemas([]);
      expect(hasOutputSchema("weatherTool")).toBe(false);
    });

    test("handles invalid output schemas gracefully", () => {
      const toolsWithInvalidSchema: Tool[] = [
        {
          name: "invalidSchemaTool",
          description: "Tool with invalid schema",
          inputSchema: { type: "object", properties: {} },
          outputSchema: {
            // @ts-expect-error Testing with invalid type
            type: "invalid-type",
          },
        },
      ];

      // Should not throw
      expect(() =>
        cacheToolOutputSchemas(toolsWithInvalidSchema),
      ).not.toThrow();
      expect(hasOutputSchema("invalidSchemaTool")).toBe(false);
    });
  });

  describe("validateToolOutput", () => {
    beforeEach(() => {
      cacheToolOutputSchemas(mockTools);
    });

    test("validates correct structured content", () => {
      const result = validateToolOutput("weatherTool", {
        temperature: 25.5,
        humidity: 60,
      });

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test("rejects invalid structured content", () => {
      const result = validateToolOutput("weatherTool", {
        temperature: "25.5", // Should be number
        humidity: 60,
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("should be number");
    });

    test("rejects missing required fields", () => {
      const result = validateToolOutput("weatherTool", {
        temperature: 25.5,
        // Missing humidity
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("required");
    });

    test("validates complex nested structures", () => {
      const validResult = validateToolOutput("complexOutputSchema", {
        user: {
          name: "John",
          age: 30,
        },
        tags: ["tag1", "tag2"],
      });

      expect(validResult.isValid).toBe(true);

      const invalidResult = validateToolOutput("complexOutputSchema", {
        user: {
          // Missing required 'name'
          age: 30,
        },
      });

      expect(invalidResult.isValid).toBe(false);
    });

    test("returns valid for tools without validators", () => {
      const result = validateToolOutput("nonExistentTool", { any: "data" });

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test("validates additional properties restriction", () => {
      const result = validateToolOutput("weatherTool", {
        temperature: 25.5,
        humidity: 60,
        extraField: "should not be here",
      });

      // This depends on whether additionalProperties is set to false in the schema
      // If it is, this should fail
      expect(result.isValid).toBe(true); // By default, additional properties are allowed
    });
  });

  describe("getToolOutputValidator", () => {
    beforeEach(() => {
      cacheToolOutputSchemas(mockTools);
    });

    test("returns validator for cached tool", () => {
      const validator = getToolOutputValidator("weatherTool");
      expect(validator).toBeDefined();
      expect(typeof validator).toBe("function");
    });

    test("returns undefined for tool without output schema", () => {
      const validator = getToolOutputValidator("noOutputSchema");
      expect(validator).toBeUndefined();
    });

    test("returns undefined for non-existent tool", () => {
      const validator = getToolOutputValidator("nonExistentTool");
      expect(validator).toBeUndefined();
    });
  });

  describe("hasOutputSchema", () => {
    beforeEach(() => {
      cacheToolOutputSchemas(mockTools);
    });

    test("returns true for tools with output schemas", () => {
      expect(hasOutputSchema("weatherTool")).toBe(true);
      expect(hasOutputSchema("complexOutputSchema")).toBe(true);
    });

    test("returns false for tools without output schemas", () => {
      expect(hasOutputSchema("noOutputSchema")).toBe(false);
    });

    test("returns false for non-existent tools", () => {
      expect(hasOutputSchema("nonExistentTool")).toBe(false);
    });
  });
});
