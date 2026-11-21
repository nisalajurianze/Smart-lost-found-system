// Preserve only serializable server diagnostics across Redux's rejection path.
export const reportRejection = (error) => ({
  message: typeof error?.message === 'string' ? error.message : '',
  statusCode: Number(error?.statusCode) || 500,
  errors: Array.isArray(error?.errors) ? error.errors.filter((entry) => (
    typeof entry === 'string' || (typeof entry?.field === 'string' && typeof entry?.message === 'string')
  )).map((entry) => typeof entry === 'string' ? entry : { field: entry.field, message: entry.message }) : [],
});

export const reportFieldSteps = {
  images: 1,
  itemName: 2, category: 2, description: 2, brand: 2, model: 2,
  colors: 2, material: 2, uniqueFeatures: 2, tags: 2,
  location: 3, date: 3, storedAt: 3,
  contactPreference: 4, contactVisibility: 4, submit: 4,
};

const aliases = { lostDate: 'date', foundDate: 'date', lostLocation: 'location', foundLocation: 'location', deletedImages: 'images' };
const assistantSubmissionConflict = /^Duplicate value for field:\s*assistantSubmissionId\b/i;
const uploadMessage = /^(?:File is too large\.|Too many files uploaded\.|Maximum 5 images allowed\.|Invalid file type:|Invalid or empty file uploaded\.|File content does not match extension\/mimetype)/;

export const reportErrorsForForm = (error, fallbackMessage) => {
  const fields = {};
  for (const entry of Array.isArray(error?.errors) ? error.errors : []) {
    const rawField = typeof entry?.field === 'string' ? entry.field : '';
    if (rawField === 'assistantSubmissionId') {
      fields.submit ||= fallbackMessage;
      continue;
    }
    const field = Object.hasOwn(aliases, rawField) ? aliases[rawField] : rawField;
    const target = Object.hasOwn(reportFieldSteps, field) ? field : 'submit';
    const message = typeof entry === 'string' ? entry : entry?.message;
    if (typeof message === 'string' && message.trim()) fields[target] ||= message;
  }
  if (!Object.keys(fields).length) {
    const message = (typeof error === 'string' ? error : error?.message) || fallbackMessage;
    if (error?.statusCode === 413 || (error?.statusCode === 400 && uploadMessage.test(message))) {
      fields.images = message;
    } else {
      fields.submit = assistantSubmissionConflict.test(message) ? fallbackMessage : message;
    }
  }
  return fields;
};
