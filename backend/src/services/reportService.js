const { notifyAdminsOfReport } = require('./notificationService');

async function createReport(
  client,
  {
    reporterId,
    listingId = null,
    userId = null,
    type = 'listing',
    reason,
    description,
    snapshot = {},
    evidence = {}
  }
) {
  const {
    rows: [report]
  } = await client.query(
    `INSERT INTO report
    (reporter_id,listing_id,reported_user_id,target_type,reason,description,target_snapshot,evidence)
    VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb) RETURNING *`,
    [
      reporterId,
      listingId,
      userId,
      type,
      reason,
      description,
      JSON.stringify(snapshot),
      JSON.stringify(evidence)
    ]
  );

  await notifyAdminsOfReport(client, report);

  return report;
}

module.exports = { createReport };