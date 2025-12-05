export function nestedJsonParser(req, res, next) {
  const errors = [];
  const parsedFields = [];

  Object.keys(req.body).forEach((fieldName) => {
    const fieldValue = req.body[fieldName];

    // Only process string values
    if (typeof fieldValue !== "string") {
      return;
    }

    // Check if it looks like JSON (starts with { or [)
    const trimmed = fieldValue.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        req.body[fieldName] = JSON.parse(fieldValue);
        parsedFields.push(fieldName);
      } catch (parseError) {
        errors.push(
          `Field '${fieldName}' looks like JSON but failed to parse: ${parseError.message}`
        );
      }
    }
  });

  if (errors.length > 0) {
    console.warn("Auto JSON parsing encountered errors:", errors);
    // Don't fail the request - these might be intentional strings
  }

  if (parsedFields.length > 0) {
    console.log(`Auto-parsed JSON fields: ${parsedFields.join(", ")}`);
  }

  next();
}
