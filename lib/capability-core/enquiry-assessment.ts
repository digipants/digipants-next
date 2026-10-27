/**
 * Pure, deterministic enquiry assessment for Capability Core v0.
 *
 * Per-field limits count Unicode code points after NFC normalization and trim.
 * The total limit counts the UTF-8 bytes of the normalized JSON representation.
 * This module does not validate HTTP body bytes or perform any I/O.
 */
export const ENQUIRY_CLASSIFICATION_RULESET_VERSION = "rules-v0" as const;
export const MAX_NORMALIZED_INPUT_BYTES = 12_000;

export const ENQUIRY_FIELD_LIMITS = {
  name: 160,
  email: 254,
  message: 5_000,
  project: 160,
  budget: 100,
  timeline: 100,
} as const;

const ENQUIRY_FIELDS = [
  "name",
  "email",
  "message",
  "project",
  "budget",
  "timeline",
] as const;

const REQUIRED_FIELDS = new Set(["name", "email", "message"]);
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export interface EnquiryInput {
  name: string;
  email: string;
  message: string;
  project?: string;
  budget?: string;
  timeline?: string;
}

export type EnquiryValidationIssueCode =
  | "invalid_object"
  | "unknown_field"
  | "required"
  | "invalid_type"
  | "invalid_format"
  | "too_long"
  | "too_many_bytes";

export interface EnquiryValidationIssue {
  /** Field path, "$" for an invalid object or total-byte limit. */
  field: string;
  code: EnquiryValidationIssueCode;
  limit?: number;
  actual?: number;
}

export type EnquiryValidationResult =
  | { valid: true; value: EnquiryInput }
  | { valid: false; issues: EnquiryValidationIssue[] };

export type EnquiryCategory = "project" | "support" | "partnership" | "other";

export type EnquiryClassificationReason =
  | "support_keyword"
  | "partnership_keyword"
  | "project_keyword"
  | "no_matching_keyword";

export interface EnquiryClassification {
  category: EnquiryCategory;
  ruleSetVersion: typeof ENQUIRY_CLASSIFICATION_RULESET_VERSION;
  reason: EnquiryClassificationReason;
}

export interface HumanReviewSuggestion {
  type: "human_review";
  status: "suggested";
  reason: "new_enquiry";
}

export type EnquiryAssessment =
  | {
      validation: { valid: false; issues: EnquiryValidationIssue[] };
      classification?: never;
      suggestedNextAction?: never;
    }
  | {
      validation: { valid: true; value: EnquiryInput };
      classification: EnquiryClassification;
      suggestedNextAction: HumanReviewSuggestion;
    };

function countCodePoints(value: string): number {
  let count = 0;
  for (const _codePoint of value) count += 1;
  return count;
}

function invalidObject(): EnquiryValidationResult {
  return { valid: false, issues: [{ field: "$", code: "invalid_object" }] };
}

/** Normalize and validate an unknown value without performing side effects. */
export function validateEnquiryInput(input: unknown): EnquiryValidationResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return invalidObject();
  }

  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return invalidObject();

  const ownKeys = Reflect.ownKeys(input);
  const allowedFields = new Set<string>(ENQUIRY_FIELDS);
  const issues: EnquiryValidationIssue[] = ownKeys
    .filter((key) => typeof key !== "string" || !allowedFields.has(key))
    .map((key) => ({ field: String(key), code: "unknown_field" as const }))
    .sort((left, right) => (left.field < right.field ? -1 : left.field > right.field ? 1 : 0));

  const normalizedFields: Partial<Record<(typeof ENQUIRY_FIELDS)[number], string>> = {};

  for (const field of ENQUIRY_FIELDS) {
    const descriptor = Object.getOwnPropertyDescriptor(input, field);
    if (!descriptor) {
      if (REQUIRED_FIELDS.has(field)) issues.push({ field, code: "required" });
      continue;
    }

    // Accessors are rejected so validation never invokes caller-defined getters.
    if (!("value" in descriptor) || typeof descriptor.value !== "string") {
      issues.push({ field, code: "invalid_type" });
      continue;
    }

    const value = descriptor.value.normalize("NFC").trim();
    const limit = ENQUIRY_FIELD_LIMITS[field];
    const length = countCodePoints(value);
    if (length > limit) {
      issues.push({ field, code: "too_long", limit, actual: length });
      continue;
    }

    if (REQUIRED_FIELDS.has(field) && value.length === 0) {
      issues.push({ field, code: "required" });
      continue;
    }

    if (field === "email" && !EMAIL_PATTERN.test(value)) {
      issues.push({ field, code: "invalid_format" });
      continue;
    }

    if (field !== "message" && CONTROL_CHARACTERS.test(value)) {
      issues.push({ field, code: "invalid_format" });
      continue;
    }

    // Blank optional values normalize to absence in the canonical input.
    if (REQUIRED_FIELDS.has(field) || value.length > 0) normalizedFields[field] = value;
  }

  if (issues.length > 0) return { valid: false, issues };

  const value: EnquiryInput = {
    name: normalizedFields.name as string,
    email: normalizedFields.email as string,
    message: normalizedFields.message as string,
    ...(normalizedFields.project ? { project: normalizedFields.project } : {}),
    ...(normalizedFields.budget ? { budget: normalizedFields.budget } : {}),
    ...(normalizedFields.timeline ? { timeline: normalizedFields.timeline } : {}),
  };
  const byteLength = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  if (byteLength > MAX_NORMALIZED_INPUT_BYTES) {
    return {
      valid: false,
      issues: [{
        field: "$",
        code: "too_many_bytes",
        limit: MAX_NORMALIZED_INPUT_BYTES,
        actual: byteLength,
      }],
    };
  }

  return { valid: true, value };
}

function classifyEnquiry(input: EnquiryInput): EnquiryClassification {
  const searchableText = `${input.project ?? ""}\n${input.message}`.toLowerCase();

  // Precedence is intentional: support, then partnership, then project.
  if (/\b(?:support|help|bug|issue|technical)\b/.test(searchableText)) {
    return {
      category: "support",
      ruleSetVersion: ENQUIRY_CLASSIFICATION_RULESET_VERSION,
      reason: "support_keyword",
    };
  }

  if (/\b(?:partner|partnership|collaborate|collaboration|referral)\b/.test(searchableText)) {
    return {
      category: "partnership",
      ruleSetVersion: ENQUIRY_CLASSIFICATION_RULESET_VERSION,
      reason: "partnership_keyword",
    };
  }

  if (/\b(?:project|website|web|software|app|ai|marketing|commerce|growth)\b/.test(searchableText)) {
    return {
      category: "project",
      ruleSetVersion: ENQUIRY_CLASSIFICATION_RULESET_VERSION,
      reason: "project_keyword",
    };
  }

  return {
    category: "other",
    ruleSetVersion: ENQUIRY_CLASSIFICATION_RULESET_VERSION,
    reason: "no_matching_keyword",
  };
}

/** Assess an unknown input; valid enquiries receive an advisory human-review suggestion only. */
export function assessEnquiry(input: unknown): EnquiryAssessment {
  const validation = validateEnquiryInput(input);
  if (!validation.valid) return { validation };

  return {
    validation,
    classification: classifyEnquiry(validation.value),
    suggestedNextAction: {
      type: "human_review",
      status: "suggested",
      reason: "new_enquiry",
    },
  };
}
