
exports.isLateReport = (dateTo, submittedAt = new Date()) => {
  const deadline = new Date(dateTo);
  deadline.setDate(deadline.getDate() + 2); // Tuesday after week ends
  deadline.setHours(23, 59, 59, 999);

  return submittedAt > deadline;
};
