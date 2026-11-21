export const reportContactVisibilityOptions = ['request_only', 'private'];

export const normalizeReportContactVisibility = (value) => value === 'private' ? 'private' : 'request_only';
