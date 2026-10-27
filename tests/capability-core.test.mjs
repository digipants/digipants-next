import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../lib/capability-core/enquiry-assessment.ts", import.meta.url),
  "utf8",
);
const moduleSource = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`;
const {
  assessEnquiry,
  validateEnquiryInput,
  ENQUIRY_FIELD_LIMITS,
  MAX_NORMALIZED_INPUT_BYTES,
} = await import(moduleUrl);

function validInput(overrides = {}) {
  return {
    name: "Asha Example",
    email: "asha@example.test",
    message: "I would like to discuss a project.",
    ...overrides,
  };
}

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function inputAtByteLimit() {
  const input = validInput({ message: "" });
  const fixedBytes = byteLength(JSON.stringify(input));
  const messageBytes = MAX_NORMALIZED_INPUT_BYTES - fixedBytes;
  const codePointLimit = ENQUIRY_FIELD_LIMITS.message;
  const extraBytes = messageBytes - codePointLimit;
  const fourByteCount = Math.floor(extraBytes / 3);
  const twoByteCount = extraBytes % 3;
  const asciiCount = codePointLimit - fourByteCount - twoByteCount;

  assert.ok(asciiCount >= 0);
  input.message = "🧪".repeat(fourByteCount)
    + "é".repeat(twoByteCount)
    + "x".repeat(asciiCount);
  assert.equal(Array.from(input.message).length, codePointLimit);
  assert.equal(byteLength(JSON.stringify(input)), MAX_NORMALIZED_INPUT_BYTES);
  return input;
}

test("accepts valid synthetic input and suggests human review only", () => {
  const result = assessEnquiry(validInput());

  assert.equal(result.validation.valid, true);
  assert.deepEqual(result.classification, {
    category: "project",
    ruleSetVersion: "rules-v0",
    reason: "project_keyword",
  });
  assert.deepEqual(result.suggestedNextAction, {
    type: "human_review",
    status: "suggested",
    reason: "new_enquiry",
  });
});

test("normalizes whitespace and Unicode to NFC and omits blank optional fields", () => {
  const result = validateEnquiryInput(validInput({
    name: "  Jo\u0301se\u2003",
    email: "  JOSE@example.test  ",
    message: "\u00a0Hello there\u00a0",
    project: " \t ",
    budget: "  Approximate  ",
  }));

  assert.equal(result.valid, true);
  assert.deepEqual(result.value, {
    name: "Jóse",
    email: "JOSE@example.test",
    message: "Hello there",
    budget: "Approximate",
  });
});

test("reports missing required values and a malformed email", () => {
  const result = validateEnquiryInput({ name: " ", email: "not-an-email", message: "" });

  assert.deepEqual(result, {
    valid: false,
    issues: [
      { field: "name", code: "required" },
      { field: "email", code: "invalid_format" },
      { field: "message", code: "required" },
    ],
  });
  const assessment = assessEnquiry({ name: "Asha", email: "bad", message: "Hello" });
  assert.equal(assessment.classification, undefined);
  assert.equal(assessment.suggestedNextAction, undefined);
});

test("rejects non-object inputs, wrong types, accessors, and undeclared fields", () => {
  assert.deepEqual(validateEnquiryInput(null), {
    valid: false,
    issues: [{ field: "$", code: "invalid_object" }],
  });
  assert.equal(validateEnquiryInput(["Asha", "asha@example.test", "Hello"]).valid, false);

  const wrongTypes = validateEnquiryInput({
    name: 42,
    email: "asha@example.test",
    message: "Hello",
    project: ["website"],
    zeta: "extra",
    alpha: "extra",
  });
  assert.deepEqual(wrongTypes, {
    valid: false,
    issues: [
      { field: "alpha", code: "unknown_field" },
      { field: "zeta", code: "unknown_field" },
      { field: "name", code: "invalid_type" },
      { field: "project", code: "invalid_type" },
    ],
  });

  const accessorInput = validInput();
  Object.defineProperty(accessorInput, "project", { get: () => "website", enumerable: true });
  assert.deepEqual(validateEnquiryInput(accessorInput), {
    valid: false,
    issues: [{ field: "project", code: "invalid_type" }],
  });
});

test("accepts every field at its documented code-point limit", () => {
  const exactLimits = validInput({
    name: "n".repeat(ENQUIRY_FIELD_LIMITS.name),
    email: `${"a".repeat(242)}@b.${"c".repeat(9)}`,
    message: "m".repeat(ENQUIRY_FIELD_LIMITS.message),
    project: "p".repeat(ENQUIRY_FIELD_LIMITS.project),
    budget: "b".repeat(ENQUIRY_FIELD_LIMITS.budget),
    timeline: "t".repeat(ENQUIRY_FIELD_LIMITS.timeline),
  });
  assert.equal(Array.from(exactLimits.email).length, ENQUIRY_FIELD_LIMITS.email);
  assert.equal(validateEnquiryInput(exactLimits).valid, true);
});

test("rejects one code point beyond each documented field limit", () => {
  const overLimitInputs = [
    { field: "name", value: "n".repeat(ENQUIRY_FIELD_LIMITS.name + 1) },
    { field: "email", value: `${"a".repeat(243)}@b.${"c".repeat(9)}` },
    { field: "message", value: "m".repeat(ENQUIRY_FIELD_LIMITS.message + 1) },
    { field: "project", value: "p".repeat(ENQUIRY_FIELD_LIMITS.project + 1) },
    { field: "budget", value: "b".repeat(ENQUIRY_FIELD_LIMITS.budget + 1) },
    { field: "timeline", value: "t".repeat(ENQUIRY_FIELD_LIMITS.timeline + 1) },
  ];

  for (const { field, value } of overLimitInputs) {
    const result = validateEnquiryInput(validInput({ [field]: value }));
    assert.equal(result.valid, false, `${field} should be rejected`);
    assert.ok(result.issues.some((issue) => issue.field === field && issue.code === "too_long"));
  }
});

test("accepts the exact normalized JSON byte limit and rejects a larger value", () => {
  const exactLimit = inputAtByteLimit();
  assert.equal(validateEnquiryInput(exactLimit).valid, true);

  const overLimit = {
    ...exactLimit,
    message: exactLimit.message.replace("x", "🧪"),
  };
  const result = validateEnquiryInput(overLimit);
  assert.deepEqual(result, {
    valid: false,
    issues: [{
      field: "$",
      code: "too_many_bytes",
      limit: MAX_NORMALIZED_INPUT_BYTES,
      actual: MAX_NORMALIZED_INPUT_BYTES + 3,
    }],
  });
});

test("applies documented classification precedence and the other fallback", () => {
  const supportWins = assessEnquiry(validInput({
    project: "website partnership",
    message: "I need technical support with a project.",
  }));
  assert.equal(supportWins.classification.category, "support");
  assert.equal(supportWins.classification.reason, "support_keyword");

  const partnershipWins = assessEnquiry(validInput({
    project: "website",
    message: "I would like a partnership to build together.",
  }));
  assert.equal(partnershipWins.classification.category, "partnership");
  assert.equal(partnershipWins.classification.reason, "partnership_keyword");

  const projectMatches = assessEnquiry(validInput({ message: "Please build a web app." }));
  assert.equal(projectMatches.classification.category, "project");

  const other = assessEnquiry(validInput({ message: "I would like to say hello." }));
  assert.equal(other.classification.category, "other");
  assert.equal(other.classification.reason, "no_matching_keyword");
});

test("keeps generic help and technical wording out of support classification", () => {
  const websiteHelp = assessEnquiry(validInput({
    project: "Website development",
    message: "Can you help us build a website?",
  }));
  assert.equal(websiteHelp.classification.category, "project");

  const technicalPartnership = assessEnquiry(validInput({
    project: "Engineering partnership",
    message: "We are looking for a technical partnership.",
  }));
  assert.equal(technicalPartnership.classification.category, "partnership");

  const technicalSupport = assessEnquiry(validInput({
    message: "I need technical support with an existing app.",
  }));
  assert.equal(technicalSupport.classification.category, "support");
  assert.equal(technicalSupport.classification.reason, "support_keyword");
});

test("returns stable assessments for the same input", () => {
  const input = validInput({ project: "website", budget: "Flexible" });
  const first = assessEnquiry(input);
  const second = assessEnquiry(input);

  assert.deepEqual(second, first);
  assert.deepEqual(input, validInput({ project: "website", budget: "Flexible" }));
});
